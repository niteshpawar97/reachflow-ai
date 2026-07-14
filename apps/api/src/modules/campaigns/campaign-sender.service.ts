import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CampaignLeadStatus, CampaignStatus, Prisma, PrismaService } from '@reachflow/database';
import { MailSenderService } from '../mailbox/mail-sender.service';
import { PersonalizationService } from '../personalization/personalization.service';
import { appendUnsubscribeFooter, injectTracking, textToHtml, trackingBaseUrl } from './tracking-inject';
import { SuppressionService } from '../suppression/suppression.service';

export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ campaignLeadId: string; message: string }>;
}

type DueCampaignLead = Prisma.CampaignLeadGetPayload<{
  include: {
    campaign: { include: { steps: true } };
    lead: { include: { company: true; contact: true; score: true } };
  };
}>;

/**
 * Sends due campaign emails INLINE (no queue) so campaigns work without Redis.
 * Renders each step (FIXED or AI), injects open/click tracking, sends via the
 * campaign's mailbox, then advances the lead to the next step. The BullMQ worker
 * can reuse this same service once Redis is available.
 */
@Injectable()
export class CampaignSenderService {
  private readonly logger = new Logger(CampaignSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: MailSenderService,
    private readonly personalization: PersonalizationService,
    private readonly suppressions: SuppressionService,
  ) {}

  async processDue(workspaceId: string, limit = 25): Promise<ProcessResult> {
    const now = new Date();
    const due = await this.prisma.campaignLead.findMany({
      where: {
        workspaceId,
        status: { in: [CampaignLeadStatus.PENDING, CampaignLeadStatus.QUEUED] },
        nextSendAt: { lte: now },
        campaign: { status: CampaignStatus.ACTIVE },
      },
      include: {
        campaign: { include: { steps: true } },
        lead: { include: { company: true, contact: true, score: true } },
      },
      orderBy: { nextSendAt: 'asc' },
      take: limit,
    });

    const result: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
    for (const row of due) {
      result.processed += 1;
      try {
        const outcome = await this.sendCampaignLead(row);
        result[outcome] += 1;
      } catch (e) {
        result.failed += 1;
        const message = e instanceof Error ? e.message : 'send failed';
        result.errors.push({ campaignLeadId: row.id, message });
        this.logger.error(`campaign send failed for ${row.id}: ${message}`);
        await this.prisma.campaignLead.update({
          where: { id: row.id },
          data: { status: CampaignLeadStatus.PENDING, stopReason: message.slice(0, 300) },
        });
      }
    }
    return result;
  }

  private async sendCampaignLead(
    row: DueCampaignLead,
  ): Promise<'sent' | 'skipped'> {
    const steps = [...row.campaign.steps].sort((a, b) => a.position - b.position);
    const step = steps[row.currentStep];

    // No step at this index → sequence complete.
    if (!step) {
      await this.prisma.campaignLead.update({
        where: { id: row.id },
        data: { status: CampaignLeadStatus.SENT, nextSendAt: null, queuedJobKey: null, queuedAt: null },
      });
      return 'skipped';
    }

    const contact = row.lead.contact;
    if (!contact?.email) {
      await this.prisma.campaignLead.update({
        where: { id: row.id },
        data: {
          status: CampaignLeadStatus.SKIPPED,
          nextSendAt: null,
          stopReason: 'Lead has no contact email',
        },
      });
      return 'skipped';
    }

    // Compliance: never send to a suppressed (unsubscribed/bounced/manual) address.
    if (await this.suppressions.isSuppressed(row.workspaceId, contact.email)) {
      await this.prisma.campaignLead.update({
        where: { id: row.id },
        data: {
          status: CampaignLeadStatus.STOPPED,
          nextSendAt: null,
          stopReason: 'recipient is on the suppression list',
        },
      });
      return 'skipped';
    }

    const mailboxId = this.pickMailbox(row.campaign.mailboxPool);

    // Render subject + body for this step.
    const { subject, body } = await this.renderStep(row, step);

    // Ensure a tracking token, inject pixel + click-wrapping + unsubscribe footer.
    const token = row.trackingToken ?? randomBytes(16).toString('hex');
    const base = trackingBaseUrl();
    const html = appendUnsubscribeFooter(injectTracking(textToHtml(body), token, base), token, base);

    await this.sender.sendViaMailbox(row.workspaceId, mailboxId, {
      to: contact.email,
      subject,
      text: body,
      html,
    });

    // Advance to the next step (or finish).
    const nextStep = steps[row.currentStep + 1];
    const nextSendAt = nextStep
      ? new Date(Date.now() + nextStep.delayMinutes * 60_000)
      : null;

    await this.prisma.campaignLead.update({
      where: { id: row.id },
      data: {
        status: nextStep ? CampaignLeadStatus.PENDING : CampaignLeadStatus.SENT,
        currentStep: row.currentStep + 1,
        lastSentAt: new Date(),
        lastEventAt: new Date(),
        nextSendAt,
        trackingToken: token,
        queuedJobKey: null,
        queuedAt: null,
      },
    });

    return 'sent';
  }

  private async renderStep(
    row: DueCampaignLead,
    step: { mode: string; subject: string | null; body: string | null },
  ): Promise<{ subject: string; body: string }> {
    if (step.mode === 'FIXED') {
      return {
        subject: step.subject ?? '(no subject)',
        body: step.body ?? '',
      };
    }

    // AI mode — grounded on the lead's latest audit + score.
    const audit = await this.prisma.websiteAudit.findFirst({
      where: { workspaceId: row.workspaceId, companyId: row.lead.companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (row.currentStep === 0) {
      const email = await this.personalization.generate(
        row.lead.company,
        row.lead.contact,
        audit,
        row.lead.score,
      );
      return { subject: email.subject, body: email.body };
    }

    const email = await this.personalization.generateFollowUp(
      row.lead.company,
      row.lead.contact,
      audit,
      row.lead.score,
      [],
      row.currentStep,
    );
    return { subject: email.subject, body: email.body };
  }

  /** Extract the first usable mailbox id from the campaign's pool. */
  private pickMailbox(pool: unknown): string {
    const entries = Array.isArray(pool) ? pool : [];
    for (const entry of entries) {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const id = (entry as Record<string, unknown>).id ?? (entry as Record<string, unknown>).mailboxId;
        if (typeof id === 'string') return id;
      }
    }
    throw new Error('Campaign has no mailbox configured in its mailbox pool');
  }
}
