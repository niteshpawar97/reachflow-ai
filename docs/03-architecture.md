# ReachFlow AI — System Architecture

> Phase 4 deliverable. Target: production-ready, solo-maintainable **modular monolith** that can split
> into services later without a rewrite.

## 1. Architecture style
A **modular monolith** (NestJS) with a **queue-based async worker tier**. One deployable API app + one (or
more) worker processes sharing the same codebase and DB. We split a module into its own service only when a
measured bottleneck justifies it (scraping and email-sending workers are the first likely candidates).

Why not microservices now: solo dev + revenue ASAP. Microservices multiply ops, deploy, and debugging cost.
NestJS modules give us the *seams* (clear boundaries, DI) so extraction later is mechanical.

## 2. High-level diagram

```
                         ┌─────────────────────────────┐
                         │   React + Vite SPA (client)  │
                         │  TanStack Query / RHF / Rechart│
                         └───────────────┬─────────────┘
                                         │ HTTPS (JWT)
                                         ▼
┌───────────────────────────────────────────────────────────────────┐
│                       NestJS API (modular monolith)                │
│  Auth │ Workspace │ Leads │ Campaigns │ Inbox │ CRM │ Analytics …  │
│  - REST controllers  - services  - guards/RBAC  - validation(Zod)  │
│  - enqueues jobs → BullMQ                                           │
└───────┬───────────────┬───────────────┬───────────────┬───────────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
   ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐
   │Postgres │    │  Redis   │    │Object Str│    │ Anthropic │
   │ (Prisma)│    │cache+queue│   │(R2/S3)   │    │  Claude   │
   └─────────┘    └────┬─────┘    └──────────┘    └───────────┘
                       │ BullMQ queues
        ┌──────────────┼───────────────┬──────────────┬─────────────┐
        ▼              ▼               ▼              ▼             ▼
   ┌─────────┐   ┌──────────┐   ┌───────────┐  ┌──────────┐  ┌──────────┐
   │ sender  │   │ warmup   │   │ scraper   │  │enrichment│  │  ai-jobs │
   │ worker  │   │ worker   │   │(Playwright)│ │ worker   │  │ worker   │
   └────┬────┘   └────┬─────┘   └─────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │              │             │            │
        ▼             ▼              ▼             ▼            ▼
   Gmail/Graph    IMAP/SMTP     target sites   verify/DNS    Claude API
   SMTP send      warmup peers  + proxies      + web         (tiered)
```

## 3. Component responsibilities

### Frontend — React + Vite SPA
- TanStack Query (server state/caching), React Hook Form + Zod (forms), Recharts (analytics),
  Framer Motion (transitions), Tailwind + shadcn-style components.
- Talks only to the REST API. No direct DB/AI access. Auth via short-lived JWT + refresh.

### API — NestJS
- One module per business capability (maps 1:1 to the 20-module spec + infra modules).
- Cross-cutting: `AuthModule`, `RbacGuard`, `WorkspaceContext` (injects `workspace_id`), global
  `ValidationPipe` (Zod), exception filter, request logging, rate limiting.
- **Never** does long/blocking work inline — it enqueues BullMQ jobs and returns.

### Workers (BullMQ consumers, same repo, separate process)
- **sender** — sends queued emails via the right mailbox, respects caps/intervals, records events.
- **warmup** — daily warmup sends + IMAP interactions, ramps volume.
- **scraper** — Playwright crawls (Google Maps, company sites), proxy rotation, isolated + rate-limited.
- **enrichment** — email verification, website analyzer, decision-maker/firmographic enrichment.
- **ai-jobs** — personalization, audit summaries, reply classification, proposals (Claude, tiered models).
- **scheduler** — cron: dispatch due campaign sends, follow-up triggers, health checks, warmup ticks.

### Data stores
- **PostgreSQL (Prisma):** source of truth. JSONB for scraped/enrichment payloads. `workspace_id` everywhere.
- **Redis:** BullMQ queues + cache (dashboards, dedupe/idempotency keys, rate-limit counters).
- **Object storage (Cloudflare R2 / S3):** proposal PDFs, scrape artifacts/screenshots, exports, attachments.

### External integrations
- **Gmail API / Microsoft Graph** (OAuth) for send + read; SMTP/IMAP fallback (Nodemailer/ImapFlow).
- **Anthropic Claude** — Opus 4.8 (depth) / Haiku 4.5 (volume).
- **Proxy provider** for scraping; **DNS/SMTP** for email verification; **calendar** (later).

## 4. Queues (BullMQ) — the backbone

| Queue | Producer | Consumer | Idempotency / guardrails |
|-------|----------|----------|--------------------------|
| `send-email` | scheduler/campaign | sender | unique jobId per (message_id); check daily cap + suppression pre-send |
| `warmup` | scheduler | warmup | one job/mailbox/day |
| `scrape` | lead-finder | scraper | dedupe by (source, source_key); concurrency-limited per domain |
| `verify-email` | pipeline | enrichment | dedupe by email hash; cache result |
| `analyze-website` | pipeline | enrichment | dedupe by domain; cache TTL |
| `ai-personalize` | campaign | ai-jobs | dedupe by (lead_id, campaign_id, step) |
| `classify-reply` | inbox sync | ai-jobs | dedupe by message_id |
| `generate-proposal` | crm | ai-jobs | dedupe by proposal_id |

Principles: **every send is idempotent and resumable** (jobId = deterministic key), retries with backoff,
dead-letter queue for poison jobs, per-queue concurrency limits.

## 5. Deliverability subsystem (the crown jewels)
- **Mailbox pool** with per-mailbox daily cap, warmup state, health score.
- **Rotation:** campaign sends spread across healthy mailboxes; never exceed per-mailbox cap.
- **Send pacing:** randomized intervals within business-hours windows in the *lead's* timezone.
- **Warmup gating:** new mailboxes can't join campaigns until warmup threshold reached.
- **Health monitoring:** bounce rate, spam-complaint rate, blacklist checks (DNSBLs), auth (SPF/DKIM/DMARC)
  verification → health score; auto-pause a degrading mailbox.
- **Stop-on-reply / stop-on-unsub** enforced before every send.

## 6. Security architecture
- **AuthN:** JWT access (short TTL) + rotating refresh tokens; OAuth for Google login + mailbox connect.
- **AuthZ:** RBAC guard (Admin/Staff/Client) + `workspace_id` scoping on every query (tenant isolation seam).
- **Secrets:** mailbox OAuth tokens & SMTP passwords **encrypted at rest** (envelope encryption; app-level
  AES-GCM with a KMS/managed key), never logged.
- **Transport:** HTTPS everywhere; webhooks HMAC-verified.
- **Abuse controls:** global + per-user rate limiting, audit logs on sensitive actions, input validation (Zod)
  on every endpoint, output encoding, parameterized queries (Prisma).
- **Compliance hooks:** suppression checked pre-send; unsubscribe tokens signed; GDPR export/delete jobs.

## 7. Observability & ops
- **Logging:** pino structured logs, request IDs, per-job correlation IDs.
- **Errors:** Sentry.
- **Metrics:** queue depth/latency, send throughput, AI tokens/cost per job, scraping success rate,
  deliverability KPIs → dashboard.
- **Health:** `/health` + queue/worker liveness; alert on stuck queues, rising bounce/complaint rates.
- **Backups:** daily Postgres backups + object-storage lifecycle; tested restore.

## 8. Deployment & CI/CD
- **Containers:** `api`, `worker`, `web` (static), plus `postgres`, `redis` via Docker Compose;
  Nginx reverse proxy + TLS (Cloudflare in front). PM2 optional inside worker container.
- **Env:** `.env` per environment; secrets via env/secret manager, never committed.
- **CI:** lint + typecheck + unit/integration tests + prisma migrate check + docker build on every PR.
- **CD:** build images → deploy to VPS (start: single Hetzner/Railway) → run migrations → health-gated cutover.
- **Scaling path:** scale workers horizontally first (queues absorb load); read replicas for Postgres;
  extract scraper/sender to own services when they dominate resource use; move to k8s only if genuinely needed.

## 9. Folder structure (NestJS monorepo-lite)
```
reachflow/
├─ apps/
│  ├─ api/            # NestJS HTTP app
│  └─ worker/         # NestJS app booting BullMQ processors + scheduler
├─ libs/              # shared code imported by api + worker
│  ├─ database/       # Prisma schema, client, migrations, repositories
│  ├─ common/         # DTOs, Zod schemas, guards, decorators, filters, config
│  ├─ queue/          # BullMQ setup, job contracts (typed)
│  ├─ ai/             # Claude client, prompt templates, model tiering, cost logging
│  ├─ email/          # Gmail/Graph/SMTP/IMAP adapters, deliverability utils
│  ├─ scraping/       # Playwright drivers, proxy mgr, source adapters
│  └─ enrichment/     # verify, website-analyzer, decision-maker finder
├─ apps/web/          # React + Vite SPA (or separate repo)
│  └─ src/{pages,features,components,hooks,api,lib,store}
├─ docs/              # this planning set
├─ docker/            # Dockerfiles, compose, nginx conf
└─ package.json (workspaces) / turbo or nx optional
```
Each business module inside `apps/api/src/modules/<name>/` = `controller` + `service` + `dto` + `module`.

## 10. Coding standards & testing
- **TypeScript strict**, ESLint + Prettier, no `any` in domain code, Zod at every boundary.
- **Naming:** modules by domain noun; services verb-driven; jobs `<queue>.<action>`.
- **Errors:** typed domain errors → global filter → consistent API error shape.
- **Testing strategy:**
  - *Unit* — services, scoring, prompt builders, deliverability math (Jest).
  - *Integration* — controllers + DB (test Postgres via Testcontainers/Docker), queue processors.
  - *Contract* — job payload schemas, external adapters mocked.
  - *E2E (thin)* — critical money-path: connect mailbox → import lead → personalize → enqueue send → record event.
  - *Deliverability sims* — cap/rotation/interval logic tested deterministically with fake clock.
- **Coverage target:** meaningful coverage on scoring, sending, compliance, and billing (later) — not 100% vanity.
