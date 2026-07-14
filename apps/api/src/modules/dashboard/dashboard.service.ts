import { Injectable } from '@nestjs/common';
import { PrismaService } from '@reachflow/database';

const pct = (num: number, denom: number): number =>
  denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(workspaceId: string) {
    const [
      leadsTotal,
      leadsReady,
      leadsVerified,
      mailboxes,
      campaignsTotal,
      campaignsActive,
      draftsGenerated,
      sent,
      opened,
      clicked,
      replied,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.lead.count({ where: { workspaceId, deletedAt: null, status: 'READY' } }),
      this.prisma.lead.count({
        where: { workspaceId, deletedAt: null, contact: { emailStatus: 'VALID' } },
      }),
      this.prisma.mailbox.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.campaign.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.campaign.count({ where: { workspaceId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.emailDraft.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.campaignLead.count({ where: { workspaceId, lastSentAt: { not: null } } }),
      this.prisma.campaignLead.count({ where: { workspaceId, openCount: { gt: 0 } } }),
      this.prisma.campaignLead.count({ where: { workspaceId, clickCount: { gt: 0 } } }),
      this.prisma.campaignLead.count({ where: { workspaceId, status: 'REPLIED' } }),
    ]);

    return {
      leads: { total: leadsTotal, ready: leadsReady, verified: leadsVerified },
      mailboxes,
      campaigns: { total: campaignsTotal, active: campaignsActive },
      emails: {
        generated: draftsGenerated,
        sent,
        opened,
        clicked,
        replied,
        openRate: pct(opened, sent),
        clickRate: pct(clicked, sent),
        replyRate: pct(replied, sent),
      },
      checklist: {
        workspace: true,
        mailbox: mailboxes > 0,
        leads: leadsTotal > 0,
        campaign: campaignsTotal > 0,
      },
    };
  }
}
