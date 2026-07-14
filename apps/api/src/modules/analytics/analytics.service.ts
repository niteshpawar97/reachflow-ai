import { Injectable } from '@nestjs/common';
import { PrismaService } from '@reachflow/database';

interface DayBucket {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Daily trend for the last N days. Built from CampaignLead timestamps
   * (lastSentAt/openedAt/clickedAt/lastEventAt) since there is no separate
   * immutable send-event log yet — this is a per-lead snapshot, not a full
   * multi-touch event ledger (a campaign lead with 3 steps contributes one
   * "sent" day, its most recent).
   */
  async overview(workspaceId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.campaignLead.findMany({
      where: { workspaceId, updatedAt: { gte: since } },
      select: {
        lastSentAt: true,
        openedAt: true,
        clickedAt: true,
        status: true,
        lastEventAt: true,
      },
    });

    const buckets = new Map<string, DayBucket>();
    const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
    const get = (key: string): DayBucket => {
      let b = buckets.get(key);
      if (!b) {
        b = { date: key, sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 };
        buckets.set(key, b);
      }
      return b;
    };

    for (const row of rows) {
      if (row.lastSentAt) get(dayKey(row.lastSentAt)).sent += 1;
      if (row.openedAt) get(dayKey(row.openedAt)).opened += 1;
      if (row.clickedAt) get(dayKey(row.clickedAt)).clicked += 1;
      if (row.status === 'REPLIED' && row.lastEventAt) get(dayKey(row.lastEventAt)).replied += 1;
      if (row.status === 'BOUNCED' && row.lastEventAt) get(dayKey(row.lastEventAt)).bounced += 1;
    }

    // Fill missing days with zeros so the chart has a continuous x-axis.
    const series: DayBucket[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = dayKey(new Date(Date.now() - i * 86_400_000));
      series.push(get(key));
    }
    return series;
  }

  /** Lead -> contacted -> opened -> clicked -> replied -> won funnel. */
  async funnel(workspaceId: string) {
    const [totalLeads, contacted, opened, clicked, replied, won] = await Promise.all([
      this.prisma.lead.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.campaignLead.count({ where: { workspaceId, lastSentAt: { not: null } } }),
      this.prisma.campaignLead.count({ where: { workspaceId, openCount: { gt: 0 } } }),
      this.prisma.campaignLead.count({ where: { workspaceId, clickCount: { gt: 0 } } }),
      this.prisma.campaignLead.count({ where: { workspaceId, status: 'REPLIED' } }),
      this.prisma.deal.count({ where: { workspaceId, stage: 'WON' } }),
    ]);
    return { totalLeads, contacted, opened, clicked, replied, won };
  }

  /** Per-campaign send/open/click/reply/bounce rates. */
  async campaignBreakdown(workspaceId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId, deletedAt: null },
      include: { leads: true },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => {
      const total = c.leads.length;
      const sent = c.leads.filter((l) => l.lastSentAt !== null).length;
      const opened = c.leads.filter((l) => l.openCount > 0).length;
      const clicked = c.leads.filter((l) => l.clickCount > 0).length;
      const replied = c.leads.filter((l) => l.status === 'REPLIED').length;
      const bounced = c.leads.filter((l) => l.status === 'BOUNCED').length;
      const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        total,
        sent,
        openRate: pct(opened, sent),
        clickRate: pct(clicked, sent),
        replyRate: pct(replied, sent),
        bounceRate: pct(bounced, sent),
      };
    });
  }

  /** CSV export of every campaign-lead row for this workspace. */
  async exportCsv(workspaceId: string): Promise<string> {
    const rows = await this.prisma.campaignLead.findMany({
      where: { workspaceId },
      include: {
        campaign: { select: { name: true } },
        lead: { include: { company: true, contact: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'campaign',
      'company',
      'contact_email',
      'status',
      'step',
      'opens',
      'clicks',
      'last_sent_at',
      'stop_reason',
    ];
    const escape = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.campaign.name,
          r.lead.company.name,
          r.lead.contact?.email ?? '',
          r.status,
          r.currentStep,
          r.openCount,
          r.clickCount,
          r.lastSentAt?.toISOString() ?? '',
          r.stopReason ?? '',
        ]
          .map(escape)
          .join(','),
      );
    }
    return lines.join('\n');
  }
}
