import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { loadAiConfig, type AiConfig, type AiProviderName } from './ai.config';
import type { AiCompletionRequest, AiProvider, AiResult, AiTier } from './ai.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

/**
 * The single entry point every feature uses for AI. Resolves the active
 * provider from config (AI_PROVIDER), forwards completions, and logs
 * model/token/cost for every call. Boots fine with no key — `isEnabled()`
 * just returns false and calls throw a clear 503.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly config: AiConfig;
  private readonly providers: Record<Exclude<AiProviderName, 'none'>, AiProvider>;

  constructor() {
    this.config = loadAiConfig();
    this.providers = {
      gemini: new GeminiProvider(this.config.gemini),
      claude: new ClaudeProvider(this.config.claude),
    };

    if (!this.isEnabled()) {
      this.logger.warn(
        `AI disabled (AI_PROVIDER=${this.config.provider}). Set AI_PROVIDER + the matching API key to enable.`,
      );
    } else {
      this.logger.log(`AI enabled — provider=${this.activeProviderName()}`);
    }
  }

  activeProviderName(): AiProviderName {
    return this.config.provider;
  }

  /** True when a provider is selected AND has its credentials. */
  isEnabled(): boolean {
    const active = this.activeProvider();
    return active != null && active.isConfigured();
  }

  private activeProvider(): AiProvider | null {
    if (this.config.provider === 'none') return null;
    return this.providers[this.config.provider];
  }

  /** Which concrete model a tier resolves to right now (for previews/UI). */
  modelForTier(tier: AiTier): string | null {
    const active = this.activeProvider();
    return active ? active.modelForTier(tier) : null;
  }

  async complete(request: AiCompletionRequest): Promise<AiResult> {
    const active = this.activeProvider();
    if (!active) {
      throw new ServiceUnavailableException(
        'AI is not configured. Set AI_PROVIDER=gemini|claude and the matching API key.',
      );
    }
    if (!active.isConfigured()) {
      throw new ServiceUnavailableException(
        `AI provider "${active.name}" is selected but its API key is missing.`,
      );
    }

    const startedAt = Date.now();
    try {
      const result = await active.complete(request);
      this.logger.log(
        `ai ${result.provider}/${result.model} tier=${request.tier ?? 'balanced'} ` +
          `in=${result.usage.inputTokens} out=${result.usage.outputTokens} ` +
          `~$${result.usage.estimatedCostUsd.toFixed(6)} ${Date.now() - startedAt}ms`,
      );
      return result;
    } catch (e) {
      this.logger.error(
        `ai ${active.name} failed after ${Date.now() - startedAt}ms: ${
          e instanceof Error ? e.message : e
        }`,
      );
      throw e;
    }
  }

  /** Convenience one-shot: a system prompt + a single user message. */
  async generateText(
    userPrompt: string,
    opts: { system?: string; tier?: AiTier; maxTokens?: number; temperature?: number } = {},
  ): Promise<AiResult> {
    return this.complete({
      messages: [{ role: 'user', content: userPrompt }],
      system: opts.system,
      tier: opts.tier,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
    });
  }
}
