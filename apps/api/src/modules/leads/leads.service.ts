import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaService } from '@reachflow/database';
import type { CreateLeadDto, ListLeadsQuery, UpdateLeadDto } from './dto/lead.dto';

const LEAD_INCLUDE = { company: true, contact: true } satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateLeadDto) {
    return this.prisma.$transaction(async (tx) => {
      // Reuse a company by domain within the workspace, else create it.
      const domain = dto.company.domain ?? this.domainFromUrl(dto.company.website);
      let company =
        domain != null
          ? await tx.company.findFirst({
              where: { workspaceId, domain, deletedAt: null },
            })
          : null;

      company ??= await tx.company.create({
        data: {
          workspaceId,
          name: dto.company.name,
          website: dto.company.website ?? null,
          domain: domain ?? null,
          industry: dto.company.industry ?? null,
          country: dto.company.country ?? null,
          city: dto.company.city ?? null,
        },
      });

      let contactId: string | null = null;
      if (dto.contact && (dto.contact.name || dto.contact.email)) {
        const contact = await tx.contact.create({
          data: {
            workspaceId,
            companyId: company.id,
            name: dto.contact.name ?? null,
            title: dto.contact.title ?? null,
            email: dto.contact.email ?? null,
            roleType: dto.contact.roleType ?? null,
          },
        });
        contactId = contact.id;
      }

      try {
        return await tx.lead.create({
          data: {
            workspaceId,
            companyId: company.id,
            contactId,
            source: dto.source ?? 'MANUAL',
            sourceKey: dto.sourceKey ?? null,
          },
          include: LEAD_INCLUDE,
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('A lead with this source key already exists');
        }
        throw e;
      }
    });
  }

  async list(workspaceId: string, query: ListLeadsQuery) {
    const where: Prisma.LeadWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { company: { name: { contains: query.q, mode: 'insensitive' } } },
              { company: { domain: { contains: query.q, mode: 'insensitive' } } },
              { contact: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.lead.findMany({
      where,
      include: LEAD_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const data = hasMore ? rows.slice(0, query.limit) : rows;
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null };
  }

  async get(workspaceId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: LEAD_INCLUDE,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async update(workspaceId: string, id: string, dto: UpdateLeadDto) {
    await this.get(workspaceId, id); // scoped existence check
    return this.prisma.lead.update({
      where: { id },
      data: { status: dto.status },
      include: LEAD_INCLUDE,
    });
  }

  async softDelete(workspaceId: string, id: string): Promise<void> {
    await this.get(workspaceId, id);
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private domainFromUrl(url: string | undefined): string | null {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}
