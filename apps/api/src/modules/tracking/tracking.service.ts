import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignLeadStatus, LeadStatus, PrismaService, SuppressionReason } from '@reachflow/database';
import { SuppressionService } from '../suppression/suppression.service';

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppressions: SuppressionService,
  ) {}

  /** Suppresses the lead's email + stops its sequence. Idempotent. Returns the
   * lead's contact email for a friendly confirmation page. */
  async recordUnsubscribe(token: string): Promise<{ email: string | null }> {
    const row = await this.prisma.campaignLead.findFirst({
      where: { trackingToken: token },
      include: { lead: { include: { contact: true } } },
    });
    if (!row) {
      throw new NotFoundException('Tracking token not found');
    }

    const email = row.lead.contact?.email ?? null;
    if (email) {
      await this.suppressions.add(row.workspaceId, email, SuppressionReason.UNSUBSCRIBED);
    }

    await this.prisma.$transaction([
      this.prisma.campaignLead.update({
        where: { id: row.id },
        data: { status: CampaignLeadStatus.STOPPED, nextSendAt: null, stopReason: 'unsubscribed' },
      }),
      this.prisma.lead.update({
        where: { id: row.leadId },
        data: { status: LeadStatus.SUPPRESSED },
      }),
    ]);

    return { email };
  }

  async recordOpen(token: string) {
    const lead = await this.findByToken(token);
    const now = new Date();

    return this.prisma.campaignLead.update({
      where: { id: lead.id },
      data: {
        openCount: { increment: 1 },
        openedAt: lead.openedAt ?? now,
        lastEventAt: now,
        status:
          lead.status === CampaignLeadStatus.REPLIED || lead.status === CampaignLeadStatus.BOUNCED
            ? lead.status
            : CampaignLeadStatus.OPENED,
      },
    });
  }

  async recordClick(token: string) {
    const lead = await this.findByToken(token);
    const now = new Date();

    return this.prisma.campaignLead.update({
      where: { id: lead.id },
      data: {
        clickCount: { increment: 1 },
        clickedAt: lead.clickedAt ?? now,
        lastEventAt: now,
        status:
          lead.status === CampaignLeadStatus.REPLIED || lead.status === CampaignLeadStatus.BOUNCED
            ? lead.status
            : CampaignLeadStatus.OPENED,
      },
    });
  }

  private async findByToken(token: string) {
    const lead = await this.prisma.campaignLead.findFirst({
      where: { trackingToken: token },
      select: {
        id: true,
        status: true,
        openedAt: true,
        clickedAt: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Tracking token not found');
    }

    return lead;
  }
}