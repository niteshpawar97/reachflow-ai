import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageDirection, PrismaService } from '@reachflow/database';
import { MailSenderService } from '../mailbox/mail-sender.service';
import { ReplyClassificationService } from './reply-classification.service';

const THREAD_INCLUDE = {
  campaignLead: {
    include: {
      lead: { include: { company: true, contact: true } },
      campaign: true,
    },
  },
} as const;

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: MailSenderService,
    private readonly classifier: ReplyClassificationService,
  ) {}

  /** One row per campaign-lead thread that has at least one inbound message,
   * newest first, with the latest message as a preview. */
  async listThreads(workspaceId: string) {
    const latest = await this.prisma.message.findMany({
      where: { workspaceId, direction: MessageDirection.INBOUND, campaignLeadId: { not: null } },
      orderBy: { receivedAt: 'desc' },
      include: THREAD_INCLUDE,
    });

    const seen = new Set<string>();
    const threads = [];
    for (const m of latest) {
      const key = m.campaignLeadId!;
      if (seen.has(key)) continue;
      seen.add(key);
      threads.push({
        campaignLeadId: key,
        company: m.campaignLead?.lead.company,
        contact: m.campaignLead?.lead.contact,
        campaignName: m.campaignLead?.campaign.name,
        lastMessage: {
          subject: m.subject,
          snippet: m.snippet,
          receivedAt: m.receivedAt,
          classification: m.classification,
          isRead: m.isRead,
        },
      });
    }
    return threads;
  }

  /** Messages not tied to any known lead (bounces / cold replies from unknowns). */
  async listUnmatched(workspaceId: string) {
    return this.prisma.message.findMany({
      where: { workspaceId, direction: MessageDirection.INBOUND, campaignLeadId: null },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    });
  }

  async getThread(workspaceId: string, campaignLeadId: string) {
    const messages = await this.prisma.message.findMany({
      where: { workspaceId, campaignLeadId },
      orderBy: { receivedAt: 'asc' },
    });
    if (messages.length === 0) {
      throw new NotFoundException('Thread not found');
    }
    await this.prisma.message.updateMany({
      where: { workspaceId, campaignLeadId, isRead: false },
      data: { isRead: true },
    });
    return messages;
  }

  async suggestReply(workspaceId: string, messageId: string): Promise<{ suggestion: string }> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, workspaceId },
      include: { campaignLead: { include: { campaign: true } } },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    const offer = message.campaignLead?.campaign.offer ?? 'our services';
    const suggestion = await this.classifier.suggestReply(message.bodyText ?? '', offer);
    return { suggestion };
  }

  async sendReply(workspaceId: string, campaignLeadId: string, body: string) {
    const campaignLead = await this.prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, workspaceId },
      include: { campaign: true, lead: { include: { contact: true } } },
    });
    if (!campaignLead) {
      throw new NotFoundException('Thread not found');
    }
    const email = campaignLead.lead.contact?.email;
    if (!email) {
      throw new BadRequestException('This lead has no contact email');
    }

    const mailboxId = this.pickMailbox(campaignLead.campaign.mailboxPool);
    const lastInbound = await this.prisma.message.findFirst({
      where: { workspaceId, campaignLeadId },
      orderBy: { receivedAt: 'desc' },
    });
    const subject = lastInbound?.subject?.toLowerCase().startsWith('re:')
      ? lastInbound.subject
      : `Re: ${lastInbound?.subject ?? campaignLead.campaign.name}`;

    await this.sender.sendViaMailbox(workspaceId, mailboxId, { to: email, subject, text: body });
    const mailbox = await this.prisma.mailbox.findUnique({ where: { id: mailboxId } });

    await this.prisma.message.create({
      data: {
        workspaceId,
        mailboxId,
        campaignLeadId,
        direction: MessageDirection.OUTBOUND,
        fromAddress: mailbox?.email ?? '',
        toAddress: email,
        subject,
        snippet: body.slice(0, 200),
        bodyText: body,
        receivedAt: new Date(),
        isRead: true,
      },
    });

    return { sent: true };
  }

  private pickMailbox(pool: unknown): string {
    const entries = Array.isArray(pool) ? pool : [];
    for (const entry of entries) {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const id = (entry as Record<string, unknown>).id ?? (entry as Record<string, unknown>).mailboxId;
        if (typeof id === 'string') return id;
      }
    }
    throw new BadRequestException('This campaign has no mailbox configured');
  }
}
