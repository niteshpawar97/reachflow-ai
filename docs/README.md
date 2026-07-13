# ReachFlow AI — Planning & Architecture

Phase-0 planning set. **No source code exists yet — nothing gets built until the roadmap is approved.**

## What ReachFlow AI is
An AI-powered cold-email + lead-generation platform to sell dev/AI services to international clients.
Built **internal-tool-first** (revenue ASAP), architected to **productize into SaaS** later.
Wedge: vertical-native, **website-audit-driven** personalization + an integrated find→audit→personalize→
send→reply→close→propose loop, on connect-your-own-mailbox deliverability.

## Read in this order
| # | Doc | What it covers |
|---|-----|----------------|
| 0 | [00-decisions.md](00-decisions.md) | Confirmed decisions, principles, open questions |
| 1 | [01-PRD.md](01-PRD.md) | Goals, users, features, metrics, NFRs, constraints |
| 2 | [02-competitor-analysis.md](02-competitor-analysis.md) | Instantly/Smartlead/Apollo/Clay/Lemlist/Reply/Mailshake + our wedge |
| 3 | [03-architecture.md](03-architecture.md) | Modular monolith, queues, deliverability, security, deploy, folders |
| 4 | [04-modules.md](04-modules.md) | All 20 modules specified (purpose→scalability) |
| 5 | [05-database.md](05-database.md) | PostgreSQL schema, ER, indexes, soft-delete, audit |
| 6 | [06-api.md](06-api.md) | REST API contract (no implementation) |
| 7 | [07-ui.md](07-ui.md) | Every screen, navigation, responsive, accessibility |
| 8 | [08-ai-architecture.md](08-ai-architecture.md) | Model tiering, grounding, cost governance, evals |
| 9 | [09-roadmap.md](09-roadmap.md) | ~80 one-day, independently-testable milestones |

## Confirmed stack
NestJS + TypeScript · PostgreSQL + Prisma · Redis + BullMQ · React + Vite (Tailwind, TanStack Query, RHF,
Recharts, Framer Motion) · Docker/Nginx · Anthropic Claude (Opus 4.8 depth / Haiku 4.5 volume) ·
Gmail/Graph + SMTP/IMAP · Playwright scraping.

## Decision profile (Phase 0)
Internal-tool-first · connect-your-own-mailboxes · in-house scraping (thin MVP) · solo dev, revenue ASAP ·
PostgreSQL · NestJS.

## Status & next step
Planning complete. **MVP = milestones M1–M70** (money-path). Awaiting roadmap approval; then we build
**one milestone at a time**, each ending with its test passing.
