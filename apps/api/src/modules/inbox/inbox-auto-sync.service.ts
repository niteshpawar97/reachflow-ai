import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@reachflow/database';
import { ImapSyncService } from './imap-sync.service';

/**
 * Timer loop that polls every mailbox's INBOX for new mail (replies + bounces).
 * Disabled by default; enable with ENABLE_INBOX_SYNC=true. Skips mailboxes with
 * no usable IMAP config instead of failing the whole tick.
 */
@Injectable()
export class InboxAutoSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxAutoSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly enabled = process.env.ENABLE_INBOX_SYNC === 'true';
  private readonly intervalMs = Number(process.env.INBOX_SYNC_INTERVAL_MS ?? 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imapSync: ImapSyncService,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Inbox auto-sync disabled (set ENABLE_INBOX_SYNC=true to enable)');
      return;
    }
    this.logger.log(`Inbox auto-sync running every ${this.intervalMs}ms`);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const mailboxes = await this.prisma.mailbox.findMany({
        where: { deletedAt: null, status: { not: 'PAUSED' } },
        select: { id: true, workspaceId: true, email: true },
      });

      for (const mailbox of mailboxes) {
        try {
          const result = await this.imapSync.syncMailbox(mailbox.workspaceId, mailbox.id);
          if (result.fetched > 0) {
            this.logger.log(
              `synced ${mailbox.email}: ${result.fetched} fetched, ${result.replies} replies, ${result.bounces} bounces`,
            );
          }
        } catch (e) {
          this.logger.debug(`skip mailbox ${mailbox.email}: ${e instanceof Error ? e.message : e}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
