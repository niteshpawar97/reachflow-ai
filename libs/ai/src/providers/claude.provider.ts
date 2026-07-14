import Anthropic from '@anthropic-ai/sdk';
import type { ProviderModelConfig } from '../ai.config';
import { estimateCostUsd } from '../ai.config';
import type { AiCompletionRequest, AiProvider, AiResult, AiTier } from '../ai.interface';

/** Anthropic Claude provider (pay-as-you-go; best quality for depth work). */
export class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  private client: Anthropic | null = null;

  constructor(private readonly config: ProviderModelConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  modelForTier(tier: AiTier): string {
    return this.config.models[tier];
  }

  private getClient(): Anthropic {
    if (!this.config.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    this.client ??= new Anthropic({ apiKey: this.config.apiKey });
    return this.client;
  }

  async complete(request: AiCompletionRequest): Promise<AiResult> {
    const model = request.model ?? this.modelForTier(request.tier ?? 'balanced');

    const message = await this.getClient().messages.create({
      model,
      max_tokens: request.maxTokens ?? 1024,
      ...(request.system ? { system: request.system } : {}),
      ...(request.temperature != null ? { temperature: request.temperature } : {}),
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;

    return {
      text,
      provider: this.name,
      model,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
      },
    };
  }
}
