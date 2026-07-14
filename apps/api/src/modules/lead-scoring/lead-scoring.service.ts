import { Injectable } from '@nestjs/common';
import type { Company, Contact, WebsiteAudit } from '@reachflow/database';

export interface ScoreFactor {
  label: string;
  points: number;
  detail?: string;
}

export interface ScoreResult {
  score: number;
  fitScore: number;
  intentScore: number;
  confidence: number;
  factors: ScoreFactor[];
}

interface AuditFinding {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

// Industries that commonly buy custom software / web / automation services.
const ICP_INDUSTRIES = [
  'saas',
  'software',
  'technology',
  'tech',
  'it',
  'ecommerce',
  'e-commerce',
  'retail',
  'agency',
  'marketing',
  'fintech',
  'finance',
  'healthcare',
  'real estate',
  'logistics',
  'manufacturing',
  'education',
];

const TARGET_MARKETS = [
  'us',
  'usa',
  'united states',
  'ca',
  'canada',
  'uk',
  'gb',
  'united kingdom',
  'au',
  'australia',
  'uae',
  'united arab emirates',
  'de',
  'germany',
  'fr',
  'france',
  'nl',
  'ie',
  'ireland',
  'sg',
  'singapore',
];

const BASIC_CMS = ['wordpress', 'wix', 'squarespace', 'weebly', 'godaddy'];

@Injectable()
export class LeadScoringService {
  score(
    company: Pick<Company, 'industry' | 'country' | 'website' | 'domain'>,
    contact: Pick<Contact, 'email'> | null,
    audit: Pick<
      WebsiteAudit,
      'findings' | 'performanceScore' | 'cms' | 'status' | 'mobileFriendly'
    > | null,
  ): ScoreResult {
    const factors: ScoreFactor[] = [];

    // --- Fit: how well they match our ideal customer profile ---
    let fit = 40;
    factors.push({ label: 'Base fit', points: 40 });

    if (company.website || company.domain) {
      fit += 10;
      factors.push({ label: 'Has a website', points: 10 });
    }

    const industry = (company.industry ?? '').toLowerCase();
    if (industry && ICP_INDUSTRIES.some((i) => industry.includes(i))) {
      fit += 15;
      factors.push({ label: `ICP industry (${company.industry})`, points: 15 });
    } else if (industry) {
      fit += 5;
      factors.push({ label: 'Known industry', points: 5 });
    }

    const country = (company.country ?? '').toLowerCase();
    if (country && TARGET_MARKETS.some((c) => country === c || country.includes(c))) {
      fit += 20;
      factors.push({ label: `Target market (${company.country})`, points: 20 });
    } else if (country) {
      fit += 5;
      factors.push({ label: 'Non-priority market', points: 5 });
    }

    if (contact?.email) {
      fit += 15;
      factors.push({ label: 'Decision-maker email on file', points: 15 });
    }

    // --- Intent / opportunity: a worse site = more we can sell ---
    let intent = 30;
    factors.push({ label: 'Base opportunity', points: 30 });

    if (audit && audit.status !== 'FAILED') {
      const findings = this.parseFindings(audit.findings);
      let problemPoints = 0;
      for (const f of findings) {
        const p = f.severity === 'high' ? 18 : f.severity === 'medium' ? 10 : 5;
        problemPoints += p;
      }
      problemPoints = Math.min(problemPoints, 55); // cap
      if (problemPoints > 0) {
        intent += problemPoints;
        factors.push({
          label: `${findings.length} website issue(s) to fix`,
          points: problemPoints,
          detail: findings.map((f) => f.code).join(', '),
        });
      }

      if (typeof audit.performanceScore === 'number' && audit.performanceScore < 60) {
        intent += 10;
        factors.push({
          label: `Low performance score (${audit.performanceScore})`,
          points: 10,
        });
      }

      const cms = (audit.cms ?? '').toLowerCase();
      if (cms && BASIC_CMS.some((c) => cms.includes(c))) {
        intent += 8;
        factors.push({
          label: `Basic CMS (${audit.cms}) — custom-build opportunity`,
          points: 8,
        });
      }
    } else {
      factors.push({
        label: 'No audit yet — opportunity estimated',
        points: 0,
        detail: 'Run a website audit to sharpen this score',
      });
    }

    fit = this.clamp(fit);
    intent = this.clamp(intent);
    const score = Math.round(0.45 * fit + 0.55 * intent);

    // --- Confidence from data completeness ---
    let confidence = 0;
    if (audit && audit.status !== 'FAILED') confidence += 45;
    if (company.industry) confidence += 20;
    if (company.country) confidence += 20;
    if (contact?.email) confidence += 15;
    confidence = this.clamp(confidence);

    return { score, fitScore: fit, intentScore: intent, confidence, factors };
  }

  private parseFindings(raw: unknown): AuditFinding[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (f): f is AuditFinding =>
        typeof f === 'object' && f !== null && 'severity' in f && 'code' in f,
    );
  }

  private clamp(n: number): number {
    return Math.max(0, Math.min(100, Math.round(n)));
  }
}
