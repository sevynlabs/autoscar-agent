# Project Research Summary

**Project:** Autoscar Agent
**Domain:** AI SDR Platform — WhatsApp-first CRM with AI agent, web scraping, automotive lead qualification
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

Autoscar Agent is a niche but well-defined product: an AI Sales Development Representative running on WhatsApp, specialized for the Brazilian automotive market. The core loop is inbound WhatsApp lead → AI qualification conversation → autoscar.com.br vehicle data scraping → photo carousel sent to lead → CRM Kanban updated → vendedor notified. No commercial platform combines all four of these capabilities (WhatsApp-native + AI judgment + domain-specific scraping + Brazilian automotive context), which creates a genuine competitive moat against Kommo, RD Station, and Respond.io.

The recommended stack is Node.js 22 + TypeScript + Fastify on the backend, PostgreSQL + Prisma + Redis as the data layer, Next.js 15 + shadcn/ui on the frontend, OpenAI function-calling for the AI agent, Evolution API 2.x for WhatsApp, and Playwright for scraping — all containerized with Docker Compose on a VPS. The architecture's single most critical constraint is that the AI agent must run asynchronously via BullMQ worker, never synchronously in the webhook handler, because Evolution API has a 5-second timeout and OpenAI calls take 5–15 seconds.

The primary risks are WhatsApp number bans from automation patterns, stateless AI agent losing conversation context, scraper fragility from portal HTML changes, and OpenAI token cost spirals from unoptimized prompt context. All five critical pitfalls must be addressed in Phase 1 — they are not retroactively fixable without significant rework. The architecture must be built with multi-tenant readiness (nullable `tenant_id` on all tables) from day one to avoid a schema rewrite when the product evolves to SaaS.

---

## Key Findings

### Recommended Stack

The stack is purpose-built for event-driven, async-heavy WhatsApp automation. Fastify is preferred over Express for webhook performance; Prisma is preferred over Drizzle for migration tooling; OpenAI function-calling is preferred over LangChain to avoid over-abstraction; Playwright is preferred over Puppeteer for resilience. All infrastructure runs in Docker Compose on a VPS — no external managed services required (MinIO replaces S3, PostgreSQL replaces Firebase/Supabase).

**Core technologies:**
- **Node.js 22 + TypeScript 5 + Fastify 5:** Async-first runtime for real-time messaging, type-safe contracts, fastest webhook handling in Node ecosystem
- **BullMQ 5 + Redis 7:** Mandatory queue layer — decouples 5s webhook timeout from 5–15s AI processing
- **PostgreSQL 16 + Prisma 6:** Relational CRM data with JSONB for flexible qualification rules; Prisma for safe migrations
- **OpenAI gpt-4o + Assistants API v2:** Best Portuguese-language quality; thread management for conversation memory; function-calling for CRM tool autonomy
- **Evolution API 2.x:** Brazilian standard for WhatsApp multi-instance automation with webhook delivery
- **Playwright 1.x + Cheerio:** Handles JS-rendered portal pages; Cheerio for fast post-fetch HTML parsing
- **Next.js 15 + shadcn/ui + dnd-kit:** SSR dashboard, Kanban drag-and-drop, Socket.IO for real-time CRM updates
- **Docker Compose + Nginx + Let's Encrypt:** Self-hosted full stack, single compose file, SSL termination

### Expected Features

**Must have (table stakes):**
- WhatsApp multichat inbox with conversation history per lead
- AI-to-human handoff with vendedor notification via WhatsApp group
- Lead card auto-creation with Kanban pipeline drag-and-drop
- Pipeline stage movement, lead notes, filters and search
- Multi-user with roles, mobile-responsive UI

**Should have (differentiators):**
- AI SDR with autonomous qualification judgment — makes decisions, not just responses
- autoscar.com.br vehicle scraping injected into conversations in real time
- WhatsApp photo carousel of scraped vehicle (actual photos, not links)
- Configurable qualification rules per pipeline (what "qualified" means per business)
- AI-generated qualification summary notes for vendedor handoff
- AI agent with full CRM autonomy via tool-calls (create, move, update, note cards)
- Follow-up automation for re-engagement

**Defer to v2+:**
- Instagram DM integration (channel abstraction built in v1, activation in v2)
- External webhook + API for third-party integrations
- Built-in billing and SaaS plans
- Native mobile app
- Email marketing

### Architecture Approach

The architecture is a 6-component async pipeline. The webhook handler is intentionally thin — it only validates and enqueues. All AI processing, scraping, and CRM mutations happen in BullMQ workers. The Channel Manager abstracts outbound messaging so Instagram and SMS can be added without changing the AI agent. All data models carry a nullable `tenant_id` from day one to enable SaaS migration without schema rewrites.

**Major components:**
1. **Evolution API** — WhatsApp session management, QR code, inbound/outbound messages via REST + webhooks
2. **API Gateway (Fastify)** — Webhook receiver, JWT auth, rate limiting, enqueues to BullMQ
3. **AI Agent (BullMQ Worker + OpenAI)** — Processes lead conversations, executes tool-calls against Scraper + CRM + Channel Manager
4. **Scraper Service (Playwright + Cheerio)** — Fetches autoscar.com.br vehicle data and photos, caches in Redis + MinIO
5. **CRM Engine (Fastify + Prisma)** — Lead CRUD, Kanban pipeline, qualification rules engine, activity log
6. **Channel Manager** — Unified outbound abstraction for WhatsApp, Instagram, SMS

### Critical Pitfalls

1. **WhatsApp number ban from automation patterns** — Rate limit to 1 msg/second, random delays for carousels (2–5s), warm up new numbers gradually. Must be in Phase 1.
2. **Stateless AI agent loses conversation context** — Persist conversation history per lead in DB, load into OpenAI context every turn, use Assistants API threads. Non-negotiable from day one.
3. **Web scraper fragility from HTML changes** — Validation layer rejects incomplete scrapes, fallback to manual task, daily health check scrape, multiple selector fallback chains.
4. **OpenAI token cost spiral** — Never send raw HTML to OpenAI; extract to structured JSON first. Limit context to last 20 messages. Use gpt-4o-mini for classification, gpt-4o only for qualification decisions.
5. **Race conditions producing duplicate CRM cards** — Deduplicate at queue level using phone as job ID, database unique constraint on (phone, pipeline_id), BullMQ 1-second debounce window.

---

## Implications for Roadmap

Based on research, the architecture has clear dependency ordering with two parallel tracks that can merge before the frontend phase.

### Phase 1: Core Infrastructure + Async Foundation
**Rationale:** Everything depends on Docker Compose environment, Evolution API session persistence, and the BullMQ queue architecture. Starting without correct infrastructure guarantees rework (especially Evolution API Docker volumes and session persistence — a moderate pitfall that kills productivity if discovered late).
**Delivers:** Running Docker Compose stack with PostgreSQL, Redis, MinIO, Evolution API, Nginx. Fastify webhook receiver. BullMQ queue wired. All WhatsApp sessions survive Docker restarts.
**Addresses:** Table stakes — multi-number WhatsApp connection, multi-user foundation
**Avoids:** Pitfalls #5 (race conditions), #6 (Evolution session loss), #11 (volume misconfiguration), #14 (sync webhook processing), #15 (VPS resource planning)

### Phase 2: WhatsApp Channel + Scraper Service (Parallel Tracks)
**Rationale:** These two components are independent (ARCHITECTURE.md explicitly flags this) and both are prerequisites for the AI agent. Building in parallel accelerates the critical path.
**Delivers:** Bidirectional WhatsApp messaging (receive + send + photos). Playwright scraper extracting autoscar.com.br vehicle data with Redis cache and MinIO photo storage. Anti-bot resilience from day one.
**Addresses:** WhatsApp multichat inbox, photo carousel, vehicle data extraction
**Avoids:** Pitfalls #1 (WhatsApp ban — rate limits from day one), #3 (scraper fragility — validation + fallbacks from day one), #9 (anti-bot detection)

### Phase 3: AI Agent Core
**Rationale:** Requires channels and scraper to be operational before meaningful agent tool-calls can be tested end-to-end.
**Delivers:** BullMQ AI worker, OpenAI Assistants API v2 thread management, full tool-call set (scrape_vehicle, create_lead, update_lead, move_stage, add_note, send_message, send_photos, notify_sellers_group). Full lead qualification loop working end-to-end via WhatsApp.
**Addresses:** AI SDR qualification, photo carousel, qualification summary notes, vendedor notification
**Avoids:** Pitfalls #2 (stateless agent), #4 (token cost spiral), #10 (prompt injection), #12 (hardcoded rules)

### Phase 4: CRM Backend + Kanban
**Rationale:** CRM API can be built partially in parallel with AI agent (since agent uses internal tool-calls), but full CRM backend with qualification rules engine is validated here.
**Delivers:** Full lead CRUD API, configurable Kanban pipeline stages, qualification rules engine, human_override flag for agent/human conflict resolution, activity log (agent vs human edits).
**Addresses:** Lead card auto-creation, pipeline stage movement, lead notes, filters, qualification rules
**Avoids:** Pitfall #8 (CRM state conflict — human_override flag), #12 (configurable rules in DB not prompts)

### Phase 5: CRM Frontend + Multichat UI
**Rationale:** Frontend consumes completed backend. Building UI before API is stable wastes iteration cycles.
**Delivers:** Next.js dashboard with Kanban drag-and-drop (dnd-kit), multichat inbox with real-time updates (Socket.IO), lead detail view with conversation history, basic analytics dashboard.
**Addresses:** Mobile-responsive UI, multichat inbox, Kanban UX, vendedor workflow
**Avoids:** Pitfall #13 (human handoff — UI trigger for agent pause/resume)

### Phase 6: Advanced Channels + Automation
**Rationale:** Instagram and follow-up automation are v1 differentiators but not blocking for core workflow. Channel abstraction is already in place from Phase 2.
**Delivers:** Instagram DM integration via Graph API, follow-up automation sequences, external webhook API.
**Addresses:** Instagram DM, follow-up re-engagement, external integrations
**Avoids:** Pitfall #7 (Instagram complexity — isolated from WhatsApp, abstraction layer absorbs differences)

### Phase Ordering Rationale

- Infrastructure before everything else — Docker volumes and Evolution API session persistence are impossible to retrofit cleanly
- WhatsApp + Scraper in parallel before AI agent — agent tool-calls need both to be testable
- CRM Backend before Frontend — eliminates UI rework from API changes
- Instagram deferred to Phase 6 — 24-hour messaging window and higher ban risk demand isolated, careful implementation after core product is stable

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (AI Agent):** OpenAI Assistants API v2 thread management patterns for multi-tenant context, tool-call error handling and retry strategies, Portuguese SDR conversation design
- **Phase 6 (Instagram):** Meta Graph API 24-hour messaging window enforcement, Instagram DM rate limits, account restriction recovery procedures

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** Docker Compose patterns are well-documented; Evolution API has clear Docker setup docs
- **Phase 4 (CRM Backend):** Standard CRUD + Kanban with Prisma is well-trodden
- **Phase 5 (CRM Frontend):** Next.js + shadcn/ui + dnd-kit all have extensive documentation

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major technologies are production-proven in Brazilian WhatsApp automation context; Evolution API is the clear standard |
| Features | HIGH | Competitive landscape clear; table stakes vs differentiators well-defined; anti-features explicitly justified |
| Architecture | HIGH | Dependency ordering is logical and the async queue constraint is non-negotiable and well-understood |
| Pitfalls | HIGH | 5 critical pitfalls all have concrete, actionable prevention strategies; phase mapping is explicit |

**Overall confidence:** HIGH

### Gaps to Address

- **SMS provider selection:** PITFALLS.md and STACK.md note SMS as "provider TBD" — needs selection before Phase 6 (Twilio vs Zenvia vs Vonage for Brazilian market)
- **autoscar.com.br scraping validation:** Actual portal HTML structure needs verification during Phase 2 implementation; selector strategies must be tested against live site
- **OpenAI cost modeling:** Token usage per lead conversation needs empirical measurement in Phase 3 to validate cost thresholds before scaling
- **VPS sizing validation:** 8GB RAM recommendation for full stack needs confirmation against actual Playwright memory footprint with concurrent scraping jobs

---

## Sources

### Primary (HIGH confidence)
- Evolution API official docs — WhatsApp multi-instance, webhook format, session persistence
- OpenAI Assistants API v2 docs — thread management, function-calling, tool-call patterns
- BullMQ docs — queue deduplication, job debouncing, worker concurrency
- Prisma 6 docs — migration tooling, JSONB support, multi-tenant patterns
- Playwright docs — JS-rendered page handling, selector strategies, anti-detection

### Secondary (MEDIUM confidence)
- Brazilian WhatsApp automation community — rate limit thresholds, ban patterns, warm-up strategies
- OpenAI community — token optimization patterns for conversational agents
- autoscar.com.br — portal structure inferred, needs empirical validation during scraper build

### Tertiary (LOW confidence)
- Instagram Graph API DM limits for automotive context — needs validation against Meta's current enforcement policies
- SMS provider comparison for Brazilian market — Twilio vs Zenvia vs Vonage needs direct pricing/deliverability research

---

*Research completed: 2026-03-17*
*Ready for roadmap: yes*
