import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignLeadStatus, PrismaService } from '@reachflow/database';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

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