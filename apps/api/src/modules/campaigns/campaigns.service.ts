import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaService, CampaignLeadStatus, CampaignStatus, EmailStatus, LeadStatus } from '@reachflow/database';
import type {
  AttachLeadsDto,
  CampaignStepDto,
  CreateCampaignDto,
  UpdateCampaignStepDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

type CampaignWithRelations = Prisma.CampaignGetPayload<{
  include: { steps: true; leads: { include: { lead: { include: { company: true; contact: true; score: true } } } } };
}>;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId, deletedAt: null },
      include: { _count: { select: { steps: true, leads: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      offer: campaign.offer,
      status: campaign.status,
      timezone: campaign.timezone,
      dailyCap: campaign.dailyCap,
      launchedAt: campaign.launchedAt,
      pausedAt: campaign.pausedAt,
      stoppedAt: campaign.stoppedAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      stepCount: campaign._count.steps,
      leadCount: campaign._count.leads,
    }));
  }

  async get(workspaceId: string, id: string) {
    const campaign = await this.campaignOrThrow(workspaceId, id);
    return this.toDetail(campaign);
  }

  async create(workspaceId: string, dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        workspaceId,
        name: dto.name,
        offer: dto.offer,
        timezone: dto.timezone,
        dailyCap: dto.dailyCap,
        schedule: (dto.schedule ?? null) as Prisma.InputJsonValue,
        mailboxPool: (dto.mailboxPool ?? null) as Prisma.InputJsonValue,
      },
      include: { steps: true, leads: { include: { lead: true } } },
    });

    return this.toDetail(campaign);
  }

  async update(workspaceId: string, id: string, dto: UpdateCampaignDto) {
    await this.campaignOrThrow(workspaceId, id);
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.offer !== undefined ? { offer: dto.offer } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.dailyCap !== undefined ? { dailyCap: dto.dailyCap } : {}),
        ...(dto.schedule !== undefined ? { schedule: dto.schedule as Prisma.InputJsonValue } : {}),
        ...(dto.mailboxPool !== undefined
          ? { mailboxPool: dto.mailboxPool as Prisma.InputJsonValue }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { steps: true, leads: { include: { lead: true } } },
    });
    return this.toDetail(campaign);
  }

  async addStep(workspaceId: string, campaignId: string, dto: CampaignStepDto) {
    await this.campaignOrThrow(workspaceId, campaignId);
    const position =
      dto.position ??
      ((await this.prisma.campaignStep.count({ where: { campaignId } })) + 1);

    const step = await this.prisma.campaignStep.create({
      data: {
        workspaceId,
        campaignId,
        position,
        mode: dto.mode,
        trigger: dto.trigger,
        delayMinutes: dto.delayMinutes,
        subject: dto.subject ?? null,
        body: dto.body ?? null,
        aiPrompt: dto.aiPrompt ?? null,
      },
    });
    return step;
  }

  async updateStep(
    workspaceId: string,
    campaignId: string,
    stepId: string,
    dto: UpdateCampaignStepDto,
  ) {
    await this.stepOrThrow(workspaceId, campaignId, stepId);
    return this.prisma.campaignStep.update({
      where: { id: stepId },
      data: {
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
        ...(dto.delayMinutes !== undefined ? { delayMinutes: dto.delayMinutes } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.aiPrompt !== undefined ? { aiPrompt: dto.aiPrompt } : {}),
      },
    });
  }

  async deleteStep(workspaceId: string, campaignId: string, stepId: string) {
    await this.stepOrThrow(workspaceId, campaignId, stepId);
    await this.prisma.campaignStep.delete({ where: { id: stepId } });
  }

  async listSteps(workspaceId: string, campaignId: string) {
    await this.campaignOrThrow(workspaceId, campaignId);
    return this.prisma.campaignStep.findMany({
      where: { workspaceId, campaignId },
      orderBy: { position: 'asc' },
    });
  }

  async attachLeads(workspaceId: string, campaignId: string, dto: AttachLeadsDto) {
    await this.campaignOrThrow(workspaceId, campaignId);
    const leads = await this.resolveAttachableLeads(workspaceId, dto);
    const ineligible = leads.filter((lead) => !this.isLeadAttachable(lead));
    if (ineligible.length > 0) {
      throw new BadRequestException(
        `Only READY leads with VALID emails can be attached. Ineligible: ${ineligible
          .slice(0, 5)
          .map((lead) => lead.company.name)
          .join(', ')}`,
      );
    }

    await this.prisma.campaignLead.createMany({
      data: leads.map((lead) => ({
        workspaceId,
        campaignId,
        leadId: lead.id,
      })),
      skipDuplicates: true,
    });

    return this.listCampaignLeads(workspaceId, campaignId);
  }

  async listCampaignLeads(workspaceId: string, campaignId: string) {
    await this.campaignOrThrow(workspaceId, campaignId);
    const rows = await this.prisma.campaignLead.findMany({
      where: { workspaceId, campaignId },
      include: {
        lead: {
          include: { company: true, contact: true, score: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      currentStep: row.currentStep,
      nextSendAt: row.nextSendAt,
      lead: row.lead,
    }));
  }

  async launch(workspaceId: string, campaignId: string) {
    const campaign = await this.campaignOrThrow(workspaceId, campaignId);
    const reasons = await this.validateLaunch(workspaceId, campaignId, campaign);
    if (reasons.length > 0) {
      throw new BadRequestException(`Launch blocked: ${reasons.join('; ')}`);
    }

    const now = new Date();
    await this.prisma.campaignLead.updateMany({
      where: { workspaceId, campaignId, status: CampaignLeadStatus.PENDING, nextSendAt: null },
      data: { nextSendAt: now },
    });

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.ACTIVE, launchedAt: new Date() },
    });
  }

  async pause(workspaceId: string, campaignId: string) {
    await this.campaignOrThrow(workspaceId, campaignId);
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.PAUSED, pausedAt: new Date() },
    });
  }

  async resume(workspaceId: string, campaignId: string) {
    await this.campaignOrThrow(workspaceId, campaignId);
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.ACTIVE },
    });
  }

  async stop(workspaceId: string, campaignId: string) {
    await this.campaignOrThrow(workspaceId, campaignId);
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.STOPPED, stoppedAt: new Date() },
    });
  }

  async planDueSends(workspaceId: string, limit = 50) {
    const now = new Date();
    const due = await this.prisma.campaignLead.findMany({
      where: {
        workspaceId,
        status: { in: [CampaignLeadStatus.PENDING, CampaignLeadStatus.QUEUED] },
        nextSendAt: { lte: now },
        queuedJobKey: null,
        campaign: { status: CampaignStatus.ACTIVE },
      },
      include: {
        campaign: { include: { steps: true } },
        lead: { include: { company: true, contact: true, score: true } },
      },
      orderBy: { nextSendAt: 'asc' },
      take: limit,
    });

    const planned = [] as Array<{
      jobId: string;
      leadCampaignId: string;
      campaignId: string;
      leadId: string;
      step: number;
      nextSendAt: Date | null;
      idempotencyKey: string;
    }>;

    for (const row of due) {
      const jobId = `send-email:${row.id}`;
      await this.prisma.campaignLead.update({
        where: { id: row.id },
        data: {
          status: CampaignLeadStatus.QUEUED,
          queuedAt: now,
          queuedJobKey: jobId,
        },
      });
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

    return { planned, count: planned.length, now };
  }

  private async validateLaunch(workspaceId: string, campaignId: string, campaign: CampaignWithRelations) {
    const reasons: string[] = [];
    const steps = await this.prisma.campaignStep.findMany({
      where: { workspaceId, campaignId },
      orderBy: { position: 'asc' },
    });
    const leads = await this.prisma.campaignLead.findMany({
      where: { workspaceId, campaignId },
      include: { lead: { include: { company: true, contact: true } } },
    });

    if (steps.length === 0) reasons.push('add at least one sequence step');
    if (leads.length === 0) reasons.push('attach at least one lead');
    if (campaign.dailyCap < 1) reasons.push('daily cap must be at least 1');

    const mailboxPool = Array.isArray(campaign.mailboxPool) ? campaign.mailboxPool : [];
    const healthyMailboxes = mailboxPool.filter((item) => {
      if (typeof item !== 'object' || item === null) return false;
      return (item as { healthy?: boolean }).healthy !== false;
    });
    if (healthyMailboxes.length === 0) reasons.push('add at least one healthy mailbox to the pool');

    for (const step of steps) {
      if (step.mode === 'FIXED' && (!step.subject?.trim() || !step.body?.trim())) {
        reasons.push(`step ${step.position} needs subject and body for FIXED mode`);
      }
      if (step.mode === 'AI' && !step.aiPrompt?.trim()) {
        reasons.push(`step ${step.position} needs an AI prompt for AI mode`);
      }
    }

    for (const row of leads) {
      const emailStatus = row.lead.contact?.emailStatus;
      if (!row.lead.contact?.email || emailStatus !== EmailStatus.VALID) {
        reasons.push(`lead ${row.lead.company.name} needs a verified VALID email`);
      }
      if (row.lead.status === LeadStatus.SUPPRESSED) {
        reasons.push(`lead ${row.lead.company.name} is suppressed`);
      }
    }

    return Array.from(new Set(reasons));
  }

  private async campaignOrThrow(workspaceId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { steps: true, leads: { include: { lead: true } } },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  private async stepOrThrow(workspaceId: string, campaignId: string, stepId: string) {
    const step = await this.prisma.campaignStep.findFirst({
      where: { id: stepId, workspaceId, campaignId },
    });
    if (!step) {
      throw new NotFoundException('Campaign step not found');
    }
    return step;
  }

  private async resolveAttachableLeads(workspaceId: string, dto: AttachLeadsDto) {
    if (dto.leadIds?.length) {
      const leads = await this.prisma.lead.findMany({
        where: { workspaceId, deletedAt: null, id: { in: dto.leadIds } },
        include: { company: true, contact: true, score: true },
      });
      if (leads.length !== dto.leadIds.length) {
        throw new NotFoundException('One or more leads were not found');
      }
      return leads;
    }

    const where: Prisma.LeadWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(dto.filter?.status ? { status: dto.filter.status } : {}),
      ...(dto.filter?.q
        ? {
            OR: [
              { company: { name: { contains: dto.filter.q, mode: 'insensitive' } } },
              { company: { domain: { contains: dto.filter.q, mode: 'insensitive' } } },
              { contact: { email: { contains: dto.filter.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    return this.prisma.lead.findMany({
      where,
      include: { company: true, contact: true, score: true },
    });
  }

  private isLeadAttachable(lead: { status: LeadStatus; contact: { email?: string | null; emailStatus: EmailStatus } | null }) {
    return lead.status === LeadStatus.READY && lead.contact?.emailStatus === EmailStatus.VALID && Boolean(lead.contact?.email);
  }

  private toDetail(campaign: CampaignWithRelations) {
    return {
      id: campaign.id,
      name: campaign.name,
      offer: campaign.offer,
      status: campaign.status,
      timezone: campaign.timezone,
      schedule: campaign.schedule,
      mailboxPool: campaign.mailboxPool,
      dailyCap: campaign.dailyCap,
      launchedAt: campaign.launchedAt,
      pausedAt: campaign.pausedAt,
      stoppedAt: campaign.stoppedAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      steps: campaign.steps,
      leads: campaign.leads,
    };
  }
}
