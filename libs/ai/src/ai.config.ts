import type { AiTier } from './ai.interface';

/** Which vendor is live. `none` = AI features disabled (no key yet). */
export type AiProviderName = 'gemini' | 'claude' | 'none';

export interface ProviderModelConfig {
  apiKey?: string;
  models: Record<AiTier, string>;
}

export interface AiConfig {
  provider: AiProviderName;
  gemini: ProviderModelConfig;
  claude: ProviderModelConfig;
}

// Sensible defaults per vendor. Override any of these via env if needed.
const GEMINI_DEFAULTS: Record<AiTier, string> = {
  fast: 'gemini-2.5-flash',
  balanced: 'gemini-2.5-flash',
  deep: 'gemini-2.5-pro',
};

const CLAUDE_DEFAULTS: Record<AiTier, string> = {
  fast: 'claude-haiku-4-5',
  balanced: 'claude-haiku-4-5',
  deep: 'claude-opus-4-8',
};

function normalizeProvider(raw: string | undefined): AiProviderName {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'gemini' || v === 'google') return 'gemini';
  if (v === 'claude' || v === 'anthropic') return 'claude';
  return 'none';
}

/** Build AiConfig from environment. Pure/testable — pass a custom env for tests. */
export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  return {
    provider: normalizeProvider(env.AI_PROVIDER),
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      models: {
        fast: env.GEMINI_MODEL_FAST ?? GEMINI_DEFAULTS.fast,
        balanced: env.GEMINI_MODEL_BALANCED ?? GEMINI_DEFAULTS.balanced,
        deep: env.GEMINI_MODEL_DEEP ?? GEMINI_DEFAULTS.deep,
      },
    },
    claude: {
      apiKey: env.ANTHROPIC_API_KEY,
      models: {
        fast: env.CLAUDE_MODEL_FAST ?? CLAUDE_DEFAULTS.fast,
        balanced: env.CLAUDE_MODEL_BALANCED ?? CLAUDE_DEFAULTS.balanced,
        deep: env.CLAUDE_MODEL_DEEP ?? CLAUDE_DEFAULTS.deep,
      },
    },
  };
}

/**
 * Approximate USD price per 1M tokens, for cost logging only. Free tiers
 * (e.g. Gemini AI Studio) bill nothing in practice — these are the paid rates.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICING[model];
  if (!price) return 0;
  const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6 dp
}
