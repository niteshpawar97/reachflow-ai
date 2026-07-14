import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import {
  CampaignLeadStatus,
  LeadStatus,
  MessageDirection,
  PrismaService,
  ReplyClassification,
  SuppressionReason,
} from '@reachflow/database';
import { MailboxService } from '../mailbox/mailbox.service';
import { SuppressionService } from '../suppression/suppression.service';
import { ReplyClassificationService } from './reply-classification.service';

export interface SyncResult {
  fetched: number;
  replies: number;
  bounces: number;
}

const BOUNCE_SENDER_RE = /mailer-daemon|postmaster|mail delivery subsystem/i;
const BOUNCE_SUBJECT_RE =
  /undeliver|delivery status notification|delivery (has )?failed|returned mail|failure notice|non-delivery/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Cap history on a mailbox's very first sync so we don't ingest years of mail.
const FIRST_SYNC_MAX_MESSAGES = 30;

/** Polls a mailbox's INBOX over IMAP for new mail, detects bounces, matches
 * genuine replies to the CampaignLead that sent the original email, cancels
 * that lead's follow-up sequence, and classifies the reply with AI. */
@Injectable()
export class ImapSyncService {
  private readonly logger = new Logger(ImapSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailboxes: MailboxService,
    private readonly suppressions: SuppressionService,
    private readonly classifier: ReplyClassificationService,
  ) {}

  async syncMailbox(workspaceId: string, mailboxId: string): Promise<SyncResult> {
    const config = await this.mailboxes.getImapConfig(workspaceId, mailboxId);
    if (!config) {
      throw new BadRequestException(
        'IMAP is not configured for this mailbox (no host could be inferred, or no password stored)',
      );
    }

    const mailbox = await this.prisma.mailbox.findUniqueOrThrow({ where: { id: mailboxId } });
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: config.password },
      logger: false,
    });

    const result: SyncResult = { fetched: 0, replies: 0, bounces: 0 };
    let maxUid = mailbox.imapLastUid;

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const isFirstSync = mailbox.imapLastUid === 0;
        const uidNext = client.mailbox && 'uidNext' in client.mailbox ? client.mailbox.uidNext : undefined;
        const range = isFirstSync
          ? `${Math.max(1, (uidNext ?? FIRST_SYNC_MAX_MESSAGES + 1) - FIRST_SYNC_MAX_MESSAGES)}:*`
          : `${mailbox.imapLastUid + 1}:*`;

        for await (const msg of client.fetch(range, { envelope: true, source: true }, { uid: true })) {
          if (msg.uid <= mailbox.imapLastUid) continue;
          if (msg.uid > maxUid) maxUid = msg.uid;
          if (!msg.source) continue;

          result.fetched += 1;
          const parsed = await simpleParser(msg.source);
          const outcome = await this.handleMessage(workspaceId, mailboxId, mailbox.email, msg.uid, parsed);
          if (outcome === 'reply') result.replies += 1;
          if (outcome === 'bounce') result.bounces += 1;
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (e) {
      try {
        client.close();
      } catch {
        /* ignore */
      }
      const message = e instanceof Error ? e.message : 'IMAP sync failed';
      this.logger.error(`IMAP sync failed for mailbox ${mailboxId}: ${message}`);
      throw new BadRequestException(`IMAP sync failed: ${message}`);
    }

    if (maxUid !== mailbox.imapLastUid) {
      await this.mailboxes.updateImapCursor(mailboxId, maxUid);
    } else {
      await this.mailboxes.updateImapCursor(mailboxId, mailbox.imapLastUid);
    }

    return result;
  }

  private async handleMessage(
    workspaceId: string,
    mailboxId: string,
    mailboxEmail: string,
    uid: number,
    parsed: ParsedMail,
  ): Promise<'reply' | 'bounce' | 'ignored'> {
    const fromAddress = (
      Array.isArray(parsed.from?.value) ? parsed.from?.value[0]?.address : undefined
    )?.toLowerCase();
    const toAddress =
      (Array.isArray(parsed.to) ? undefined : parsed.to?.value?.[0]?.address)?.toLowerCase() ??
      mailboxEmail.toLowerCase();
    const subject = parsed.subject ?? null;
    const bodyText = parsed.text ?? '';
    const receivedAt = parsed.date ?? new Date();
    const messageIdHeader = parsed.messageId ?? null;
    const inReplyTo = Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] : parsed.inReplyTo;

    if (!fromAddress) return 'ignored';

    const isBounce = BOUNCE_SENDER_RE.test(fromAddress) || BOUNCE_SUBJECT_RE.test(subject ?? '');

    if (isBounce) {
      const campaignLeadId = await this.handleBounce(workspaceId, bodyText);
      await this.saveMessage({
        workspaceId,
        mailboxId,
        campaignLeadId,
        direction: MessageDirection.INBOUND,
        fromAddress,
        toAddress,
        subject,
        bodyText,
        messageIdHeader,
        inReplyTo,
        imapUid: uid,
        receivedAt,
        classification: ReplyClassification.BOUNCE,
      });
      return 'bounce';
    }

    // Genuine reply candidate — match to the most recently active CampaignLead
    // from this contact's email in this workspace.
    const campaignLead = await this.prisma.campaignLead.findFirst({
      where: { workspaceId, lead: { contact: { email: fromAddress } } },
      orderBy: { lastEventAt: 'desc' },
      include: { lead: true },
    });

    let classification: ReplyClassification = ReplyClassification.UNCLASSIFIED;
    let confidence: number | null = null;
    let summary: string | null = null;

    if (campaignLead) {
      const result = await this.classifier.classify(bodyText, subject);
      classification = result.classification;
      confidence = result.confidence;
      summary = result.summary;

      // M62: a reply cancels the sequence — stop sending further steps.
      await this.prisma.$transaction([
        this.prisma.campaignLead.update({
          where: { id: campaignLead.id },
          data: {
            status: CampaignLeadStatus.REPLIED,
            nextSendAt: null,
            lastEventAt: new Date(),
          },
        }),
        this.prisma.lead.update({
          where: { id: campaignLead.leadId },
          data: { status: LeadStatus.REPLIED },
        }),
      ]);
    }

    await this.saveMessage({
      workspaceId,
      mailboxId,
      campaignLeadId: campaignLead?.id ?? null,
      direction: MessageDirection.INBOUND,
      fromAddress,
      toAddress,
      subject,
      bodyText,
      messageIdHeader,
      inReplyTo,
      imapUid: uid,
      receivedAt,
      classification,
      classificationConfidence: confidence,
      classificationSummary: summary,
    });

    return campaignLead ? 'reply' : 'ignored';
  }

  /** Extracts the original recipient from a bounce/DSN body and suppresses it. */
  private async handleBounce(workspaceId: string, bodyText: string): Promise<string | null> {
    const candidates = [...new Set(bodyText.match(EMAIL_RE) ?? [])];
    if (candidates.length === 0) return null;

    const contact = await this.prisma.contact.findFirst({
      where: { workspaceId, email: { in: candidates } },
    });
    if (!contact?.email) return null;

    await this.suppressions.add(workspaceId, contact.email, SuppressionReason.BOUNCED);

    const campaignLead = await this.prisma.campaignLead.findFirst({
      where: { workspaceId, leadId: { in: (await this.leadIdsForContact(workspaceId, contact.id)) } },
      orderBy: { lastEventAt: 'desc' },
    });

    if (campaignLead) {
      await this.prisma.$transaction([
        this.prisma.campaignLead.update({
          where: { id: campaignLead.id },
          data: {
            status: CampaignLeadStatus.BOUNCED,
            nextSendAt: null,
            stopReason: 'bounced: IMAP delivery-failure notification received',
          },
        }),
        this.prisma.lead.update({
          where: { id: campaignLead.leadId },
          data: { status: LeadStatus.SUPPRESSED },
        }),
      ]);
    }

    return campaignLead?.id ?? null;
  }

  private async leadIdsForContact(workspaceId: string, contactId: string): Promise<string[]> {
    const leads = await this.prisma.lead.findMany({
      where: { workspaceId, contactId },
      select: { id: true },
    });
    return leads.map((l) => l.id);
  }

  private async saveMessage(data: {
    workspaceId: string;
    mailboxId: string;
    campaignLeadId: string | null;
    direction: MessageDirection;
    fromAddress: string;
    toAddress: string;
    subject: string | null;
    bodyText: string;
    messageIdHeader: string | null;
    inReplyTo?: string;
    imapUid: number;
    receivedAt: Date;
    classification: ReplyClassification;
    classificationConfidence?: number | null;
    classificationSummary?: string | null;
  }): Promise<void> {
    await this.prisma.message.upsert({
      where: { mailboxId_imapUid: { mailboxId: data.mailboxId, imapUid: data.imapUid } },
      create: {
        workspaceId: data.workspaceId,
        mailboxId: data.mailboxId,
        campaignLeadId: data.campaignLeadId,
        direction: data.direction,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        subject: data.subject,
        snippet: data.bodyText.slice(0, 200),
        bodyText: data.bodyText,
        messageIdHeader: data.messageIdHeader,
        inReplyTo: data.inReplyTo ?? null,
        imapUid: data.imapUid,
        receivedAt: data.receivedAt,
        classification: data.classification,
        classificationConfidence: data.classificationConfidence ?? null,
        classificationSummary: data.classificationSummary ?? null,
      },
      update: {},
    });
  }
}
