# ReachFlow AI — Product Requirements Document (PRD)

> Phase 2 deliverable. Scope: the internal tool we build first, with the SaaS target it grows into.

## 1. Business goals
- **G1 (primary):** Book qualified sales meetings for our dev/AI-services agency with international
  clients, at a cost and effort far below manual prospecting.
- **G2:** Prove that AI-driven personalization + website-audit hooks measurably beat generic cold email
  (reply rate, meeting rate).
- **G3:** Build the workflow and data assets that let us **productize into a SaaS** for other agencies/freelancers.
- **G4:** Protect sender reputation and stay compliant across US/CA/UK/EU/AU/UAE so the channel is durable.

**North-star metric:** qualified meetings booked per month per active sending mailbox.

## 2. Target users
**Now (internal):**
- *Operator (you):* runs campaigns, approves AI drafts, works the inbox, closes deals. Power user.

**Later (SaaS ICP):**
- Solo founders & small dev/marketing agencies selling B2B services who need pipeline but can't afford
  Clay + Apollo + Instantly stacked together.

**The people we email (lead personas):**
- SMB owners / founders / CEOs, marketing heads, IT/ops managers at companies whose websites reveal a
  need (slow, no HTTPS, dated stack, no CTA, hiring devs, growing).

## 3. Pain points we solve
| Pain | Today | With ReachFlow |
|------|-------|----------------|
| Finding good-fit leads | Hours of manual research | Scraper + website analyzer surfaces companies with visible needs |
| Personalization at scale | Generic templates → ignored | AI writes a unique, evidence-based opener per lead (their site's actual problems) |
| Landing in inbox not spam | Guesswork | Warmup, rotation, daily caps, domain/mailbox health monitoring |
| Managing replies | Chaos across inboxes | Unified inbox, AI classification, suggested replies |
| Turning replies into deals | Lost in email | Built-in CRM pipeline + AI proposal generator |
| Staying legal | Ignored (risky) | Suppression, unsubscribe, identity, per-region rules baked in |

## 4. Competitor summary
(Full teardown in `02-competitor-analysis.md`.) Instantly & Smartlead own **sending/deliverability**;
Apollo owns **data**; Clay owns **enrichment/automation**; Lemlist/Reply/Mailshake own **sequencing/UX**.
None is purpose-built to sell *dev/AI services* using **website-audit-driven** personalization. That niche
+ an integrated "find → audit → personalize → send → reply → close → propose" loop is our wedge.

## 5. Core features (MVP — the money path)
1. **Auth & single workspace** (D1) — login, roles stubbed, workspace settings.
2. **Mailbox connection** — Gmail/M365 OAuth + SMTP/IMAP; health + daily caps.
3. **Mailbox warmup** — automated ramp + peer interactions (or provider warmup) to build reputation.
4. **Lead import + thin scraping** — CSV import always; Google Maps + website crawl for discovery.
5. **Website Analyzer** — automated technical/marketing audit → structured findings + AI audit summary.
6. **Email verification** — MX/SMTP/disposable/catch-all/risk score; only valid emails enter campaigns.
7. **Lead scoring** — 0–100 fit/intent score from audit + firmographics + signals.
8. **AI personalization** — per-lead subject, opener, site observation, opportunity, pain, CTA.
9. **Campaign builder** — multi-sender rotation, sequences, random intervals, timezone, daily limits, stop-on-reply.
10. **Follow-up engine** — trigger-based AI follow-ups (no-reply/opened/etc.).
11. **Unified inbox** — IMAP sync, AI reply classification, conversation summary, suggested reply.
12. **CRM pipeline** — lead → … → won/lost, activity timeline.
13. **Analytics (core)** — sent/delivered/open/reply/meetings + domain & mailbox health.
14. **Compliance core** — suppression list, unsubscribe link + handling, identity/footer, opt-out honoring.

## 6. Advanced features (post-MVP)
- **Decision-maker finder** (name/role/email/LinkedIn enrichment).
- **Meeting booking** (calendar + booking links + reminders).
- **AI proposal generator** (PDF, pricing/timeline/milestones, e-signature).
- **A/B testing** with statistical significance.
- **Deeper enrichment** (tech stack, hiring signals, funding).
- **Deliverability lab** (spam-word linting, inbox-placement tests, seed lists).

## 7. Future roadmap (productize → scale)
- **Multi-tenancy & billing** (Stripe, plans, credits/usage metering) → SaaS launch.
- **Team/RBAC** (Admin/Staff/Client), audit logs, 2FA, API keys.
- **Automation engine** — n8n-style visual workflow builder (if/else/delay/webhook/HTTP/AI/email/CRM/scraper nodes).
- **Developer platform** — public REST API, webhooks, Swagger, SDK, CLI.
- **Marketplace** — templates, audit playbooks, niche lead packs.

## 8. Monetization (SaaS phase)
- **Plans by mailboxes connected + monthly send volume + AI/enrichment credits.**
- Starter / Growth / Agency tiers; overage on credits.
- Add-ons: extra enrichment credits, proposal e-sign, premium data sources.
- Internally (now): value = meetings booked / pipeline generated; track as if it were revenue.

## 9. Success metrics
**Outreach quality:** delivery rate ≥ 98%, open ≥ 45%, reply ≥ 5%, positive-reply ≥ 1.5%,
meetings/1k sends ≥ 5, bounce < 3%, spam-complaint < 0.1%.
**Deliverability health:** domain/mailbox health score, blacklist incidents = 0, warmup ramp on schedule.
**AI quality:** personalization approval rate (human accepts draft) ≥ 80%, reply-classification accuracy ≥ 90%.
**Ops/cost:** AI cost per booked meeting, scraping cost per verified lead, pipeline value / infra cost.
**SaaS (later):** activation (first campaign sent), retention, MRR, NRR, CAC payback.

## 10. Non-functional requirements
- **Reliability:** sending must be idempotent & resumable; no double-sends after a crash. Queue-backed.
- **Scalability:** handle 100k+ leads and 10k+ sends/day via horizontal workers; design for millions of leads.
- **Security:** encryption at rest for tokens/credentials (per-mailbox OAuth tokens, SMTP passwords),
  RBAC-ready, audit logs, rate limiting, webhook signature verification.
- **Deliverability guardrails:** enforced daily caps, warmup gating, random intervals, stop-on-reply.
- **Compliance:** unsubscribe honored globally within 1 send-cycle; suppression enforced pre-send;
  data-subject delete/export (GDPR) supported.
- **Observability:** structured logs, per-job cost/latency metrics, error tracking, health dashboards.
- **Performance:** dashboard API p95 < 300ms on core reads; scraping/AI are async, never block UI.
- **Cost control:** model tiering + caching; every AI/scrape job logs tokens/cost.

## 11. Technical constraints
- Node.js + TypeScript, **NestJS**, **PostgreSQL + Prisma**, Redis + BullMQ, React + Vite, Docker.
- Email provider **sending limits** (Gmail/M365) → mailbox rotation is mandatory, not optional.
- **Scraping ToS/legal risk** → prefer public data + our own crawl; treat LinkedIn scraping as high-risk/deferred.
- Solo maintainer → favor a **modular monolith** now, split to services only when a bottleneck proves it.
- AI/token cost is a real budget line → enforce budgets and caching.

## 12. Explicitly out of scope for MVP
Billing, multi-tenant admin, 2FA/API keys/SDK/CLI, visual automation builder, e-signature,
LinkedIn scraping, phone/SMS/multichannel. All are on the roadmap, none block first revenue.
