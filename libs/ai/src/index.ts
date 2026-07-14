// Provider-agnostic AI layer for ReachFlow. Features depend on this, not on a
// vendor SDK — so switching provider is an env change (AI_PROVIDER), not a rewrite.
export * from './ai.interface';
export {
  loadAiConfig,
  estimateCostUsd,
  MODEL_PRICING,
  type AiConfig,
  type AiProviderName,
  type ProviderModelConfig,
} from './ai.config';
export { AiService } from './ai.service';
export { AiModule } from './ai.module';
export { GeminiProvider } from './providers/gemini.provider';
export { ClaudeProvider } from './providers/claude.provider';
