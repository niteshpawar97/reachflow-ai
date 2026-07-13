# ReachFlow AI — Database Design (PostgreSQL + Prisma)

> Phase 6 deliverable. Conventions, ER model, tables, relationships, indexes, performance, soft-delete, audit.

## Conventions
- **PK:** `id` = `uuid` (v7 preferred for index locality). **FKs:** `<entity>_id uuid`.
- **Tenancy:** **every domain table has `workspace_id uuid NOT NULL`** (indexed) — multi-tenant seam from day 1.
- **Timestamps:** `created_at`, `updated_at` (UTC, `timestamptz`).
- **Soft delete:** `deleted_at timestamptz NULL`; queries filter `deleted_at IS NULL` (Prisma middleware).
- **Semi-structured data:** `JSONB` for scraped/enrichment/audit payloads + factor breakdowns.
- **Enums:** Postgres enums for stable sets (status, role, stage); lookup tables where values evolve.
- **Money:** `numeric(12,2)` + `currency char(3)`. **Never** float for money.
- **Idempotency:** unique keys on natural dedupe columns (e.g., `message_id`, `(source, source_key)`).

## ER overview (text)

```
users ─< workspace_members >─ workspaces ─┬─< workspace_settings
                                          ├─< mailboxes ─< mailbox_health
                                          ├─< domains
                                          ├─< companies ─< website_audits
                                          │        └─< contacts ─< email_verifications
                                          ├─< leads (─ company, ─ contact) ─< lead_scores
                                          │                                 └─< personalizations
                                          ├─< campaigns ─< campaign_steps
                                          │        └─< campaign_leads ─< email_messages ─< email_events
                                          ├─< threads ─< messages ─< reply_classifications
                                          ├─< deals ─< activities
                                          ├─< meetings          (later)
                                          ├─< proposals ─< proposal_signatures   (later)
                                          ├─< suppression_list
                                          ├─< ai_generations    (cost/audit log)
                                          ├─< scrape_jobs / scrape_sources
                                          └─< audit_logs / api_keys / webhook_endpoints  (later)
plans ─< subscriptions ─ workspaces ; usage_counters ─ workspaces   (SaaS phase)
```

## Core tables

### Identity & tenancy
- **users** — `id, email(unique), password_hash NULL, name, avatar_url, email_verified_at, role_global, created_at, updated_at, deleted_at`.
- **sessions** — `id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at`.
- **otp_codes / password_resets** — `id, user_id, code_hash, purpose, expires_at, used_at`.
- **workspaces** — `id, name, slug(unique), owner_user_id, plan_id NULL, created_at, ...`.
- **workspace_members** — `id, workspace_id, user_id, role(enum: admin|staff|client), invited_at, joined_at`. Unique `(workspace_id, user_id)`.
- **workspace_settings** — `id, workspace_id, sending_windows JSONB, timezone_default, from_identity JSONB, compliance JSONB (address, unsub_copy)`.
- **usage_counters** — `id, workspace_id, period, emails_sent, ai_tokens, scrapes, updated_at` (SaaS metering).

### Deliverability
- **mailboxes** — `id, workspace_id, provider(enum: gmail|m365|smtp), email, display_name, oauth_token_enc, oauth_refresh_enc, smtp_config_enc JSONB, imap_config_enc JSONB, daily_cap, warmup_state(enum), warmup_started_at, health_score, status(enum: active|paused|error), last_synced_at, created_at, deleted_at`. Unique `(workspace_id, email)`.
- **mailbox_health** — `id, mailbox_id, date, sent, bounces, complaints, blacklist_hits, spf_ok, dkim_ok, dmarc_ok, score`. Unique `(mailbox_id, date)`.
- **domains** — `id, workspace_id, domain, spf_ok, dkim_ok, dmarc_ok, mx JSONB, checked_at`.

### Leads & data
- **companies** — `id, workspace_id, name, website, domain, industry, size_band, country, city, tech_stack JSONB, socials JSONB, revenue_band NULL, raw JSONB, created_at, deleted_at`. Index `(workspace_id, domain)`.
- **contacts** — `id, workspace_id, company_id, name, title, role_type(enum), email, email_status(enum), linkedin_url, confidence, raw JSONB`. Index `(workspace_id, company_id)`, `(workspace_id, email)`.
- **leads** — `id, workspace_id, company_id, contact_id NULL, source(enum), source_key, status(enum: new|enriching|scored|ready|in_campaign|replied|won|lost|suppressed), created_at, deleted_at`. Unique `(workspace_id, source, source_key)`; index `(workspace_id, status)`.
- **website_audits** — `id, workspace_id, company_id, url, https, ssl, page_speed_ms, seo JSONB, broken_links JSONB, mobile_friendly, has_contact_form, has_cta, a11y JSONB, tech JSONB, cms, hosting, performance_score, findings JSONB, ai_summary text, status(enum: ok|partial|failed), created_at`. Index `(workspace_id, company_id)`.
- **email_verifications** — `id, workspace_id, email_hash, email, status(enum: valid|invalid|risky|catch_all|unknown), mx_ok, smtp_ok, disposable, risk_score, checked_at`. Unique `(workspace_id, email_hash)`.
- **lead_scores** — `id, workspace_id, lead_id, score(0-100), fit_score, intent_score, confidence, factors JSONB, model, created_at`. Index `(workspace_id, lead_id)`, `(workspace_id, score)`.
- **personalizations** — `id, workspace_id, lead_id, campaign_id NULL, step, subject, opening, observation, opportunity, pain_point, cta, status(enum: draft|approved|rejected), model, tokens, cost, created_at`. Unique `(workspace_id, lead_id, campaign_id, step)`.

### Campaigns & sending
- **campaigns** — `id, workspace_id, name, offer(enum/text: which service), status(enum: draft|running|paused|done), schedule JSONB, mailbox_pool JSONB (ids), daily_cap, ab_config JSONB NULL, created_at, deleted_at`. Index `(workspace_id, status)`.
- **campaign_steps** — `id, campaign_id, step_order, delay_hours, trigger(enum: initial|no_reply|opened|clicked|bounced), template_mode(enum: ai|fixed), body_template NULL`. Index `(campaign_id, step_order)`.
- **campaign_leads** — `id, workspace_id, campaign_id, lead_id, mailbox_id NULL, state(enum: queued|active|replied|bounced|unsubscribed|completed|stopped), current_step, next_send_at, created_at`. Unique `(campaign_id, lead_id)`; index `(workspace_id, next_send_at)` (scheduler hot path), `(campaign_id, state)`.
- **email_messages** — `id, workspace_id, campaign_id NULL, campaign_lead_id NULL, mailbox_id, thread_id NULL, direction(enum: outbound|inbound), message_id(unique), in_reply_to, subject, body, sent_at, provider_msg_id, status(enum: queued|sent|delivered|bounced|failed)`. Unique `(workspace_id, message_id)` (idempotency). Index `(workspace_id, thread_id)`.
- **email_events** — `id, workspace_id, email_message_id, type(enum: sent|delivered|open|click|bounce|complaint|unsubscribe|reply), meta JSONB, occurred_at`. Index `(workspace_id, type, occurred_at)`, `(email_message_id)`.

### Inbox & CRM
- **threads** — `id, workspace_id, mailbox_id, lead_id NULL, subject, last_message_at, status(enum: open|snoozed|closed)`. Index `(workspace_id, last_message_at)`.
- **messages** — `id, workspace_id, thread_id, email_message_id NULL, direction, from, to, subject, body, snippet, received_at`. Index `(workspace_id, thread_id, received_at)`.
- **reply_classifications** — `id, workspace_id, message_id, label(enum: interested|meeting|pricing|spam|referral|not_interested|other), confidence, summary, suggested_reply, model, created_at`. Index `(message_id)`.
- **deals** — `id, workspace_id, lead_id, title, stage(enum: lead|contacted|interested|meeting|proposal|negotiation|won|lost), value numeric, currency, owner_user_id, closed_at NULL, created_at, deleted_at`. Index `(workspace_id, stage)`.
- **activities** — `id, workspace_id, deal_id NULL, lead_id NULL, type(enum: note|email|call|meeting|stage_change|system), body, meta JSONB, actor_user_id NULL, created_at` (append-only). Index `(workspace_id, deal_id, created_at)`.

### Compliance & AI
- **suppression_list** — `id, workspace_id, email_hash, reason(enum: unsubscribe|bounce|complaint|manual|global), source, created_at`. Unique `(workspace_id, email_hash)`. **Checked pre-send, always.**
- **unsubscribe_tokens** — `id, workspace_id, lead_id, token(unique, signed), used_at`.
- **ai_generations** — `id, workspace_id, feature(enum), ref_type, ref_id, model, input_tokens, output_tokens, cost, latency_ms, status, created_at` (cost/audit + observability). Index `(workspace_id, feature, created_at)`.

### Scraping
- **scrape_sources** — `id, workspace_id, type(enum: google_maps|website|clutch|crunchbase|builtwith|yellowpages|directory), config JSONB, enabled`.
- **scrape_jobs** — `id, workspace_id, source_id, query JSONB, status(enum: queued|running|partial|done|failed), stats JSONB, error, started_at, finished_at`. Index `(workspace_id, status)`.

### Later / SaaS
- **plans, subscriptions, credits, invoices** — billing (Stripe) at productization.
- **audit_logs** — `id, workspace_id, actor_user_id, action, entity, entity_id, before JSONB, after JSONB, ip, created_at`. Index `(workspace_id, created_at)`, `(entity, entity_id)`.
- **api_keys** — `id, workspace_id, name, key_hash, scopes JSONB, last_used_at, revoked_at`.
- **webhook_endpoints** — `id, workspace_id, url, secret_enc, events JSONB, active`.
- **meetings, proposals, proposal_signatures, workflows, workflow_runs, workflow_nodes** — per their modules (later).

## Indexing strategy (hot paths)
- **Scheduler dispatch:** `campaign_leads (workspace_id, state, next_send_at)` — the query that finds due sends.
- **Tenant scoping:** composite `(workspace_id, ...)` on every high-traffic filter, never `workspace_id` alone.
- **Dedup/idempotency:** unique indexes on `email_messages.message_id`, `leads (source, source_key)`,
  `suppression_list.email_hash`, `email_verifications.email_hash`.
- **Analytics:** `email_events (workspace_id, type, occurred_at)` + rollup/materialized views for dashboards.
- **JSONB:** GIN indexes only where we actually query into JSONB (e.g., tech stack filters), not by default.

## Performance considerations
- **Partition** `email_events` (and later `messages`) by month once volume grows (millions of rows).
- **Materialized views / rollup tables** for analytics; refresh via scheduler; serve dashboards from Redis cache.
- **Read replica** for analytics/reporting once read load competes with sending.
- **Batch writes** from workers (COPY / bulk insert) for scraped leads + events.
- **Connection pooling** (PgBouncer) — many workers × Prisma connections.
- Keep the **send-path queries tiny and indexed**; never join heavy JSONB on the hot path.

## Soft-delete strategy
- `deleted_at` on user-facing entities (leads, companies, campaigns, mailboxes, deals).
- Global Prisma middleware excludes soft-deleted rows; hard-delete only via GDPR erase job or admin purge.
- **GDPR erase:** dedicated job nulls/removes PII across `contacts`, `leads`, `messages`, and hashes in
  `suppression_list` are retained (legal basis to keep *not* emailing them).

## Audit logging
- `audit_logs` records sensitive mutations (mailbox connect/disconnect, campaign launch, suppression edits,
  data export/delete, role changes) with before/after JSONB + actor + IP.
- Append-only; never updated. Feeds compliance + debugging.

## Data retention
- Raw scrape artifacts/screenshots in object storage with lifecycle expiry (e.g., 90 days).
- `email_events` retained for analytics window then rolled up + pruned.
- Suppression + audit logs retained long-term (compliance).
