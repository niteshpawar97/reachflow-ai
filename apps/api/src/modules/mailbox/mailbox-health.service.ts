import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@reachflow/database';

/** Below this score an auto-pause kicks in — but only once we have enough
 * sends to trust the signal (a single bounce on send #1 shouldn't nuke a
 * brand-new mailbox). */
const AUTO_PAUSE_SCORE_THRESHOLD = 50;
const MIN_SENDS_BEFORE_AUTO_PAUSE = 10;
const DOMAIN_AUTH_PENALTY = 15;

export interface HealthSnapshot {
  healthScore: number;
  bounceCount: number;
  sentTotal: number;
  bounceRate: number;
  autoPausedAt: Date | null;
}

/**
 * Rolling mailbox health: every send/bounce nudges a 0-100 score. Score
 * drops sharply with bounce rate and takes a flat hit if domain auth
 * (SPF/DKIM/DMARC) isn't passing — both are real deliverability risk
 * signals ESPs use to decide whether to keep trusting a sending identity.
 */
@Injectable()
export class MailboxHealthService {
  private readonly logger = new Logger(MailboxHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordSend(mailboxId: string): Promise<void> {
    await this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: { sentTotal: { increment: 1 } },
    });
    await this.recompute(mailboxId);
  }

  async recordBounce(mailboxId: string): Promise<void> {
    await this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: { bounceCount: { increment: 1 } },
    });
    await this.recompute(mailboxId);
  }

  async recompute(mailboxId: string): Promise<HealthSnapshot> {
    const mailbox = await this.prisma.mailbox.findUniqueOrThrow({ where: { id: mailboxId } });

    const bounceRate = mailbox.sentTotal > 0 ? mailbox.bounceCount / mailbox.sentTotal : 0;
    let score = 100 - Math.round(bounceRate * 100 * 4); // 5% bounce rate -> -20

    const domainReport = mailbox.domainAuthReport as { overallPass?: boolean } | null;
    if (domainReport && domainReport.overallPass === false) {
      score -= DOMAIN_AUTH_PENALTY;
    }
    score = Math.max(0, Math.min(100, score));

    const shouldAutoPause =
      score < AUTO_PAUSE_SCORE_THRESHOLD &&
      mailbox.sentTotal >= MIN_SENDS_BEFORE_AUTO_PAUSE &&
      mailbox.status === 'ACTIVE';

    const data: { healthScore: number; status?: 'PAUSED'; autoPausedAt?: Date; lastError?: string } = {
      healthScore: score,
    };
    if (shouldAutoPause) {
      data.status = 'PAUSED';
      data.autoPausedAt = new Date();
      data.lastError = `Auto-paused: health score ${score} (bounce rate ${(bounceRate * 100).toFixed(1)}%)`;
      this.logger.warn(`auto-pausing mailbox ${mailboxId}: score=${score} bounceRate=${bounceRate}`);
    }

    const updated = await this.prisma.mailbox.update({ where: { id: mailboxId }, data });

    return {
      healthScore: updated.healthScore,
      bounceCount: updated.bounceCount,
      sentTotal: updated.sentTotal,
      bounceRate,
      autoPausedAt: updated.autoPausedAt,
    };
  }

  /** Manual recovery — clears the auto-pause flag and reactivates the mailbox.
   * Does NOT reset counters: the score will re-earn trust as new sends land. */
  async reactivate(mailboxId: string): Promise<void> {
    await this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: { status: 'ACTIVE', autoPausedAt: null, lastError: null },
    });
  }
}
