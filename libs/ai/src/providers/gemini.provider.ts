import { GoogleGenAI } from '@google/genai';
import type { ProviderModelConfig } from '../ai.config';
import { estimateCostUsd } from '../ai.config';
import type { AiCompletionRequest, AiProvider, AiResult, AiTier } from '../ai.interface';

/** Google Gemini provider (has a genuinely free AI Studio tier). */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private client: GoogleGenAI | null = null;

  constructor(private readonly config: ProviderModelConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  modelForTier(tier: AiTier): string {
    return this.config.models[tier];
  }

  private getClient(): GoogleGenAI {
    if (!this.config.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    this.client ??= new GoogleGenAI({ apiKey: this.config.apiKey });
    return this.client;
  }

  async complete(request: AiCompletionRequest): Promise<AiResult> {
    const model = request.model ?? this.modelForTier(request.tier ?? 'balanced');
    // Gemini uses 'model' for the assistant role.
    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await this.getClient().models.generateContent({
      model,
      contents,
      config: {
        ...(request.system ? { systemInstruction: request.system } : {}),
        ...(request.temperature != null ? { temperature: request.temperature } : {}),
        maxOutputTokens: request.maxTokens ?? 1024,
        // -1 = dynamic thinking; 0 = off. Off by default so thinking tokens
        // don't consume the answer budget (Gemini 3.x flash gotcha).
        thinkingConfig: { thinkingBudget: request.thinking ? -1 : 0 },
      },
    });

    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      text: response.text ?? '',
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
