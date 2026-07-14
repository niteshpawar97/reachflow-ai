import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Prisma, PrismaService } from '@reachflow/database';
import { createHash } from 'node:crypto';
import { WebsiteAnalyzerService } from '../website-analyzer/website-analyzer.service';
import { LeadScoringService } from '../lead-scoring/lead-scoring.service';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { PersonalizationService } from '../personalization/personalization.service';
import { AuditSummaryService } from '../audit-summary/audit-summary.service';
import { CreateLeadSchema, type CreateLeadDto, type ListLeadsQuery, type UpdateLeadDto } from './dto/lead.dto';
import { DEFAULT_MAPPING, type ImportResult } from './dto/import.dto';

const LEAD_INCLUDE = {
  company: true,
  contact: true,
  score: true,
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyzer: WebsiteAnalyzerService,
    private readonly scoring: LeadScoringService,
    private readonly emailVerifier: EmailVerificationService,
    private readonly personalization: PersonalizationService,
    private readonly auditSummary: AuditSummaryService,
  ) {}

  /** Generate a client-facing AI narrative for the lead's latest audit and
   * persist it on that audit row (M35). */
  async summarizeAudit(workspaceId: string, leadId: string) {
    const lead = await this.get(workspaceId, leadId);
    const audit = await this.prisma.websiteAudit.findFirst({
      where: { workspaceId, companyId: lead.companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!audit) {
      throw new BadRequestException('Run a website audit first — nothing to summarize');
    }

    const result = await this.auditSummary.summarize(audit, lead.company);
    return this.prisma.websiteAudit.update({
      where: { id: audit.id },
      data: { aiSummary: result.summary },
    });
  }

  /** Generate + persist an AI-personalized cold email for the lead (M39).
   * Grounded in the lead's latest website audit + score. */
  async generateEmail(workspaceId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
      include: { company: true, contact: true, score: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const audit = await this.prisma.websiteAudit.findFirst({
      where: { workspaceId, companyId: lead.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const email = await this.personalization.generate(
      lead.company,
      lead.contact,
      audit,
      lead.score,
    );

    return this.prisma.emailDraft.create({
      data: {
        workspaceId,
        leadId,
        subject: email.subject,
        body: email.body,
        provider: email.provider,
        model: email.model,
        tier: email.tier,
        inputTokens: email.inputTokens,
        outputTokens: email.outputTokens,
        costUsd: email.costUsd,
      },
    });
  }

  /** Generate a follow-up email referencing prior unanswered drafts (M40). */
  async generateFollowUp(workspaceId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
      include: { company: true, contact: true, score: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const priorDrafts = await this.prisma.emailDraft.findMany({
      where: { workspaceId, leadId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (priorDrafts.length === 0) {
      throw new BadRequestException('Generate an initial email before a follow-up');
    }

    const audit = await this.prisma.websiteAudit.findFirst({
      where: { workspaceId, companyId: lead.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const followupCount = priorDrafts.filter((d) => d.kind === 'FOLLOWUP').length;
    const email = await this.personalization.generateFollowUp(
      lead.company,
      lead.contact,
      audit,
      lead.score,
      priorDrafts.map((d) => ({ subject: d.subject, body: d.body })),
      followupCount + 1,
    );

    return this.prisma.emailDraft.create({
      data: {
        workspaceId,
        leadId,
        kind: 'FOLLOWUP',
        sequenceIndex: followupCount + 1,
        subject: email.subject,
        body: email.body,
        provider: email.provider,
        model: email.model,
        tier: email.tier,
        inputTokens: email.inputTokens,
        outputTokens: email.outputTokens,
        costUsd: email.costUsd,
      },
    });
  }

  /** Generate N distinct A/B opener variants for a lead (M41). */
  async generateVariants(workspaceId: string, leadId: string, count: number) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
      include: { company: true, contact: true, score: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const audit = await this.prisma.websiteAudit.findFirst({
      where: { workspaceId, companyId: lead.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const variants = await this.personalization.generateVariants(
      lead.company,
      lead.contact,
      audit,
      lead.score,
      count,
    );

    const created = [];
    for (let i = 0; i < variants.length; i += 1) {
      const v = variants[i]!;
      created.push(
        await this.prisma.emailDraft.create({
          data: {
            workspaceId,
            leadId,
            kind: 'VARIANT',
            variantLabel: String.fromCharCode(65 + i), // A, B, C…
            subject: v.subject,
            body: v.body,
            provider: v.provider,
            model: v.model,
            tier: v.tier,
            inputTokens: v.inputTokens,
            outputTokens: v.outputTokens,
            costUsd: v.costUsd,
          },
        }),
      );
    }
    return created;
  }

  async generateEmailBatch(workspaceId: string, leadIds: string[]) {
    const leads = await this.prisma.lead.findMany({
      where: { workspaceId, deletedAt: null, id: { in: leadIds } },
      include: { company: true, contact: true, score: true },
    });

    if (leads.length !== leadIds.length) {
      throw new NotFoundException('One or more leads were not found');
    }

    const audits = await this.prisma.websiteAudit.findMany({
      where: { workspaceId, companyId: { in: leads.map((lead) => lead.companyId) } },
      orderBy: { createdAt: 'desc' },
    });

    const draftBundle = await this.personalization.generateMany(
      leads.map((lead) => ({
        company: lead.company,
        contact: lead.contact,
        audit: audits.find((audit) => audit.companyId === lead.companyId) ?? null,
        score: lead.score,
      })),
    );

    const created = [] as Array<unknown>;
    for (let index = 0; index < leads.length; index += 1) {
      const lead = leads[index]!;
      const draft = draftBundle[index]!;
      created.push(
        await this.prisma.emailDraft.create({
          data: {
            workspaceId,
            leadId: lead.id,
            subject: draft.subject,
            body: draft.body,
            provider: draft.provider,
            model: draft.model,
            tier: draft.tier,
            inputTokens: draft.inputTokens,
            outputTokens: draft.outputTokens,
            costUsd: draft.costUsd,
          },
        }),
      );
    }

    return created;
  }

  /** List generated email drafts for a lead, newest first. */
  async listEmails(workspaceId: string, leadId: string) {
    await this.get(workspaceId, leadId); // scoped existence check
    return this.prisma.emailDraft.findMany({
      where: { workspaceId, leadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveEmail(workspaceId: string, leadId: string, emailId: string) {
    return this.reviewEmail(workspaceId, leadId, emailId, 'APPROVED');
  }

  async rejectEmail(workspaceId: string, leadId: string, emailId: string) {
    return this.reviewEmail(workspaceId, leadId, emailId, 'REJECTED');
  }

  /** Verify the lead's contact email; caches result + updates contact status (M36). */
  async verifyLeadEmail(workspaceId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
      include: { contact: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (!lead.contact?.email) {
      throw new BadRequestException('Lead has no contact email to verify');
    }

    const r = await this.emailVerifier.verify(lead.contact.email);
    const emailHash = createHash('sha256').update(r.email).digest('hex');

    const [verification] = await this.prisma.$transaction([
      this.prisma.emailVerification.upsert({
        where: { workspaceId_emailHash: { workspaceId, emailHash } },
        create: {
          workspaceId,
          emailHash,
          email: r.email,
          status: r.status,
          mxOk: r.mxOk,
          disposable: r.disposable,
          roleAccount: r.roleAccount,
          riskScore: r.riskScore,
          reason: r.reason,
        },
        update: {
          status: r.status,
          mxOk: r.mxOk,
          disposable: r.disposable,
          roleAccount: r.roleAccount,
          riskScore: r.riskScore,
          reason: r.reason,
          checkedAt: new Date(),
        },
      }),
      this.prisma.contact.update({
        where: { id: lead.contact.id },
        data: { emailStatus: r.status },
      }),
    ]);

    return verification;
  }

  /** Compute + persist a deterministic 0-100 score for the lead (M37). */
  async scoreLead(workspaceId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
      include: { company: true, contact: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    const audit = await this.prisma.websiteAudit.findFirst({
      where: { workspaceId, companyId: lead.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const result = this.scoring.score(lead.company, lead.contact, audit);

    return this.prisma.leadScore.upsert({
      where: { leadId },
      create: {
        workspaceId,
        leadId,
        score: result.score,
        fitScore: result.fitScore,
        intentScore: result.intentScore,
        confidence: result.confidence,
        factors: result.factors as unknown as Prisma.InputJsonValue,
      },
      update: {
        score: result.score,
        fitScore: result.fitScore,
        intentScore: result.intentScore,
        confidence: result.confidence,
        factors: result.factors as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getScore(workspaceId: string, leadId: string) {
    await this.get(workspaceId, leadId);
    return this.prisma.leadScore.findUnique({ where: { leadId } });
  }

  /** Run a website audit for the lead's company and persist it (M34). */
  async auditLead(workspaceId: string, leadId: string) {
    const lead = await this.get(workspaceId, leadId);
    const target =
      lead.company.website ?? (lead.company.domain ? `https://${lead.company.domain}` : null);
    if (!target) {
      throw new BadRequestException('Lead company has no website or domain to audit');
    }

    const r = await this.analyzer.analyze(target);
    return this.prisma.websiteAudit.create({
      data: {
        workspaceId,
        companyId: lead.companyId,
        url: r.url,
        status: r.status,
        https: r.https,
        sslValid: r.sslValid,
        statusCode: r.statusCode,
        responseTimeMs: r.responseTimeMs,
        title: r.title,
        metaDescription: r.metaDescription,
        h1Count: r.h1Count,
        mobileFriendly: r.mobileFriendly,
        hasContactForm: r.hasContactForm,
        hasCta: r.hasCta,
        cms: r.cms,
        techStack: r.techStack,
        findings: r.findings as unknown as Prisma.InputJsonValue,
        performanceScore: r.performanceScore,
        error: r.error,
      },
    });
  }

  /** Latest stored audit for the lead's company, or null. */
  async getLatestAudit(workspaceId: string, leadId: string) {
    const lead = await this.get(workspaceId, leadId);
    return this.prisma.websiteAudit.findFirst({
      where: { workspaceId, companyId: lead.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

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

  private async reviewEmail(
    workspaceId: string,
    leadId: string,
    emailId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    await this.get(workspaceId, leadId);
    const draft = await this.prisma.emailDraft.findFirst({
      where: { id: emailId, workspaceId, leadId, deletedAt: null },
    });
    if (!draft) {
      throw new NotFoundException('Email draft not found');
    }
    return this.prisma.emailDraft.update({
      where: { id: draft.id },
      data: { status, reviewedAt: new Date() },
    });
  }

  /** Parse a CSV, validate each row, create leads (source=IMPORT). Synchronous
   * for now — a queued/batched version arrives with BullMQ (M10). */
  async importCsv(
    workspaceId: string,
    csv: string,
    mapping?: Record<string, string>,
  ): Promise<ImportResult> {
    const map = { ...DEFAULT_MAPPING, ...(mapping ?? {}) };
    let records: Array<Record<string, string>>;
    try {
      records = parse(csv, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Array<Record<string, string>>;
    } catch (e) {
      throw new ConflictException(
        `Could not parse CSV: ${e instanceof Error ? e.message : 'invalid format'}`,
      );
    }

    const result: ImportResult = {
      total: records.length,
      imported: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    let rowNum = 1; // header is row 0
    for (const record of records) {
      rowNum += 1;
      const pick = (field: string): string | undefined => {
        const col = map[field]?.toLowerCase();
        const val = col ? record[col] : undefined;
        return val && val.length > 0 ? val : undefined;
      };

      const candidate = {
        company: {
          name: pick('companyName') ?? pick('domain') ?? pick('website'),
          website: pick('website'),
          domain: pick('domain'),
          industry: pick('industry'),
          country: pick('country'),
          city: pick('city'),
        },
        contact:
          pick('contactName') || pick('contactEmail') || pick('title')
            ? {
                name: pick('contactName'),
                email: pick('contactEmail'),
                title: pick('title'),
              }
            : undefined,
        source: 'IMPORT' as const,
        sourceKey: pick('contactEmail') ?? pick('domain') ?? pick('website'),
      };

      const parsed = CreateLeadSchema.safeParse(candidate);
      if (!parsed.success) {
        result.failed += 1;
        const first = parsed.error.issues[0];
        result.errors.push({
          row: rowNum,
          message: first ? `${first.path.join('.')}: ${first.message}` : 'invalid row',
        });
        continue;
      }

      try {
        await this.create(workspaceId, parsed.data);
        result.imported += 1;
      } catch (e) {
        if (e instanceof ConflictException) {
          result.duplicates += 1;
        } else {
          result.failed += 1;
          result.errors.push({
            row: rowNum,
            message: e instanceof Error ? e.message : 'failed to create',
          });
        }
      }
    }

    return result;
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
