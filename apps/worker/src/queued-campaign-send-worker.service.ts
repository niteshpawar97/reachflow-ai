import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  CampaignLeadStatus,
  CampaignStepTrigger,
  CampaignStatus,
  EmailStatus,
  LeadStatus,
  PrismaService,
} from '@reachflow/database';
import { randomUUID } from 'node:crypto';

type QueuedCampaignLead = {
  id: string;
  workspaceId: string;
  campaignId: string;
  currentStep: number;
  queuedJobKey: string | null;
  trackingToken: string | null;
  campaign: {
    status: CampaignStatus;
    dailyCap: number;
    mailboxPool: unknown;
    steps: Array<{
      position: number;
      trigger: CampaignStepTrigger;
      delayMinutes: number;
      subject: string | null;
      body: string | null;
    }>;
  };
  lead: {
    status: LeadStatus;
    company: { name: string };
    contact: { email: string | null; emailStatus: EmailStatus } | null;
  };
};

@Injectable()
export class QueuedCampaignSendWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuedCampaignSendWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs = Number(process.env.CAMPAIGN_SEND_INTERVAL_MS ?? 10000);
  private readonly batchSize = Number(process.env.CAMPAIGN_SEND_BATCH_SIZE ?? 25);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(`Starting queued-send worker every ${this.intervalMs}ms`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      let totalProcessed = 0;

      while (true) {
        const processed = await this.processBatch(this.batchSize);
        totalProcessed += processed;
        if (processed < this.batchSize) {
          break;
        }
      }

      if (totalProcessed > 0) {
        this.logger.log(`Processed ${totalProcessed} queued send(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to process queued sends', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async processBatch(limit: number): Promise<number> {
    const queued = await this.prisma.campaignLead.findMany({
      where: {
        status: CampaignLeadStatus.QUEUED,
        queuedJobKey: { not: null },
      },
      include: {
        campaign: { include: { steps: true } },
        lead: { include: { company: true, contact: true } },
      },
      orderBy: { queuedAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const row of queued as QueuedCampaignLead[]) {
      const handled = await this.processQueuedLead(row);
      if (handled) {
        processed += 1;
      }
    }

    return processed;
  }

  private async processQueuedLead(row: QueuedCampaignLead): Promise<boolean> {
    const jobKey = row.queuedJobKey ?? `send-email:${row.id}`;
    const trackingToken = row.trackingToken ?? randomUUID();
    const now = new Date();

    const claimed = await this.prisma.campaignLead.updateMany({
      where: {
        id: row.id,
        status: CampaignLeadStatus.QUEUED,
        queuedJobKey: jobKey,
      },
      data: {
        status: CampaignLeadStatus.SENDING,
        lastEventAt: now,
        trackingToken,
      },
    });

    if (claimed.count === 0) {
      return false;
    }

    if (row.campaign.status !== CampaignStatus.ACTIVE) {
      await this.finalize(row.id, {
        status: CampaignLeadStatus.STOPPED,
        stopReason: 'campaign not active',
        now,
      });
      return true;
    }

    if (!this.hasHealthyMailbox(row.campaign.mailboxPool)) {
      await this.finalize(row.id, {
        status: CampaignLeadStatus.SKIPPED,
        stopReason: 'no healthy mailbox available',
        now,
      });
      return true;
    }

    if (row.lead.status === LeadStatus.SUPPRESSED) {
      await this.finalize(row.id, {
        status: CampaignLeadStatus.STOPPED,
        stopReason: 'lead suppressed',
        now,
      });
      return true;
    }

    const email = row.lead.contact?.email;
    if (!email || row.lead.contact?.emailStatus !== EmailStatus.VALID) {
      await this.finalize(row.id, {
        status: CampaignLeadStatus.STOPPED,
        stopReason: 'verified email missing',
        now,
      });
      return true;
    }

    if (await this.isOverDailyCap(row.workspaceId, row.campaignId, row.campaign.dailyCap)) {
      await this.finalize(row.id, {
        status: CampaignLeadStatus.SKIPPED,
        stopReason: 'daily cap reached',
        now,
      });
      return true;
    }

    const currentPosition = row.currentStep + 1;
    const currentStep = row.campaign.steps.find((step) => step.position === currentPosition);
    if (!currentStep) {
      await this.finalize(row.id, {
        status: CampaignLeadStatus.STOPPED,
        stopReason: 'campaign step missing',
        now,
      });
      return true;
    }

    const mailbox = this.pickMailbox(row.campaign.mailboxPool);
  const openUrl = `/tracking/open/${trackingToken}.gif`;
  const clickUrl = `/tracking/click/${trackingToken}?u=${encodeURIComponent('https://example.com')}`;
    const messageId = `msg-${row.id}-${currentStep.position}-${now.getTime()}`;

    this.logger.log(
      `Sending campaign email ${JSON.stringify({
        jobKey,
        campaignId: row.campaignId,
        leadId: row.id,
        email,
        mailbox,
        step: currentStep.position,
        openUrl,
        clickUrl,
        messageId,
      })}`,
    );

    const nextStep = row.campaign.steps.find((step) => step.position === currentPosition + 1);
    const nextSendAt =
      nextStep && nextStep.trigger === CampaignStepTrigger.SEND
        ? new Date(now.getTime() + nextStep.delayMinutes * 60_000)
        : null;
    const finalStatus = nextStep && nextStep.trigger === CampaignStepTrigger.SEND
      ? CampaignLeadStatus.PENDING
      : CampaignLeadStatus.SENT;

    await this.prisma.campaignLead.update({
      where: { id: row.id },
      data: {
        status: finalStatus,
        currentStep: currentPosition,
        nextSendAt,
        lastSentAt: now,
        lastEventAt: now,
        queuedAt: null,
        queuedJobKey: null,
        trackingToken,
        stopReason: null,
      },
    });

    return true;
  }

  private async finalize(
    leadCampaignId: string,
    patch: {
      status: CampaignLeadStatus;
      stopReason: string;
      now: Date;
    },
  ): Promise<void> {
    await this.prisma.campaignLead.update({
      where: { id: leadCampaignId },
      data: {
        status: patch.status,
        stopReason: patch.stopReason,
        lastEventAt: patch.now,
        queuedAt: null,
        queuedJobKey: null,
      },
    });
  }

  private hasHealthyMailbox(mailboxPool: unknown): boolean {
    if (!Array.isArray(mailboxPool)) {
      return false;
    }

    return mailboxPool.some((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      return (item as { healthy?: boolean }).healthy !== false;
    });
  }

  private pickMailbox(mailboxPool: unknown): string {
    if (!Array.isArray(mailboxPool)) {
      return 'default';
    }

    const mailbox = mailboxPool.find((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      return (item as { healthy?: boolean }).healthy !== false;
    }) as { email?: string; id?: string } | undefined;

    return mailbox?.email ?? mailbox?.id ?? 'default';
  }

  private async isOverDailyCap(workspaceId: string, campaignId: string, dailyCap: number): Promise<boolean> {
    if (dailyCap <= 0) {
      return false;
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const sentToday = await this.prisma.campaignLead.count({
      where: {
        workspaceId,
        campaignId,
        status: CampaignLeadStatus.SENT,
        lastSentAt: { gte: startOfDay },
      },
    });

    return sentToday >= dailyCap;
  }

}