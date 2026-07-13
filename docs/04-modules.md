# ReachFlow AI — Module Design

> Phase 5 deliverable. The 20 modules from the master spec, each specified. Format per module:
> Purpose · Responsibilities · Inputs · Outputs · Dependencies · Tables · Endpoints · Edge cases ·
> Validation · Errors · Scalability. **[MVP]** = money-path first; **[Later]** = post-revenue.

---

## M1 — Authentication **[MVP: minimal]**
- **Purpose:** Secure access; RBAC seam for future team/SaaS.
- **Responsibilities:** register, login, Google OAuth, email verify, OTP, forgot/reset, JWT issue/refresh, roles (Admin/Staff/Client).
- **Inputs:** credentials, OAuth callbacks, OTP codes. **Outputs:** JWT access+refresh, user session.
- **Dependencies:** none (foundational). **Tables:** `users`, `sessions`, `otp_codes`, `password_resets`.
- **Endpoints:** `/auth/register|login|google|verify-email|otp|forgot|reset|refresh|logout`.
- **Edge cases:** duplicate email, unverified login, expired/replayed OTP, refresh reuse (rotate + revoke).
- **Validation:** email format, password strength, OTP TTL. **Errors:** 401/409/429 (rate-limited).
- **Scalability:** stateless JWT; sessions in Postgres/Redis. MVP ships login + Google + refresh; OTP later.

## M2 — Workspace **[MVP: single workspace]**
- **Purpose:** Container/tenant boundary for all data.
- **Responsibilities:** create/manage workspace, settings, members (later), usage counters; inject `workspace_id`.
- **Inputs:** settings, invites (later). **Outputs:** workspace context, usage stats.
- **Dependencies:** M1. **Tables:** `workspaces`, `workspace_members`, `workspace_settings`, `usage_counters`.
- **Endpoints:** `/workspaces`, `/workspaces/:id/settings`, `/workspaces/:id/members`.
- **Edge cases:** last-admin removal, over-quota, cross-workspace data leak (guard every query).
- **Validation:** unique slug, role enums. **Errors:** 403 cross-tenant, 409 quota.
- **Scalability:** `workspace_id` indexed on every table now → clean multi-tenancy later.

## M3 — Lead Finder / Scraper **[MVP: thin]**
- **Purpose:** Discover candidate companies + basic firmographics.
- **Responsibilities:** run source adapters (MVP: **Google Maps + company-website crawl**; later: Clutch,
  Crunchbase, BuiltWith, YellowPages, directories, LinkedIn[high-risk/deferred]), dedupe, persist raw + normalized.
- **Inputs:** search query (industry, geo, keywords), seed URLs, CSV import. **Outputs:** `leads` + `companies` rows, raw JSONB.
- **Dependencies:** scraping lib, proxy mgr, queue. **Tables:** `companies`, `leads`, `scrape_jobs`, `scrape_sources`.
- **Endpoints:** `/leads/import`, `/lead-finder/search`, `/lead-finder/jobs/:id`.
- **Edge cases:** blocked/captcha, proxy ban, partial data, duplicates across sources, rate limits, robots/ToS.
- **Validation:** query sanity, geo/industry enums, CSV schema. **Errors:** 422 bad CSV, job-level partial-fail.
- **Scalability:** isolated queue, per-domain concurrency caps, resumable jobs; source adapters pluggable.
- **Legal note:** prefer public data + own crawl; LinkedIn scraping deferred (ToS/legal heat).

## M4 — Website Analyzer **[MVP]**
- **Purpose:** Turn each company site into evidence for personalization + scoring (our wedge).
- **Responsibilities:** check HTTPS/SSL, page speed, SEO basics, broken links, mobile-friendliness, contact
  form/CTA presence, accessibility, tech stack/CMS/hosting, performance score → **AI audit summary**.
- **Inputs:** website URL. **Outputs:** `website_audits` row (structured findings JSONB + score + AI summary).
- **Dependencies:** scraper (headless), ai-jobs. **Tables:** `website_audits`.
- **Endpoints:** `/leads/:id/audit`, `/audits/:id`.
- **Edge cases:** JS-heavy sites, timeouts, no site, redirects/parking pages, huge pages.
- **Validation:** URL reachable, size caps. **Errors:** partial audit with `status=partial`.
- **Scalability:** cache by domain (TTL), reuse across leads sharing a domain.

## M5 — Decision Maker Finder **[Later]**
- **Purpose:** Find the right human (founder/CEO/owner/director/marketing/IT/ops).
- **Responsibilities:** derive name/role/email/LinkedIn from site + enrichment; guess+verify email patterns.
- **Inputs:** company/domain. **Outputs:** `contacts` linked to company, confidence score.
- **Dependencies:** M6 (verify), enrichment. **Tables:** `contacts`.
- **Endpoints:** `/companies/:id/contacts`, `/contacts/:id/verify`.
- **Edge cases:** multiple candidates, role ambiguity, generic inboxes (info@), privacy laws.
- **Validation:** email pattern + verify before use. **Errors:** low-confidence flagged, never auto-sent.
- **Scalability:** pattern cache per domain.

## M6 — Email Verification **[MVP]**
- **Purpose:** Protect deliverability — only valid emails enter campaigns.
- **Responsibilities:** MX lookup, SMTP handshake (RCPT), disposable check, catch-all detection, risk score.
- **Inputs:** email. **Outputs:** `email_verifications` (status: valid/invalid/risky/catch-all + score).
- **Dependencies:** DNS/SMTP or 3rd-party API (open decision). **Tables:** `email_verifications`.
- **Endpoints:** `/emails/verify`, `/emails/:hash/verification`.
- **Edge cases:** greylisting, catch-all ambiguity, timeouts, our verifier IP getting blocked.
- **Validation:** syntax pre-check. **Errors:** `unknown` on timeout → retry policy.
- **Scalability:** cache by email hash; batch; rate-limit SMTP probes to avoid blocks.

## M7 — Lead Scoring **[MVP]**
- **Purpose:** Prioritize who to contact — fit × intent, 0–100.
- **Responsibilities:** combine website audit, firmographics (size/industry/tech), hiring/growth signals →
  weighted score + reason codes; AI adjusts on ambiguity.
- **Inputs:** company, audit, signals. **Outputs:** `lead_scores` (score + factor breakdown JSONB).
- **Dependencies:** M4, M3, ai-jobs. **Tables:** `lead_scores`.
- **Endpoints:** `/leads/:id/score`, `/leads?minScore=`.
- **Edge cases:** missing data → confidence-weighted score, not zero. **Validation:** 0–100 clamp.
- **Errors:** score with `confidence` field. **Scalability:** deterministic core + optional AI pass; cacheable.

## M8 — AI Personalization **[MVP]**
- **Purpose:** Unique, evidence-based email content per lead (no templates).
- **Responsibilities:** generate subject, opener, site observation, business opportunity, pain point, CTA,
  matched to the service we're selling.
- **Inputs:** lead + audit + score + selected offer. **Outputs:** `personalizations` (fields + model/cost meta).
- **Dependencies:** ai-jobs (Claude), M4/M7. **Tables:** `personalizations`.
- **Endpoints:** `/leads/:id/personalize`, `/personalizations/:id` (edit/approve).
- **Edge cases:** thin audit → fallback angle; hallucinated claims → ground strictly in audit facts; language/locale.
- **Validation:** required fields present, length/spam-word lint, factual grounding check.
- **Errors:** regenerate; human-approve gate before send. **Scalability:** dedupe per (lead,campaign,step); cache.

## M9 — Campaign Builder **[MVP]**
- **Purpose:** Define and run sequenced outreach across mailboxes.
- **Responsibilities:** multi-step sequences, multi-sender rotation, A/B (later), random intervals, timezone
  scheduling, conditions, daily limits, **stop-on-reply/unsub**.
- **Inputs:** leads, sequence steps, mailboxes, schedule. **Outputs:** `campaigns`, `campaign_steps`, queued sends.
- **Dependencies:** M2, mailboxes, M8, scheduler, sender. **Tables:** `campaigns`, `campaign_steps`,
  `campaign_leads`, `sequence_conditions`.
- **Endpoints:** `/campaigns` CRUD, `/campaigns/:id/launch|pause|leads|steps`.
- **Edge cases:** mailbox goes unhealthy mid-run, cap exhaustion, timezone/DST, duplicate lead across campaigns,
  suppression added mid-run.
- **Validation:** ≥1 healthy mailbox, valid schedule, cap sanity. **Errors:** launch blocked with reasons.
- **Scalability:** scheduler dispatches due sends in batches; sender workers scale horizontally.

## M10 — Follow-up Engine **[MVP]**
- **Purpose:** Automated, trigger-based AI follow-ups.
- **Responsibilities:** triggers (reply/no-reply/opened/clicked/bounced/unsub) drive next step; generate 4–8
  follow-ups; respect stop conditions.
- **Inputs:** engagement events, sequence. **Outputs:** queued follow-up sends.
- **Dependencies:** M9, event tracking, ai-jobs. **Tables:** `email_events`, reuses `campaign_steps`.
- **Edge cases:** reply after follow-up already queued (cancel), open-tracking unreliable, over-follow-up.
- **Validation:** max steps, min gap. **Errors:** idempotent cancel on reply. **Scalability:** event-driven via queue.

## M11 — Unified Inbox **[MVP]**
- **Purpose:** One place for all replies + AI triage.
- **Responsibilities:** IMAP sync across mailboxes, thread stitching, **AI classify** (interested/meeting/
  pricing/spam/referral/not-interested), conversation summary, suggested reply, send reply.
- **Inputs:** IMAP messages. **Outputs:** `messages`, `threads`, `reply_classifications`.
- **Dependencies:** email adapters, ai-jobs. **Tables:** `threads`, `messages`, `reply_classifications`.
- **Endpoints:** `/inbox`, `/threads/:id`, `/threads/:id/reply`, `/threads/:id/classify`.
- **Edge cases:** threading across aliases, auto-responders/OOO, spoofing, dedupe, large attachments.
- **Validation:** signed unsub/reply tokens. **Errors:** classification `confidence`; human override.
- **Scalability:** incremental IMAP sync (UIDVALIDITY), per-mailbox cursors.

## M12 — Meeting Booking **[Later]**
- **Purpose:** Convert interest → booked calls.
- **Responsibilities:** calendar integration, booking links, reminders, meeting analytics.
- **Tables:** `meetings`, `availability`. **Endpoints:** `/meetings`, `/booking/:slug`.
- **Edge cases:** timezones, double-booking, no-shows, cancellations. **Scalability:** later; Cal.com option.

## M13 — CRM **[MVP: lite]**
- **Purpose:** Track deals from lead → won/lost.
- **Responsibilities:** pipeline stages, activity timeline, notes, link email/meeting/proposal to deal.
- **Inputs:** stage changes, activities. **Outputs:** `deals`, `activities`.
- **Dependencies:** M9/M11/M12/M14. **Tables:** `deals`, `activities`, `pipeline_stages`.
- **Endpoints:** `/deals` CRUD, `/deals/:id/stage|activities`.
- **Edge cases:** stage regressions, duplicate deals per lead, reopen won/lost. **Validation:** stage enum.
- **Scalability:** activity log append-only; indexes on (workspace_id, stage).

## M14 — Proposal Generator **[Later]**
- **Purpose:** AI proposals for the exact service being sold (close faster).
- **Responsibilities:** generate scope/pricing/timeline/milestones, PDF export, e-signature.
- **Tables:** `proposals`, `proposal_signatures`. **Endpoints:** `/proposals`, `/proposals/:id/pdf|sign`.
- **Edge cases:** pricing errors, signature legality, versioning. **Scalability:** PDF render async → object storage.

## M15 — Analytics Dashboard **[MVP: core, then deep]**
- **Purpose:** Decision-grade visibility.
- **Responsibilities:** sent/delivered/open/reply/meetings/revenue/bounce, domain & mailbox health, funnel.
- **Inputs:** events, deals. **Outputs:** aggregates/materialized views.
- **Dependencies:** all event producers. **Tables:** `email_events`, materialized aggregates.
- **Endpoints:** `/analytics/overview|campaigns/:id|deliverability|funnel`.
- **Edge cases:** open-tracking inflation, timezone rollups, large ranges. **Scalability:** rollup tables + Redis cache.

## M16 — Admin Panel **[Later]**
- **Purpose:** Operate the platform (mostly SaaS-phase).
- **Responsibilities:** manage users/campaigns/domains/mailboxes/credits/logs/payments/subscriptions/permissions.
- **Tables:** `plans`, `subscriptions`, `credits`, `invoices`, `audit_logs`. **Endpoints:** `/admin/*`.
- **Scalability:** read-heavy; guard behind Admin role. Mostly deferred to productization.

## M17 — Security **[MVP: core, then full]**
- **Purpose:** Platform-wide safety.
- **Responsibilities:** rate limiting, audit logs, encryption, RBAC, 2FA, API keys, webhook verification.
- **Tables:** `audit_logs`, `api_keys`, `webhook_endpoints`. **Endpoints:** `/security/*`, `/api-keys`.
- **MVP now:** rate limiting, audit logs on sensitive actions, token encryption, RBAC guard. **Later:** 2FA, API keys, webhooks.

## M18 — Automation Engine **[Later — big]**
- **Purpose:** n8n-style visual workflow builder.
- **Responsibilities:** nodes (if/else/delay/webhook/HTTP/AI/email/CRM/scraper/scheduler), graph execution engine.
- **Tables:** `workflows`, `workflow_runs`, `workflow_nodes`. **Endpoints:** `/workflows/*`.
- **Edge cases:** infinite loops, long-running, failure/retry semantics, versioning. **Scalability:** own executor;
  significant effort — deferred until core loop earns.

## M19 — AI Features (cross-cutting) **[MVP subset]**
- **Purpose:** Central AI capabilities used by many modules.
- **Responsibilities:** cold emails, follow-ups, website audits, opportunities, sales scripts, meeting notes,
  proposal drafts, reply suggestions, risk analysis. See `08-ai-architecture.md`.
- **Dependencies:** ai-jobs worker, Claude. **Tables:** `ai_generations` (audit + cost log).
- **MVP:** personalization, follow-ups, audit summary, reply classification+suggestion. **Later:** proposals,
  scripts, risk, meeting notes.

## M20 — Developer Features **[Later]**
- **Purpose:** Extensibility + productization.
- **Responsibilities:** public REST API, webhooks, Swagger, SDK, CLI, API keys.
- **Tables:** reuses `api_keys`, `webhook_endpoints`. **Endpoints:** versioned `/v1/*` public surface.
- **Scalability:** versioning + rate limits per key. Deferred to SaaS phase (Swagger from NestJS is near-free earlier).

---

### Global edge-case & error philosophy
- **Every write that touches sending or money is idempotent.** Deterministic job keys, no double-sends.
- **Fail partial, not total:** scraping/audit/enrichment persist what they got with a `status`.
- **AI never sends unattended at MVP:** approval gate on personalization; classification is advisory.
- **Compliance is enforced in the send path**, not trusted upstream: suppression + unsub checked pre-send, always.
