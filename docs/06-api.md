# ReachFlow AI — API Specification

> Phase 7 deliverable. REST spec only — **no implementation**. NestJS + Swagger will generate live docs from these.

## Conventions
- **Base:** `/api` (internal), `/v1` (public, later). **Format:** JSON. **Auth:** `Authorization: Bearer <JWT>`.
- **Tenancy:** `workspace_id` derived from JWT/active workspace; also accepted as `X-Workspace-Id` header.
  Server **always** scopes to it — no cross-tenant access.
- **Validation:** Zod DTOs at every boundary → `422` with field errors on failure.
- **Pagination:** cursor-based — `?limit=&cursor=` → `{ data, nextCursor }`. Filtering via query params.
- **Idempotency:** mutating money/send endpoints accept `Idempotency-Key` header.
- **Errors:** consistent shape:
  ```json
  { "error": { "code": "STRING_CODE", "message": "human readable", "details": { } } }
  ```
- **Status codes:** 200/201 ok · 202 accepted (async job queued) · 400/401/403/404/409/422/429 · 500.
- **Async pattern:** long tasks return `202 { jobId }`; poll `GET /jobs/:id` or receive webhook/SSE.
- **Rate limiting:** per-user + per-key; `429` with `Retry-After`.

---

## Auth — `/api/auth`
| Method | Path | Body / Query | Returns |
|--------|------|--------------|---------|
| POST | `/register` | email, password, name | 201 user (unverified) |
| POST | `/login` | email, password | 200 { access, refresh, user } |
| POST | `/google` | idToken/code | 200 tokens |
| POST | `/verify-email` | token | 200 |
| POST | `/otp/request` · `/otp/verify` | email · code | 200 |
| POST | `/forgot` · `/reset` | email · token+password | 200 |
| POST | `/refresh` | refreshToken | 200 { access, refresh } |
| POST | `/logout` | — | 204 |
| GET | `/me` | — | 200 user + workspaces |

## Workspaces — `/api/workspaces`
`POST /` · `GET /` · `GET /:id` · `PATCH /:id` · `DELETE /:id` ·
`GET/PATCH /:id/settings` · `GET/POST /:id/members` · `PATCH/DELETE /:id/members/:userId` ·
`GET /:id/usage`.

## Mailboxes — `/api/mailboxes`
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/oauth/:provider/url` | get Google/M365 OAuth consent URL |
| GET | `/oauth/:provider/callback` | complete connect → 201 mailbox |
| POST | `/smtp` | connect via SMTP/IMAP config |
| GET | `/` · `/:id` | list / detail (+ health) |
| PATCH | `/:id` | update cap/display/status |
| POST | `/:id/warmup/start` · `/warmup/stop` | control warmup |
| GET | `/:id/health` | health history |
| POST | `/:id/test` | send test / verify SPF/DKIM/DMARC |
| DELETE | `/:id` | disconnect (soft delete) |

## Domains — `/api/domains`
`GET /` · `POST /:id/check` (SPF/DKIM/DMARC/MX) · `GET /:id`.

## Lead Finder & Leads — `/api/lead-finder`, `/api/leads`
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/lead-finder/search` | start scrape job (query: industry, geo, keywords, source) → 202 { jobId } |
| GET | `/lead-finder/jobs/:id` | job status/stats |
| POST | `/leads/import` | CSV/JSON import → 202 { jobId } |
| GET | `/leads` | list (filters: status, minScore, industry, country, campaignId) |
| GET | `/leads/:id` | detail (company, contact, audit, score, personalization) |
| PATCH | `/leads/:id` | edit / change status |
| DELETE | `/leads/:id` | soft delete |
| POST | `/leads/:id/audit` | run website audit → 202 |
| POST | `/leads/:id/verify` | verify email → 202 |
| POST | `/leads/:id/score` | (re)score → 202 |
| POST | `/leads/:id/personalize` | generate personalization → 202 |
| POST | `/leads/bulk` | bulk audit/verify/score/personalize → 202 { jobId } |

## Companies & Contacts — `/api/companies`, `/api/contacts`
`GET /companies` · `GET /companies/:id` · `GET /companies/:id/audit` ·
`GET /companies/:id/contacts` · `POST /companies/:id/contacts/find` (decision-maker, later) ·
`GET /contacts/:id` · `POST /contacts/:id/verify`.

## Personalizations — `/api/personalizations`
`GET /:id` · `PATCH /:id` (edit copy) · `POST /:id/approve` · `POST /:id/reject` · `POST /:id/regenerate`.

## Campaigns — `/api/campaigns`
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/` | create (name, offer, schedule, mailbox pool, daily cap) |
| GET | `/` · `/:id` | list / detail |
| PATCH | `/:id` | update |
| GET/POST | `/:id/steps` · PATCH/DELETE `/:id/steps/:stepId` | sequence steps |
| POST | `/:id/leads` | attach leads (ids or filter) |
| GET | `/:id/leads` | campaign leads + state |
| POST | `/:id/launch` | validate (healthy mailbox, caps) → start |
| POST | `/:id/pause` · `/:id/resume` · `/:id/stop` | control |
| GET | `/:id/analytics` | per-campaign metrics |

## Inbox — `/api/inbox`
`GET /inbox` (threads: filters label, mailbox, unread) · `GET /threads/:id` (messages) ·
`POST /threads/:id/reply` (send reply) · `POST /threads/:id/classify` (re-run AI) ·
`POST /threads/:id/suggest` (suggested reply) · `PATCH /threads/:id` (status/snooze) ·
`POST /inbox/sync` (force IMAP sync → 202).

## CRM — `/api/deals`
`POST /` · `GET /` (filter stage/owner) · `GET /:id` · `PATCH /:id` ·
`POST /:id/stage` · `GET/POST /:id/activities` · `DELETE /:id`. `GET /pipeline` (board view).

## Meetings — `/api/meetings` *(later)*
`GET /meetings` · `POST /meetings` · `GET /booking/:slug` · `POST /booking/:slug` · `GET /meetings/:id`.

## Proposals — `/api/proposals` *(later)*
`POST /` (generate → 202) · `GET /:id` · `PATCH /:id` · `GET /:id/pdf` · `POST /:id/send` · `POST /:id/sign`.

## Analytics — `/api/analytics`
`GET /overview` (range) · `GET /deliverability` (domain/mailbox health) ·
`GET /funnel` · `GET /campaigns/:id` · `GET /revenue`.

## AI (direct utilities) — `/api/ai` *(most AI is triggered via resource endpoints above)*
`POST /ai/audit-summary` · `POST /ai/reply-suggest` · `POST /ai/proposal-draft` (later) —
each → 202 { jobId } or 200 with result if fast/cached. Returns model + token/cost meta.

## Jobs — `/api/jobs`
`GET /jobs/:id` (status, progress, result/error) — generic async poll for any 202 response.
Optional `GET /jobs/:id/stream` (SSE) for progress.

## Compliance — `/api/compliance`
`GET/POST /suppression` · `DELETE /suppression/:id` · `GET /unsubscribe/:token` (public, no auth) ·
`POST /gdpr/export` · `POST /gdpr/delete` (→ 202 erase job).

## Security / Dev *(later)* — `/api/security`, `/v1`
`GET/POST /api-keys` · `DELETE /api-keys/:id` · `GET/POST /webhooks` · `GET /audit-logs` ·
public versioned surface under `/v1/*` with per-key auth, Swagger, webhook signatures.

## Webhooks (outbound, later)
Events: `lead.replied`, `campaign.completed`, `deal.stage_changed`, `mailbox.unhealthy`,
`email.bounced`. Signed with per-endpoint secret (HMAC-SHA256 in `X-Signature`).

---

### Design notes
- **Everything expensive is `202 + jobId`** (scrape, audit, verify, score, personalize, proposal, bulk).
- **Send is never a direct API call** — you launch a campaign; the scheduler + sender worker enqueue actual sends with idempotency keys and pre-send suppression/cap checks.
- **Swagger/OpenAPI** auto-generated by NestJS from DTOs — this doc is the contract; the code is the source of truth once built.
