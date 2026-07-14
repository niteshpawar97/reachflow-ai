import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
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
  private readonly cache = new Map<string, { expiresAt: number; value: AiResult }>();
  private readonly inFlight = new Map<string, Promise<AiResult>>();

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

    const cacheKey = this.cacheKey(active.name, request);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.log(`ai cache hit ${active.name}/${request.tier ?? 'balanced'}`);
      return cached.value;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const startedAt = Date.now();
    const promise = this.callWithRetry(active, request)
      .then((result) => {
        this.logger.log(
          `ai ${result.provider}/${result.model} tier=${request.tier ?? 'balanced'} ` +
            `in=${result.usage.inputTokens} out=${result.usage.outputTokens} ` +
            `~$${result.usage.estimatedCostUsd.toFixed(6)} ${Date.now() - startedAt}ms`,
        );
        this.cache.set(cacheKey, {
          expiresAt: Date.now() + this.config.cacheTtlMs,
          value: result,
        });
        return result;
      })
      .catch((e) => {
        this.logger.error(
          `ai ${active.name} failed after ${Date.now() - startedAt}ms: ${
            e instanceof Error ? e.message : e
          }`,
        );
        throw e;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  async completeMany(
    requests: AiCompletionRequest[],
    opts: { concurrency?: number } = {},
  ): Promise<AiResult[]> {
    const concurrency = Math.max(1, opts.concurrency ?? 3);
    const results: AiResult[] = new Array(requests.length);
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= requests.length) {
          return;
        }
        results[currentIndex] = await this.complete(requests[currentIndex]!);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, () => worker()));
    return results;
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

  /** Retry a provider call on transient errors (overload/rate-limit) with
   * exponential backoff. Free tiers 503/429 intermittently. */
  private async callWithRetry(
    provider: AiProvider,
    request: AiCompletionRequest,
  ): Promise<AiResult> {
    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await provider.complete(request);
      } catch (e) {
        lastErr = e;
        if (attempt >= maxAttempts || !this.isTransient(e)) throw e;
        const delayMs = 800 * 2 ** (attempt - 1); // 800ms, 1600ms
        this.logger.warn(
          `ai ${provider.name} transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastErr;
  }

  private isTransient(e: unknown): boolean {
    const status = (e as { status?: number })?.status;
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) {
      return true;
    }
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    return (
      msg.includes('overloaded') ||
      msg.includes('unavailable') ||
      msg.includes('high demand') ||
      msg.includes('rate limit')
    );
  }

  private cacheKey(provider: string, request: AiCompletionRequest): string {
    const fingerprint = JSON.stringify({
      provider,
      tier: request.tier ?? 'balanced',
      system: request.system ?? '',
      messages: request.messages,
      maxTokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? null,
      thinking: request.thinking ?? false,
      model: request.model ?? '',
    });
    return createHash('sha256').update(fingerprint).digest('hex');
  }
}
