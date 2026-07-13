# ReachFlow AI — Development Roadmap

> Phase 10 deliverable. ~80 milestones, each ≈ 1 day, **independently testable**. Sequenced for
> **solo dev, revenue ASAP** (D4): the money-path ships first; heavy SaaS modules come after first revenue.
> **No code until you approve this roadmap.** Then we build **one milestone at a time**, verifying each.

Legend: 🟢 MVP money-path · 🔵 MVP support · 🟠 post-MVP · 🟣 SaaS/scale phase.

---

## Phase A — Foundation & Skeleton (M1–M10)
1. 🔵 Repo + workspaces setup (NestJS `api` + `worker` + React/Vite `web`), TS strict, ESLint/Prettier. *Test: all three boot.*
2. 🔵 Docker Compose: Postgres + Redis + api + worker + web + Nginx. *Test: `docker compose up` healthy.*
3. 🔵 Prisma init + base schema (users, workspaces, workspace_members) + first migration. *Test: migrate + seed.*
4. 🔵 Config/env module + secrets loading + `/health`. *Test: health returns deps status.*
5. 🔵 Global concerns: Zod validation pipe, exception filter, pino logging, request IDs. *Test: bad input → 422 shape.*
6. 🔵 Auth: register + login + JWT access/refresh + `/me`. *Test: login→access protected route.*
7. 🔵 Auth: Google OAuth login + email verification. *Test: OAuth round-trip creates user.*
8. 🔵 RBAC guard + `WorkspaceContext` (inject/scope `workspace_id`) + rate limiting. *Test: cross-workspace read blocked.*
9. 🔵 Workspace CRUD + settings + members skeleton. *Test: create workspace, update settings.*
10. 🔵 BullMQ setup + typed job contracts + `/jobs/:id` status + a demo job end-to-end. *Test: enqueue→worker→status done.*

## Phase B — Web Shell & Auth UX (M11–M16)
11. 🔵 React shell: routing, layout (sidebar/topbar), dark-mode, TanStack Query + API client. *Test: navigates, theme persists.*
12. 🔵 Auth UI: login/register/verify/forgot + token refresh handling. *Test: full auth flow in browser.*
13. 🔵 Workspace switcher + settings screen + onboarding checklist shell. *Test: switch workspace scopes data.*
14. 🔵 Reusable async UI: job-progress toasts, skeletons, empty/error states, command palette. *Test: demo job shows progress.*
15. 🔵 Reusable data table (virtualized, filters, bulk-select, saved views). *Test: sort/filter/bulk works.*
16. 🔵 Reusable **AI-review component** (draft + evidence + edit/approve/reject/regenerate). *Test: renders + emits actions.*

## Phase C — Mailboxes & Deliverability Core (M17–M26) 🟢
17. 🟢 Mailbox schema + encrypted token/credential storage (envelope AES-GCM). *Test: store/read, ciphertext at rest.*
18. 🟢 Connect Gmail via OAuth (send+read scopes). *Test: connect, token refresh works.*
19. 🟢 Connect Microsoft 365 via Graph OAuth. *Test: connect M365 mailbox.*
20. 🟢 Connect SMTP/IMAP (manual config) + connection test. *Test: valid/invalid config handled.*
21. 🟢 Send-email adapter (Gmail/Graph/SMTP) with unified interface + `email_messages` record. *Test: send test email, message_id stored.*
22. 🟢 Domain auth checks (SPF/DKIM/DMARC/MX) per mailbox/domain. *Test: reports pass/fail correctly.*
23. 🟢 Daily caps + per-mailbox counters + randomized send intervals + sending windows/timezone. *Test: cap enforced, interval within range.*
24. 🟢 Mailbox rotation logic across a pool (health-aware). *Test: distributes without exceeding caps.*
25. 🟢 Warmup engine v1 (scheduled ramp sends + IMAP interactions) + warmup state machine. *Test: daily warmup job runs, ramps.*
26. 🟢 Mailbox health scoring (bounce/complaint/blacklist/auth) + auto-pause + Mailboxes UI. *Test: simulated bounces drop score, auto-pause.*

## Phase D — Leads, Scraping (thin) & Enrichment (M27–M38) 🟢
27. 🟢 Companies/leads/contacts schema + soft-delete middleware. *Test: CRUD + soft delete hidden.*
28. 🟢 CSV/JSON lead import with mapping + validation preview → import job. *Test: import file, bad rows flagged.*
29. 🟢 Leads list UI (table, filters, drawer) + lead detail. *Test: browse/filter imported leads.*
30. 🟢 Scraping infra: Playwright worker + proxy manager + isolated queue + source-adapter interface. *Test: fetch a page via proxy.*
31. 🟢 Scrape source #1: company-website crawler (extract name/emails/phones/socials/tech). *Test: crawl seed URL → company row.*
32. 🟢 Scrape source #2: Google Maps business search adapter. *Test: query → companies with basic firmographics.*
33. 🟢 Lead Finder UI (search form → job progress → results into leads) + dedupe. *Test: search creates deduped leads.*
34. 🟢 Website Analyzer: technical checks (HTTPS/SSL/speed/mobile/broken links/tech/CMS/CTA/form/SEO). *Test: audit a site → structured findings.*
35. 🟢 Website Analyzer AI summary (grounded narrative) + audit UI in lead drawer. *Test: summary uses only real findings.*
36. 🟢 Email verification (MX/SMTP/disposable/catch-all/risk) + cache + rate-limited probes. *Test: known valid/invalid classified.*
37. 🟢 Lead scoring engine (deterministic factors + optional AI pass) + score UI/breakdown. *Test: scores reflect factors, explainable.*
38. 🟢 Bulk actions (audit/verify/score) via batch job + progress. *Test: bulk over 100 leads completes.*

## Phase E — AI Personalization (M39–M43) 🟢
39. 🟢 AI lib: Claude client, model tiering, prompt templates (versioned), cost logging (`ai_generations`). *Test: call logs tokens/cost.*
40. 🟢 Personalization generation (subject/opener/observation/opportunity/pain/CTA) grounded in audit + offer. *Test: output cites real facts.*
41. 🟢 Output validator (unsupported-claim + spam-word + length lint) + regenerate. *Test: hallucinated claim rejected.*
42. 🟢 Personalization review UI (edit/approve/reject/regenerate) wired to AI-review component. *Test: approve gates readiness.*
43. 🟢 Prompt caching + batching for bulk personalization. *Test: cost/latency drop on batch vs individual.*

## Phase F — Campaigns, Sending & Follow-ups (M44–M54) 🟢
44. 🟢 Campaign + steps + campaign_leads schema. *Test: create campaign with sequence.*
45. 🟢 Campaign builder UI (5-step stepper) + launch validation. *Test: launch blocked without healthy mailbox.*
46. 🟢 Attach leads (by filter/selection); show verified+ready counts. *Test: only eligible leads attachable.*
47. 🟢 Scheduler: find due sends (`next_send_at`) + enqueue with idempotency keys, batched. *Test: due leads enqueue once.*
48. 🟢 Sender worker: pre-send checks (suppression/cap/health) → send → record + advance step. *Test: no double-send on retry.*
49. 🟢 Email event tracking (sent/delivered/open/click/bounce) + open/click pixels/links. *Test: opens recorded.*
50. 🟢 Stop-on-reply / stop-on-unsub enforced in send path. *Test: reply cancels queued follow-ups.*
51. 🟢 Follow-up engine (triggers → next step, 4–8 steps, min-gap) via events. *Test: no-reply triggers follow-up.*
52. 🟢 Campaign control (launch/pause/resume/stop) + running-campaign UI (per-step funnel, lead states). *Test: pause halts sends.*
53. 🟢 A/B testing on subject/body (variant split + basic significance). *Test: variants split, results tracked.* 🟠
54. 🟢 Compliance core: suppression list + signed unsubscribe link + handler + identity footer. *Test: unsub adds to suppression, blocks future sends.*

## Phase G — Inbox & CRM (M55–M62) 🟢
55. 🟢 IMAP sync worker (incremental, per-mailbox cursor) + thread stitching + `messages`. *Test: replies appear as threads.*
56. 🟢 Unified Inbox UI (3-pane, label filters, keyboard nav). *Test: browse/read threads across mailboxes.*
57. 🟢 AI reply classification (Haiku) + confidence + summary. *Test: sample replies labeled ≥90% on golden set.*
58. 🟢 AI suggested reply (grounded in thread + offer) + insert/edit/send from inbox. *Test: send reply via correct mailbox.*
59. 🟢 CRM schema (deals/activities/stages) + pipeline. *Test: create deal, move stage.*
60. 🟢 CRM Kanban + deal drawer (linked emails/threads, activity timeline). *Test: drag stage, see linked emails.*
61. 🟢 "Convert reply → deal" + auto-activity logging from email/inbox events. *Test: reply creates deal + activity.*
62. 🟢 Follow-up cancel on reply integrated with inbox state. *Test: interested reply stops sequence + flags deal.*

## Phase H — Analytics & MVP Hardening (M63–M70) 🟢/🔵
63. 🟢 Event rollups/materialized views + Redis-cached dashboard reads. *Test: overview loads <300ms p95.*
64. 🟢 Dashboard UI: KPIs + funnel + deliverability strip + recent replies + cost widget. *Test: numbers match raw events.*
65. 🟢 Analytics screens (Overview/Deliverability/Campaigns/Funnel) + CSV export. *Test: per-campaign metrics correct.*
66. 🔵 Audit logs on sensitive actions (mailbox connect, launch, suppression, exports). *Test: actions logged with before/after.*
67. 🔵 GDPR export + erase jobs (PII removal, suppression retained). *Test: erase nulls PII, keeps suppression hash.*
68. 🔵 Onboarding wizard end-to-end (workspace→mailbox→compliance→leads→campaign). *Test: new user reaches first send.*
69. 🔵 E2E money-path test + seed/demo data + deliverability sims (fake clock). *Test: connect→import→personalize→send→reply→deal green.*
70. 🔵 CI/CD: lint+typecheck+tests+migrate-check+docker build; deploy to launch host; backups + Sentry. *Test: pipeline deploys, restore verified.*

> **⟶ MVP COMPLETE at M70 — you can run real campaigns and book meetings.** Everything below is post-revenue.

## Phase I — Close-the-Deal & Enrichment+ (M71–M78) 🟠
71. 🟠 Decision-maker finder (name/role/email pattern + verify + confidence). *Test: finds + verifies a contact.*
72. 🟠 Deeper enrichment (tech/hiring/funding signals) feeding scoring. *Test: signals raise/lower score sensibly.*
73. 🟠 Meeting booking: availability + booking links + reminders + calendar integration. *Test: book a slot, reminder fires.*
74. 🟠 Proposal generator: AI draft (scope/pricing from catalog/timeline/milestones). *Test: draft uses catalog pricing.*
75. 🟠 Proposal PDF export (object storage) + send + versioning. *Test: PDF renders, downloadable.*
76. 🟠 E-signature flow + signed record. *Test: sign marks proposal signed.*
77. 🟠 AI: sales scripts + meeting notes + risk analysis. *Test: risk flags a low-fit reply.*
78. 🟠 CRM intelligence (deal summaries, next-best-action, stale nudges). *Test: stale deal surfaces nudge.*

## Phase J — Productize into SaaS (M79–M88) 🟣
79. 🟣 Multi-tenant hardening: tenant-isolation tests + (optional) Postgres RLS + quota enforcement. *Test: isolation fuzz passes.*
80. 🟣 Team/RBAC full (Admin/Staff/Client) + invitations. *Test: staff limited vs admin.*
81. 🟣 Billing: Stripe plans/subscriptions + usage metering (mailboxes/sends/AI credits) + limits. *Test: over-limit blocks, upgrade unblocks.*
82. 🟣 Credits system + cost pass-through for AI/scraping/enrichment. *Test: usage decrements credits.*
83. 🟣 Admin panel (users/campaigns/mailboxes/credits/logs/payments). *Test: admin manages tenants.*
84. 🟣 Security full: 2FA + API keys + webhook signatures + rotation. *Test: 2FA login, signed webhook verified.*
85. 🟣 Public API `/v1` + Swagger + rate limits per key + docs site. *Test: external key calls succeed within limits.*
86. 🟣 Outbound webhooks (lead.replied, campaign.completed, deal.stage_changed, mailbox.unhealthy). *Test: event delivers signed payload.*
87. 🟣 Scale: extract scraper + sender to own services, PgBouncer, read replica, partition events. *Test: load test at target volume.*
88. 🟣 Deliverability lab: spam linting, seed-list inbox-placement tests, blacklist monitoring dashboard. *Test: placement report generated.*

## Phase K — Automation Engine & Dev Platform (M89–M96) 🟣
89. 🟣 Workflow schema + execution engine (DAG, retries, run history). *Test: linear workflow runs.*
90. 🟣 Nodes: trigger/if/else/delay/scheduler. *Test: branch + delay behave.*
91. 🟣 Nodes: webhook/HTTP request. *Test: calls external endpoint.*
92. 🟣 Nodes: AI/email/CRM/scraper. *Test: AI node generates + email node sends.*
93. 🟣 Visual workflow builder UI (canvas, drag nodes, connect). *Test: build + run a flow from UI.*
94. 🟣 Loop/error-handling/versioning guards (no infinite loops). *Test: cyclic flow rejected.*
95. 🟣 SDK (TS) + CLI over public API. *Test: SDK creates a campaign; CLI lists leads.*
96. 🟣 Marketplace/templates (audit playbooks, sequences, niche lead packs). *Test: import a template.*

---

## How we'll execute
- **One milestone per working session.** Each ends with its stated test passing + a short demo/verify.
- **Money-path (M1–M70) is the priority.** We can pause after M70 to run real outreach and let revenue fund the rest.
- **Re-sequencing is fine** — if a milestone unblocks revenue faster, we pull it forward.
- **Definition of done per milestone:** code + tests + migration (if any) + the milestone's test green + brief note.

## Suggested checkpoints
- **After M26:** deliverability core provable (can send safely from a warmed pool).
- **After M43:** AI personalization producing approvable, grounded drafts.
- **After M54:** first real campaign can go out.
- **After M70:** MVP — book meetings for real. *(natural monetization/validation gate)*
- **After M78:** full close loop (proposal → sign).
- **M79+:** productize only if you decide to sell it.
