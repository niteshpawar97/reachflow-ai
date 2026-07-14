import { Injectable } from '@nestjs/common';
import type { Company, WebsiteAudit } from '@reachflow/database';
import { AiService } from '@reachflow/ai';

interface AuditFinding {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface AuditSummaryResult {
  summary: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const SYSTEM_PROMPT = [
  'You are a senior web consultant writing a short, plain-English health summary',
  "of a small business's website for a non-technical owner.",
  'Rules:',
  '- Ground every statement in the audit findings provided. Never invent facts.',
  '- Explain what is working, what is hurting them, and the top 2–3 opportunities.',
  '- Tie technical issues to real business impact (lost customers, trust, mobile users).',
  '- Plain language, no jargon, no hype. 3 short paragraphs or a few tight bullets.',
  '- If the site could not be reached, say so plainly and stop there.',
  'Return only the summary text — no preamble, no headings.',
].join('\n');

/** Turns a raw WebsiteAudit into a client-facing narrative summary (M35). */
@Injectable()
export class AuditSummaryService {
  constructor(private readonly ai: AiService) {}

  isEnabled(): boolean {
    return this.ai.isEnabled();
  }

  async summarize(audit: WebsiteAudit, company: Company): Promise<AuditSummaryResult> {
    const facts = this.buildFacts(audit, company);
    const result = await this.ai.generateText(facts, {
      system: SYSTEM_PROMPT,
      tier: 'balanced',
      maxTokens: 500,
      temperature: 0.5,
    });

    return {
      summary: result.text.trim(),
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.estimatedCostUsd,
    };
  }

  private buildFacts(audit: WebsiteAudit, company: Company): string {
    const lines: string[] = [];
    lines.push(`Business: ${company.name}${company.industry ? ` (${company.industry})` : ''}`);
    lines.push(`Website: ${audit.url}`);
    lines.push('');
    lines.push('Audit results:');
    lines.push(`- Reachable: ${audit.status === 'FAILED' ? 'no — site could not be loaded' : 'yes'}`);
    if (audit.performanceScore != null) lines.push(`- Performance score: ${audit.performanceScore}/100`);
    if (audit.responseTimeMs != null) {
      lines.push(`- Page load time: ${(audit.responseTimeMs / 1000).toFixed(1)}s`);
    }
    lines.push(`- Secure (HTTPS): ${audit.https ? 'yes' : 'no'}`);
    lines.push(`- Mobile friendly: ${audit.mobileFriendly ? 'yes' : 'no'}`);
    lines.push(`- Contact form: ${audit.hasContactForm ? 'present' : 'missing'}`);
    lines.push(`- Clear call-to-action: ${audit.hasCta ? 'present' : 'missing'}`);
    if (audit.title) lines.push(`- Page title: "${audit.title}"`);
    if (audit.metaDescription == null) lines.push('- Meta description: missing');
    if (audit.cms) lines.push(`- Built on: ${audit.cms}`);

    const findings = this.findings(audit);
    if (findings.length) {
      lines.push('- Issues detected:');
      for (const f of findings.slice(0, 8)) {
        lines.push(`    • [${f.severity}] ${f.message}`);
      }
    }
    return lines.join('\n');
  }

  private findings(audit: WebsiteAudit): AuditFinding[] {
    const raw = audit.findings as unknown;
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).filter(
      (f): f is AuditFinding =>
        typeof f === 'object' && f != null && 'message' in f && 'severity' in f,
    );
  }
}
