# ReachFlow AI — Phase 0 Decisions Log

> Living record of the foundational choices. Every later doc inherits from here.
> Last updated: 2026-07-13

## The product in one line
An AI-powered cold-email + lead-generation platform used **by us** to sell dev/AI services
(custom software, web, automation, CRM/ERP, mobile, scraping, APIs) to international clients
(USA, Canada, UK, Europe, Australia, UAE), architected so it can later be **productized into SaaS**.

## Confirmed decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Build order | **Internal tool first**, SaaS-ready architecture | Revenue fast, validate AI + workflow, avoid a rewrite later |
| D2 | Email sending | **Connect-your-own-mailboxes** (Gmail/M365 OAuth + SMTP/IMAP) | Best deliverability, no owned-IP reputation burden at MVP |
| D3 | Lead data | **In-house scraping + enrichment**, MVP kept *thin* (1–2 sources + website analysis) | Data is the moat; but a full scraper farm would sink a solo dev, so scope it |
| D4 | Capacity | **Solo dev, revenue ASAP**, human-in-the-loop | AI drafts/classifies; human approves. Money-path modules first |
| D5 | Database | **PostgreSQL** (over speced MySQL) | JSONB for scraped/enrichment blobs, arrays/enums, concurrency, RLS for future tenants |
| D6 | Backend framework | **NestJS** (over bare Express) | Structure/DI/guards/Swagger keeps 20 modules maintainable solo |
| D7 | Frontend | **React + Vite** (per spec) | Dashboard SPA, no SSR need; TanStack Query + RHF + Recharts + Framer Motion |
| D8 | Module list | **The 20-module master spec is canonical** | We sequence it, we don't reinvent it |

## Guiding principles (the non-negotiables)
1. **Deliverability is the product.** AI copy is commodity. Inbox placement, warmup, rotation, and
   domain health decide whether anything else matters.
2. **Human-in-the-loop by default.** Full autonomous sending at volume burns domains. AI proposes; human disposes.
3. **Compliance is a first-class feature, not a checkbox.** GDPR/PECR (EU/UK) and CASL (Canada) are sharp.
   Suppression lists, one-click unsubscribe, physical address, and identity are built in from day 1.
4. **Multi-tenant seams from day 1, multi-tenant features later.** Every table carries `workspace_id`;
   we don't build billing/tenant admin until we productize.
5. **Cost governance on AI + scraping.** Token budgets, model tiering (Haiku for volume, Opus for depth),
   caching, and per-job cost logging from the start.

## Open questions still to resolve (before/at relevant milestones)
- **Proxy provider** for scraping (residential vs datacenter) + budget ceiling.
- **Email verification provider** — build SMTP-check ourselves vs. use an API (accuracy vs. cost/deliverability of the checker itself).
- **Which 1–2 scraping sources for MVP** (recommend: Google Maps + company-website crawl; defer LinkedIn due to ToS/legal heat).
- **Calendar**: Cal.com self-host vs. Google/Microsoft calendar direct.
- **Hosting target** for launch (single Hetzner VPS vs. Railway/Render) + backup destination.
- **AI provider account** and monthly token budget.

## Known tensions (accepted, managed)
- D3 (in-house scraping) vs D4 (solo/ASAP): resolved by scoping scraping thin at MVP and expanding post-revenue.
- Master spec is full SaaS (billing, n8n-style automation builder, SDK/CLI) vs D1 internal-first:
  resolved by roadmap sequencing — heavy SaaS modules land in later phases.
