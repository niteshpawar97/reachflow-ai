import { BadRequestException, Injectable } from '@nestjs/common';
import type { Company, Contact, LeadScore, WebsiteAudit } from '@reachflow/database';
import { AiService } from '@reachflow/ai';

interface AuditFinding {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  provider: string;
  model: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface PersonalizationItem {
  company: Company;
  contact: Contact | null;
  audit: WebsiteAudit | null;
  score: LeadScore | null;
}

/**
 * Who the email is from. For now a sensible default matching ReachFlow's ICP
 * (selling dev/AI services internationally). Later this can come from workspace
 * settings so each tenant pitches their own offer.
 */
const SENDER_PROFILE =
  'a software & AI development agency that builds custom websites, web apps, ' +
  'AI automation, CRM/ERP systems, and mobile apps for international clients';

const SYSTEM_PROMPT = [
  `You are an expert B2B cold-email copywriter for ${SENDER_PROFILE}.`,
  'Write a short, highly personalized cold email to the prospect below.',
  'Rules:',
  '- Ground every claim in the specific website findings provided. Never invent facts.',
  '- Lead with a concrete observation about THEIR website (the hook).',
  '- Tie that observation to a business cost, then to how we can help.',
  '- 60–110 words. Plain, human, confident. No hype, no buzzwords, no fake flattery.',
  '- One clear CTA: a short call. No pushy language.',
  '- No greeting line with a placeholder if the name is unknown — open with the hook.',
  '- Do NOT include a signature or "Best regards"; the sender is appended separately.',
  'Output EXACTLY in this format and nothing else:',
  'Subject: <one compelling subject line, under 60 chars>',
  '',
  '<email body>',
].join('\n');

const FOLLOWUP_SYSTEM = [
  `You are an expert B2B cold-email copywriter for ${SENDER_PROFILE}.`,
  'Write a SHORT follow-up to a prospect who did not reply to earlier outreach.',
  'Rules:',
  '- Ground every claim in the website findings provided. Never invent facts.',
  '- 40–70 words. Warm, brief, respectful of their time.',
  '- Add one new angle or piece of value — do not just repeat the first email.',
  '- One light, specific CTA. No guilt-tripping, no "just following up".',
  '- No signature or "Best regards" — the sender is appended separately.',
  'Output EXACTLY in this format and nothing else:',
  'Subject: <short subject, under 60 chars>',
  '',
  '<email body>',
].join('\n');

// Distinct framings so A/B variants differ meaningfully (not just reworded).
const VARIANT_ANGLES = [
  'the site speed / performance-loss angle',
  'the mobile-experience / lost-mobile-customers angle',
  'the lead-capture / missing contact-form or CTA conversion angle',
  'the trust / first-impression / credibility angle',
];

const SPAM_WORDS = [
  'guarantee',
  'guaranteed',
  'free money',
  'act now',
  'limited time',
  'winner',
  'click here',
  'buy now',
  'urgent',
  'risk free',
];

interface DraftValidationResult {
  ok: boolean;
  reasons: string[];
}

@Injectable()
export class PersonalizationService {
  constructor(private readonly ai: AiService) {}

  /** Whether AI generation is currently available (provider + key configured). */
  isEnabled(): boolean {
    return this.ai.isEnabled();
  }

  async generate(
    company: Company,
    contact: Contact | null,
    audit: WebsiteAudit | null,
    score: LeadScore | null,
  ): Promise<GeneratedEmail> {
    const drafts = await this.generateMany([{ company, contact, audit, score }]);
    const result = drafts[0];
    if (!result) {
      throw new BadRequestException('No AI draft was generated');
    }
    return result;
  }

  async generateMany(items: PersonalizationItem[]): Promise<GeneratedEmail[]> {
    if (items.length === 0) {
      return [];
    }

    const firstPass = await this.ai.completeMany(
      items.map((item) => ({
        messages: [{ role: 'user', content: this.buildFacts(item.company, item.contact, item.audit, item.score) }],
        system: SYSTEM_PROMPT,
        tier: 'balanced',
        maxTokens: 600,
        temperature: 0.8,
      })),
    );

    const results: GeneratedEmail[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]!;
      const first = firstPass[index]!;
      let chosen = first;
      const validation = this.validateDraft(first.text);

      if (!validation.ok) {
        const retry = await this.ai.generateText(this.buildFacts(item.company, item.contact, item.audit, item.score), {
          system: `${SYSTEM_PROMPT}\n\nIf any draft line is speculative, remove it. Do not add claims not present in the evidence.`,
          tier: 'balanced',
          maxTokens: 600,
          temperature: 0.4,
        });
        const retryValidation = this.validateDraft(retry.text);
        if (retryValidation.ok) {
          chosen = retry;
        } else {
          throw new BadRequestException(
            `AI draft failed validation after retry: ${Array.from(new Set([...validation.reasons, ...retryValidation.reasons])).join('; ')}`,
          );
        }
      }

      const { subject, body } = this.parse(chosen.text);
      results.push({
        subject,
        body,
        provider: chosen.provider,
        model: chosen.model,
        tier: 'balanced',
        inputTokens: chosen.usage.inputTokens,
        outputTokens: chosen.usage.outputTokens,
        costUsd: chosen.usage.estimatedCostUsd,
      });
    }

    return results;
  }

  /** Generate a short follow-up that references prior (unanswered) outreach and
   * adds one new angle. Follow-ups are intentionally shorter than the opener. */
  async generateFollowUp(
    company: Company,
    contact: Contact | null,
    audit: WebsiteAudit | null,
    score: LeadScore | null,
    previous: Array<{ subject: string; body: string }>,
    sequenceIndex: number,
  ): Promise<GeneratedEmail> {
    const priorText = previous
      .map((p, i) => `Message ${i + 1}:\nSubject: ${p.subject}\n${p.body}`)
      .join('\n\n');

    const userPrompt = [
      this.buildFacts(company, contact, audit, score),
      '',
      'Earlier outreach that received NO reply:',
      priorText || '(none on record)',
      '',
      `Write follow-up #${sequenceIndex}. Briefly reference the earlier note, add ONE`,
      'new angle or piece of value, and keep it very short (40–70 words). Friendly,',
      'no guilt-tripping, no "just bumping this". End with a light, specific CTA.',
    ].join('\n');

    const result = await this.ai.generateText(userPrompt, {
      system: FOLLOWUP_SYSTEM,
      tier: 'balanced',
      maxTokens: 400,
      temperature: 0.75,
    });

    const { subject, body } = this.parse(result.text);
    return {
      subject,
      body,
      provider: result.provider,
      model: result.model,
      tier: 'balanced',
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.estimatedCostUsd,
    };
  }

  /** Generate `count` distinct opener variants (A/B testing), each taking a
   * different angle so their prompt fingerprints — and outputs — differ. */
  async generateVariants(
    company: Company,
    contact: Contact | null,
    audit: WebsiteAudit | null,
    score: LeadScore | null,
    count: number,
  ): Promise<GeneratedEmail[]> {
    const angles = VARIANT_ANGLES.slice(0, Math.max(1, Math.min(count, VARIANT_ANGLES.length)));
    const facts = this.buildFacts(company, contact, audit, score);

    const raw = await this.ai.completeMany(
      angles.map((angle) => ({
        messages: [
          {
            role: 'user' as const,
            content: `${facts}\n\nAngle for THIS variant: ${angle}. Make it distinctly different in hook and framing from other possible angles.`,
          },
        ],
        system: SYSTEM_PROMPT,
        tier: 'balanced' as const,
        maxTokens: 600,
        temperature: 0.9,
      })),
    );

    return raw.map((r) => {
      const { subject, body } = this.parse(r.text);
      return {
        subject,
        body,
        provider: r.provider,
        model: r.model,
        tier: 'balanced',
        inputTokens: r.usage.inputTokens,
        outputTokens: r.usage.outputTokens,
        costUsd: r.usage.estimatedCostUsd,
      };
    });
  }

  /** Assemble the grounded, human-readable fact sheet the model writes from. */
  private buildFacts(
    company: Company,
    contact: Contact | null,
    audit: WebsiteAudit | null,
    score: LeadScore | null,
  ): string {
    const lines: string[] = [];
    lines.push(`Company: ${company.name}`);
    if (company.industry) lines.push(`Industry: ${company.industry}`);
    if (company.city || company.country) {
      lines.push(`Location: ${[company.city, company.country].filter(Boolean).join(', ')}`);
    }
    if (company.website || company.domain) {
      lines.push(`Website: ${company.website ?? company.domain}`);
    }

    if (contact) {
      const who = [contact.name, contact.title].filter(Boolean).join(', ');
      if (who) lines.push(`Contact: ${who}`);
    }

    if (audit) {
      lines.push('');
      lines.push('Website audit findings (the evidence to personalize from):');
      if (audit.performanceScore != null) {
        lines.push(`- Performance score: ${audit.performanceScore}/100`);
      }
      if (audit.responseTimeMs != null) {
        lines.push(`- Page load time: ${(audit.responseTimeMs / 1000).toFixed(1)}s`);
      }
      lines.push(`- Mobile friendly: ${audit.mobileFriendly ? 'yes' : 'no'}`);
      lines.push(`- HTTPS/secure: ${audit.https ? 'yes' : 'no'}`);
      lines.push(`- Contact form present: ${audit.hasContactForm ? 'yes' : 'no'}`);
      lines.push(`- Clear call-to-action: ${audit.hasCta ? 'yes' : 'no'}`);
      if (audit.cms) lines.push(`- Built on: ${audit.cms}`);

      const findings = this.findings(audit);
      if (findings.length) {
        lines.push('- Issues detected:');
        for (const f of findings.slice(0, 6)) {
          lines.push(`    • [${f.severity}] ${f.message}`);
        }
      }
    } else {
      lines.push('');
      lines.push('No website audit available — personalize from the company profile only.');
    }

    if (score) {
      lines.push('');
      lines.push(`Lead score: ${score.score}/100 (fit ${score.fitScore}, opportunity ${score.intentScore}).`);
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

  /** Split the model output into subject + body, tolerating minor drift. */
  private parse(text: string): { subject: string; body: string } {
    const trimmed = text.trim();
    const match = trimmed.match(/^subject:\s*(.+?)\s*(?:\n|$)/i);
    if (match) {
      const subject = match[1]!.trim();
      const body = trimmed.slice(match[0].length).trim();
      return { subject, body: body || subject };
    }
    // Fallback: first non-empty line is the subject, the rest is the body.
    const parts = trimmed.split('\n');
    const subject = (parts.shift() ?? 'Quick idea for your website').trim();
    return { subject, body: parts.join('\n').trim() || trimmed };
  }

  private validateDraft(text: string): DraftValidationResult {
    const trimmed = text.trim();
    const { subject, body } = this.parse(trimmed);
    const reasons: string[] = [];

    const subjectWords = subject.split(/\s+/).filter(Boolean).length;
    const bodyWords = body.split(/\s+/).filter(Boolean).length;

    if (subject.length > 60) {
      reasons.push('subject exceeds 60 characters');
    }
    if (subjectWords < 2) {
      reasons.push('subject is too short');
    }
    if (bodyWords < 60 || bodyWords > 110) {
      reasons.push(`body is outside 60-110 words (${bodyWords})`);
    }

    const haystack = `${subject} ${body}`.toLowerCase();
    for (const word of SPAM_WORDS) {
      if (haystack.includes(word)) {
        reasons.push(`contains spam phrase: ${word}`);
      }
    }

    if (/\b(best regards|kind regards|sincerely)\b/i.test(trimmed)) {
      reasons.push('contains a forbidden signature line');
    }

    if (!/\bwebsite\b|\bmobile\b|\bload\b|\bperformance\b|\bcontact\b|\bCTA\b/i.test(trimmed)) {
      reasons.push('missing a grounded website observation');
    }

    return { ok: reasons.length === 0, reasons };
  }
}
