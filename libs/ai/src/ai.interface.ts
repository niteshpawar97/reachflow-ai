/**
 * Provider-agnostic AI contract. Every ReachFlow AI feature (personalization,
 * audit summaries, reply classification, proposals) talks to THIS interface —
 * never to a vendor SDK directly. Swapping Gemini <-> Claude is then a config
 * change (AI_PROVIDER env var), not a code change.
 */

/**
 * Quality/cost tier. Each provider maps a tier to one of its concrete models,
 * so feature code asks for `deep` (a proposal) or `fast` (bulk classify)
 * without knowing which vendor/model is active.
 */
export type AiTier = 'fast' | 'balanced' | 'deep';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  /** Tier -> concrete model, resolved per provider. Defaults to 'balanced'. */
  tier?: AiTier;
  /** System / instruction prompt (persona, rules, output format). */
  system?: string;
  /** Conversation. For a one-shot call, pass a single user message. */
  messages: AiMessage[];
  maxTokens?: number;
  /** 0 = deterministic, ~1 = creative. Defaults per call site. */
  temperature?: number;
  /**
   * Let the model reason internally before answering. Off by default — cheaper,
   * faster, and it stops "thinking" tokens from eating the output budget (a real
   * gotcha on Gemini 3.x flash). Turn on for genuinely hard tasks (proposals).
   */
  thinking?: boolean;
  /** Force a specific vendor model id, bypassing tier mapping (advanced). */
  model?: string;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  /** Best-effort estimate from a static price table; free tiers report ~0. */
  estimatedCostUsd: number;
}

export interface AiResult {
  text: string;
  provider: string;
  model: string;
  usage: AiUsage;
}

/** A pluggable model vendor (Gemini, Claude, ...). */
export interface AiProvider {
  readonly name: string;
  /** True when this provider has the credentials it needs to run. */
  isConfigured(): boolean;
  /** Resolve a tier to this provider's concrete model id. */
  modelForTier(tier: AiTier): string;
  complete(request: AiCompletionRequest): Promise<AiResult>;
}
