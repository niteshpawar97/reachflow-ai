import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { PrismaService } from '@reachflow/database';
import { MailboxService } from './mailbox.service';
import { MailSenderService } from './mail-sender.service';

const WARMUP_SUBJECT_PREFIX = 'ReachFlow warmup check-in';

/**
 * Scheduled warmup engine (M25): for every workspace with 2+ warmup-enabled
 * mailboxes, periodically sends a small check-in email from one to another
 * and marks it read over IMAP — the "engaged reader" signal ISPs use to build
 * sender reputation. The actual daily-limit ramp lives in warmup-schedule.ts
 * and is enforced at send time by MailSenderService, so this engine's sends
 * consume real ramp budget rather than bypassing it.
 * Disabled by default; enable with ENABLE_WARMUP_ENGINE=true.
 */
@Injectable()
export class WarmupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WarmupService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly enabled = process.env.ENABLE_WARMUP_ENGINE === 'true';
  private readonly intervalMs = Number(process.env.WARMUP_INTERVAL_MS ?? 3 * 60 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailboxes: MailboxService,
    private readonly sender: MailSenderService,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Warmup engine disabled (set ENABLE_WARMUP_ENGINE=true to enable)');
      return;
    }
    this.logger.log(`Warmup engine running every ${this.intervalMs}ms`);
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
      const rows = await this.prisma.mailbox.findMany({
        where: { deletedAt: null, warmupEnabled: true, status: 'ACTIVE' },
        select: { workspaceId: true },
        distinct: ['workspaceId'],
      });

      for (const { workspaceId } of rows) {
        try {
          await this.warmupWorkspace(workspaceId);
        } catch (e) {
          this.logger.warn(
            `warmup tick failed for workspace ${workspaceId}: ${e instanceof Error ? e.message : e}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async warmupWorkspace(workspaceId: string): Promise<void> {
    const pool = await this.prisma.mailbox.findMany({
      where: { workspaceId, deletedAt: null, warmupEnabled: true, status: 'ACTIVE' },
      orderBy: { sentTotal: 'asc' },
    });
    if (pool.length < 2) return; // need a partner mailbox to warm up against

    const from = pool[0]!;
    const to = pool[1]!;
    const send = await this.sender.sendViaMailbox(workspaceId, from.id, {
      to: to.email,
      subject: `${WARMUP_SUBJECT_PREFIX} ${new Date().toISOString().slice(0, 10)}`,
      text: 'Automated warmup message between your own mailboxes — safe to ignore.',
    });
    this.logger.log(`warmup send ${from.email} -> ${to.email} (${send.messageId || 'bounced'})`);
    if (send.bounced) return;

    await this.markLatestAsRead(workspaceId, to.id, from.email);
  }

  private async markLatestAsRead(workspaceId: string, mailboxId: string, fromEmail: string): Promise<void> {
    const config = await this.mailboxes.getImapConfig(workspaceId, mailboxId);
    if (!config) return; // no IMAP configured — ramp limit still applies, just no read-signal

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: config.password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = await client.search({ from: fromEmail, seen: false }, { uid: true });
        if (uids && uids.length > 0) {
          await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
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
      this.logger.warn(`warmup mark-as-read failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
