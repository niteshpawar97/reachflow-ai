import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CampaignLeadStatus, CampaignStatus, PrismaService } from '@reachflow/database';
import { CampaignSenderService } from './campaign-sender.service';

/**
 * In-process scheduler that periodically sends all due campaign emails via
 * CampaignSenderService — no Redis needed (the DB is the queue). Disabled by
 * default; enable with ENABLE_SEND_SCHEDULER=true. For higher scale this loop
 * moves to the dedicated BullMQ worker, reusing the same sender.
 */
@Injectable()
export class CampaignAutoSendService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignAutoSendService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly enabled = process.env.ENABLE_SEND_SCHEDULER === 'true';
  private readonly intervalMs = Number(process.env.SEND_SCHEDULER_INTERVAL_MS ?? 30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: CampaignSenderService,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Auto-send scheduler disabled (set ENABLE_SEND_SCHEDULER=true to enable)');
      return;
    }
    this.logger.log(`Auto-send scheduler running every ${this.intervalMs}ms`);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One pass: send due emails for every workspace that has any. Public so it
   * can be triggered/tested directly. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const workspaceIds = await this.workspacesWithDueSends();
      let sent = 0;
      for (const workspaceId of workspaceIds) {
        const r = await this.sender.processDue(workspaceId, 25);
        sent += r.sent;
      }
      if (sent > 0) {
        this.logger.log(`Auto-send: dispatched ${sent} email(s) across ${workspaceIds.length} workspace(s)`);
      }
    } catch (e) {
      this.logger.error(`Auto-send tick failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }

  private async workspacesWithDueSends(): Promise<string[]> {
    const now = new Date();
    const rows = await this.prisma.campaignLead.findMany({
      where: {
        status: { in: [CampaignLeadStatus.PENDING, CampaignLeadStatus.QUEUED] },
        nextSendAt: { lte: now },
        campaign: { status: CampaignStatus.ACTIVE },
      },
      select: { workspaceId: true },
      distinct: ['workspaceId'],
      take: 100,
    });
    return rows.map((r) => r.workspaceId);
  }
}
