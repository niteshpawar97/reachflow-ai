import { Injectable, NotFoundException } from '@nestjs/common';
import { DealActivityType, DealStage, Prisma, PrismaService } from '@reachflow/database';
import type { CreateDealDto, UpdateDealDto } from './dto/deal.dto';

const DEAL_INCLUDE = {
  lead: { include: { company: true, contact: true } },
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    return this.prisma.deal.findMany({
      where: { workspaceId },
      include: DEAL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(workspaceId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, workspaceId },
      include: { ...DEAL_INCLUDE, activities: { orderBy: { createdAt: 'desc' } } },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async create(workspaceId: string, dto: CreateDealDto) {
    const deal = await this.prisma.deal.create({
      data: {
        workspaceId,
        leadId: dto.leadId,
        title: dto.title,
        value: dto.value ?? null,
        currency: dto.currency ?? 'USD',
      },
      include: DEAL_INCLUDE,
    });
    await this.logActivity(workspaceId, deal.id, DealActivityType.NOTE, 'Deal created');
    return deal;
  }

  async updateStage(workspaceId: string, id: string, stage: DealStage) {
    const existing = await this.prisma.deal.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('Deal not found');

    const deal = await this.prisma.deal.update({
      where: { id },
      data: {
        stage,
        closedAt: stage === DealStage.WON || stage === DealStage.LOST ? new Date() : null,
      },
      include: DEAL_INCLUDE,
    });
    await this.logActivity(
      workspaceId,
      id,
      DealActivityType.STAGE_CHANGE,
      `Moved from ${existing.stage} to ${stage}`,
    );
    return deal;
  }

  async update(workspaceId: string, id: string, dto: UpdateDealDto) {
    await this.get(workspaceId, id);
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      },
      include: DEAL_INCLUDE,
    });
  }

  async addActivity(workspaceId: string, dealId: string, type: DealActivityType, body?: string) {
    await this.get(workspaceId, dealId);
    return this.logActivity(workspaceId, dealId, type, body);
  }

  /** M61: turn an inbound reply into a deal, logging the reply as the first activity. */
  async convertReplyToDeal(workspaceId: string, campaignLeadId: string) {
    const campaignLead = await this.prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, workspaceId },
      include: { lead: { include: { company: true } }, campaign: true },
    });
    if (!campaignLead) throw new NotFoundException('Lead not found');

    const existing = await this.prisma.deal.findFirst({
      where: { workspaceId, leadId: campaignLead.leadId, stage: { notIn: [DealStage.WON, DealStage.LOST] } },
    });
    if (existing) return existing;

    const deal = await this.prisma.deal.create({
      data: {
        workspaceId,
        leadId: campaignLead.leadId,
        title: `${campaignLead.lead.company.name} — ${campaignLead.campaign.name}`,
      },
      include: DEAL_INCLUDE,
    });

    const lastReply = await this.prisma.message.findFirst({
      where: { workspaceId, campaignLeadId, direction: 'INBOUND' },
      orderBy: { receivedAt: 'desc' },
    });
    await this.logActivity(
      workspaceId,
      deal.id,
      DealActivityType.REPLY,
      lastReply?.snippet ?? 'Prospect replied',
    );
    return deal;
  }

  private async logActivity(
    workspaceId: string,
    dealId: string,
    type: DealActivityType,
    body?: string,
  ) {
    return this.prisma.dealActivity.create({
      data: { workspaceId, dealId, type, body: body ?? null },
    });
  }
}
