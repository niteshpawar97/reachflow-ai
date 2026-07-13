# ReachFlow AI — AI Architecture

> Phase 9 deliverable. How intelligence is built, governed, and kept cheap + trustworthy.
> Provider: **Anthropic Claude**. Load the `claude-api` skill before writing any AI code.

## 1. Model tiering (cost + quality)
| Tier | Model | Used for |
|------|-------|----------|
| **Volume / cheap** | **Claude Haiku 4.5** | reply classification, quick drafts, short summaries, extraction, verification triage |
| **Depth / reasoning** | **Claude Opus 4.8** | website-audit narrative, proposals, sales scripts, nuanced personalization, risk analysis |
| (optional mid) | Sonnet-class | batch personalization if a middle cost/quality point is wanted |

Route by task, not by default-to-biggest. Every call logs model + tokens + cost in `ai_generations`.

## 2. Core AI capabilities (per Module 19)

### a) Lead scoring (assist) — `M7`
- **Deterministic core** (weighted factors: audit quality, size, industry fit, tech signals, hiring/growth) →
  base 0–100. **AI pass** only to resolve ambiguity / extract soft signals from unstructured text.
- Output: `{ score, fit, intent, confidence, factors[] }`. Explainable (reason codes), auditable.
- Cheap: mostly rules; AI optional. No hallucinated scores — AI adjusts within bounded ranges.

### b) Website analysis → AI audit — `M4`
- Pipeline collects **facts** (speed, HTTPS, SEO, CTA, mobile, tech, broken links). AI **only narrates
  facts it's given** into a client-facing audit ("what's wrong, why it costs money, the opportunity").
- **Grounding rule:** prompt includes the structured findings; model must not invent metrics.
- Output: prioritized issues + opportunity framing → fuels personalization.

### c) Email personalization — `M8`
- Input: audit facts + score + firmographics + **selected offer** (which service we sell).
- Output: subject, opener, site observation, opportunity, pain point, CTA — **unique per lead**.
- **Anti-hallucination:** every specific claim must trace to a provided fact; a validator lints output for
  unsupported specifics + spam-trigger words + length. Human approves before send (MVP).

### d) Reply classification + suggestion — `M11`
- Haiku classifies inbound into {interested, meeting, pricing, spam, referral, not_interested, other} +
  confidence + 1-line summary. Then generates a **suggested reply** grounded in thread context + our offer.
- Low-confidence → surfaced for human; never auto-sends at MVP.

### e) Follow-up generation — `M10`
- Given prior thread + trigger (no-reply/opened/etc.), draft the next step; respects tone + stop conditions.

### f) Proposal generation — `M14` *(later)*
- Opus drafts scope/pricing/timeline/milestones from deal context + service catalog. Human edits → PDF.
- Guardrails: pricing pulled from our catalog, not invented; clear "draft — review" state.

### g) Sales scripts / meeting notes / risk analysis — `M19` *(later)*
- Scripts for calls; summarize meetings; **risk detection** flags low-fit/time-wasting/non-paying signals from replies.

### h) CRM intelligence *(later)*
- Deal summaries, next-best-action suggestions, stale-deal nudges from activity history.

## 3. Prompt architecture
- **Prompt templates as versioned code** (`libs/ai/prompts/*`), not inline strings. Each has: system role,
  input schema, output schema (JSON), few-shot examples, version tag.
- **Structured output:** request JSON conforming to a Zod schema; validate + repair-once on parse failure.
- **Context assembly:** a builder gathers only the needed facts (audit, firmographics, offer, thread) —
  minimal tokens, maximal grounding.
- **Prompt caching:** cache stable system+offer+catalog prefixes across many leads to cut cost/latency.

## 4. Reliability & safety
- **Grounding/anti-hallucination:** claims must map to provided facts; post-gen validator rejects unsupported specifics.
- **Human-in-the-loop gates** on anything outbound (personalization approve, reply suggest) at MVP.
- **Determinism where it matters:** scoring core is rules-based; AI is assistive, bounded, explainable.
- **Fallbacks:** on model error/timeout → retry with backoff → fall back to a safe template + flag for human.
- **Idempotency:** dedupe AI jobs by (feature, ref) so retries don't double-spend.
- **PII discipline:** minimize PII in prompts; never log full prompt bodies with PII at info level.

## 5. Cost governance
- **Per-workspace token budgets** + alerts; hard stop / degrade-to-cheaper-tier on breach.
- **Every generation logged** (`ai_generations`: model, tokens, cost, latency, feature) → cost dashboard.
- **Batching** personalization jobs; **caching** audits (per domain) + prompt prefixes.
- **Tier routing** keeps 80% of volume on Haiku; Opus reserved for high-value depth.
- Track **AI cost per booked meeting** as the real efficiency metric.

## 6. Execution flow (where AI runs)
- All AI runs in the **`ai-jobs` BullMQ worker**, never inline in the API request path.
- Trigger → enqueue → worker builds context → calls Claude (tiered) → validates output → persists →
  emits event / updates UI via job status. Retries + DLQ on failure.

## 7. Data flywheel (the compounding moat)
- Capture outcomes: which personalizations got replies, which classifications were corrected by the human,
  which audits converted. Store as labeled data.
- Use it to: refine prompts + few-shots, tune scoring weights, and (later) fine-tune/eval smaller models for
  classification. **The moat is accumulated, labeled outcome data + prompt playbooks — not the base model.**

## 8. Evaluation
- **Offline evals** per feature: golden sets for classification accuracy, personalization approval rate,
  audit factual-grounding (no invented metrics), scoring correlation with actual replies.
- **Online:** track approval rate, reply lift vs. control, classification correction rate.
- Gate prompt/model changes behind eval regression checks before rollout.

## 9. Build order for AI (aligned to MVP)
1. Website-audit summary (grounded) → 2. Personalization (grounded + validator + approval UI) →
3. Reply classification (Haiku) → 4. Suggested reply → 5. Follow-up drafts → *(later)* proposals, scripts,
risk, CRM intelligence.
