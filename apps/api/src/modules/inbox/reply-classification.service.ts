import { Injectable, Logger } from '@nestjs/common';
import { ReplyClassification } from '@reachflow/database';
import { AiService } from '@reachflow/ai';

export interface ClassifyResult {
  classification: ReplyClassification;
  confidence: number;
  summary: string;
}

const VALID_LABELS = new Set<string>([
  'INTERESTED',
  'NOT_INTERESTED',
  'MEETING_REQUEST',
  'PRICING_QUESTION',
  'REFERRAL',
  'OUT_OF_OFFICE',
  'UNSUBSCRIBE_REQUEST',
  'SPAM',
  'OTHER',
]);

const CLASSIFY_SYSTEM = [
  'You classify a reply to a B2B cold outreach email. Read the reply and respond with ONLY',
  'compact JSON (no markdown fences, no prose) in this exact shape:',
  '{"label": "<one of INTERESTED|NOT_INTERESTED|MEETING_REQUEST|PRICING_QUESTION|REFERRAL|OUT_OF_OFFICE|UNSUBSCRIBE_REQUEST|SPAM|OTHER>", "confidence": <0-100 integer>, "summary": "<one short sentence>"}',
].join('\n');

const SUGGEST_SYSTEM = [
  'You draft a short, warm reply to a prospect who responded to a cold outreach email.',
  'Ground the reply in what they actually said. Plain text, 40-90 words, no signature,',
  'no "Best regards". One clear next step.',
].join('\n');

@Injectable()
export class ReplyClassificationService {
  private readonly logger = new Logger(ReplyClassificationService.name);

  constructor(private readonly ai: AiService) {}

  async classify(replyText: string, subject: string | null): Promise<ClassifyResult> {
    if (!this.ai.isEnabled()) {
      return { classification: ReplyClassification.OTHER, confidence: 0, summary: replyText.slice(0, 140) };
    }

    try {
      const result = await this.ai.generateText(
        `Subject: ${subject ?? '(no subject)'}\n\nReply:\n${replyText.slice(0, 3000)}`,
        { system: CLASSIFY_SYSTEM, tier: 'fast', maxTokens: 200, temperature: 0 },
      );
      const parsed = this.parseJson(result.text);
      if (parsed) return parsed;
    } catch (e) {
      this.logger.warn(`classification failed: ${e instanceof Error ? e.message : e}`);
    }
    return { classification: ReplyClassification.OTHER, confidence: 0, summary: replyText.slice(0, 140) };
  }

  async suggestReply(replyText: string, offerContext: string): Promise<string> {
    if (!this.ai.isEnabled()) {
      return '';
    }
    const result = await this.ai.generateText(
      `Our offer: ${offerContext}\n\nTheir reply:\n${replyText.slice(0, 3000)}`,
      { system: SUGGEST_SYSTEM, tier: 'balanced', maxTokens: 400, temperature: 0.6 },
    );
    return result.text.trim();
  }

  private parseJson(text: string): ClassifyResult | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const obj = JSON.parse(match[0]) as { label?: string; confidence?: number; summary?: string };
      const label = (obj.label ?? '').toUpperCase();
      if (!VALID_LABELS.has(label)) return null;
      return {
        classification: label as ReplyClassification,
        confidence: Math.max(0, Math.min(100, Math.round(obj.confidence ?? 50))),
        summary: (obj.summary ?? '').slice(0, 300) || 'No summary available',
      };
    } catch {
      return null;
    }
  }
}
