import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CampaignLeadStatus, CampaignStatus, PrismaService } from '@reachflow/database';

type PlannedSend = {
  jobId: string;
  leadCampaignId: string;
  campaignId: string;
  leadId: string;
  step: number;
  nextSendAt: Date | null;
  idempotencyKey: string;
};

@Injectable()
export class DueSendSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DueSendSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs = Number(process.env.DUE_SEND_PLAN_INTERVAL_MS ?? 15000);
  private readonly batchSize = Number(process.env.DUE_SEND_PLAN_BATCH_SIZE ?? 50);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(`Starting due-send scheduler every ${this.intervalMs}ms`);
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
      let totalPlanned = 0;

      while (true) {
        const planned = await this.planBatch(this.batchSize);
        totalPlanned += planned.length;

        if (planned.length === 0 || planned.length < this.batchSize) {
          break;
        }
      }

      if (totalPlanned > 0) {
        this.logger.log(`Planned ${totalPlanned} due send(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to plan due sends', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async planBatch(limit: number): Promise<PlannedSend[]> {
    const now = new Date();
    const due = await this.prisma.campaignLead.findMany({
      where: {
        status: { in: [CampaignLeadStatus.PENDING, CampaignLeadStatus.QUEUED] },
        nextSendAt: { lte: now },
        queuedJobKey: null,
        campaign: { status: CampaignStatus.ACTIVE },
      },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        currentStep: true,
        nextSendAt: true,
      },
      orderBy: { nextSendAt: 'asc' },
      take: limit,
    });

    const planned: PlannedSend[] = [];

    for (const row of due) {
      const jobId = `send-email:${row.id}`;
      const updated = await this.prisma.campaignLead.updateMany({
        where: { id: row.id, queuedJobKey: null },
        data: {
          status: CampaignLeadStatus.QUEUED,
          queuedAt: now,
          queuedJobKey: jobId,
        },
      });

      if (updated.count === 0) {
        continue;
      }

      planned.push({
        jobId,
        leadCampaignId: row.id,
        campaignId: row.campaignId,
        leadId: row.leadId,
        step: row.currentStep,
        nextSendAt: row.nextSendAt,
        idempotencyKey: jobId,
      });
    }

    return planned;
  }
}