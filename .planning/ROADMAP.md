# Roadmap: Autoscar Agent

## Overview

Four phases that transform a blank repo into a fully operational AI SDR platform for the Brazilian automotive market. Phase 1 builds the async infrastructure and connects WhatsApp + scraper. Phase 2 wires the AI agent to qualify leads end-to-end. Phase 3 delivers the full CRM and multichat UI for operators. Phase 4 adds authentication, analytics, additional channels, and external integrations to complete the v1 platform.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - Async infrastructure, Docker stack, WhatsApp connection, autoscar.com.br scraper
- [x] **Phase 2: AI Agent** - Autonomous SDR qualification loop, photo carousel, CRM tool-calls, seller notification (completed 2026-03-18)
- [x] **Phase 3: CRM + Multichat** - Full Kanban CRM, multichat inbox, human handoff, real-time WebSocket (completed 2026-03-18)
- [ ] **Phase 4: Platform + Channels** - Auth, dashboard analytics, Instagram DM, SMS, external API + webhooks

## Phase Details

### Phase 1: Foundation
**Goal**: The async pipeline is running and an operator can connect a WhatsApp number, send a message, and receive vehicle data back from autoscar.com.br
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-06, PLAT-07, WAPP-01, WAPP-02, WAPP-03, SCRP-01, SCRP-02, SCRP-03
**Success Criteria** (what must be TRUE):
  1. Operator runs `docker-compose up` and the full stack (PostgreSQL, Redis, MinIO, Evolution API, Fastify, Nginx) starts without errors
  2. Operator scans QR code in the panel and the WhatsApp number is connected; multiple numbers can be connected simultaneously
  3. A message sent to a connected WhatsApp number is received by the system and a reply is sent back in real time
  4. Given a valid autoscar.com.br vehicle URL, the scraper returns structured data (model, year, km, price, photos); result is cached and re-requests skip the network call; failed scrapes surface a clear validation error
  5. API keys (Evolution API, OpenAI) are configured exclusively via `.env` — no hardcoded values exist anywhere
**Plans:** 4/4 plans complete

Plans:
- [x] 01-01-PLAN.md — Docker stack + project scaffold + Prisma schema
- [x] 01-02-PLAN.md — WhatsApp integration (Evolution API client, webhook, BullMQ pipeline)
- [x] 01-03-PLAN.md — Autoscar.com.br scraper (Playwright + Cheerio + Redis cache + Zod)
- [x] 01-04-PLAN.md — Wire scraper into message worker + end-to-end verification

### Phase 2: AI Agent
**Goal**: The AI SDR autonomously qualifies a lead from first WhatsApp message to seller notification, with no human intervention
**Depends on**: Phase 1
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07, AGENT-08, AGENT-09, WAPP-04, WAPP-07
**Success Criteria** (what must be TRUE):
  1. Agent correctly identifies the vehicle of interest from the lead's first message or the ad context and fetches its data from autoscar.com.br
  2. Agent sends a WhatsApp carousel of 3-5 vehicle photos to the lead without human involvement
  3. Agent conducts a qualification conversation (interest, credit condition, city, payment method) and autonomously decides when the lead is qualified or disqualified
  4. Agent creates a CRM card at conversation start, updates lead data as the conversation progresses, and moves the card through pipeline stages automatically
  5. On qualification completion, agent generates a summary note and sends the qualified lead summary to the sellers WhatsApp group; follow-up messages are sent automatically to leads who go silent
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md — Prisma CRM schema expansion, seed pipeline, CRM + conversation services
- [x] 02-02-PLAN.md — OpenAI agentic loop with 7 tool-calls, system prompt, replace echo-bot
- [x] 02-03-PLAN.md — WhatsApp photo carousel (sendMedia), follow-up queue + worker, seller notification

### Phase 3: CRM + Multichat
**Goal**: Operators can manage all leads in a visual Kanban CRM and monitor all WhatsApp conversations simultaneously, with the ability to take over from the AI
**Depends on**: Phase 2
**Requirements**: CRM-01, CRM-02, CRM-03, CRM-04, CRM-05, CRM-06, CRM-07, WAPP-05, WAPP-06
**Success Criteria** (what must be TRUE):
  1. Operator sees all leads as cards in a Kanban board and can drag-and-drop cards between stages; pipeline stages can be created, renamed, reordered, and deleted
  2. Operator can configure what "qualified" means per pipeline (interest level, credit, payment conditions) without touching code
  3. Operator can search and filter leads by name, phone, stage, or vehicle and see the full conversation history and AI-generated notes for any lead
  4. Operator can edit any lead's data manually; CRM updates from both the agent and manual edits appear in real time for all connected users via WebSocket
  5. Vendor clicks a "take over" button in the multichat inbox and the AI immediately pauses for that conversation; all active conversations across multiple WhatsApp numbers are visible in a single inbox
**Plans:** 5/5 plans complete

Plans:
- [x] 03-01-PLAN.md — Backend REST API routes + Socket.IO plugin + Prisma QualificationRule + humanOverride guard
- [x] 03-02-PLAN.md — Next.js 15 frontend scaffold + Docker service + Nginx routing
- [x] 03-03-PLAN.md — Kanban CRM board with dnd-kit drag-and-drop + lead detail + edit form
- [x] 03-04-PLAN.md — Multichat inbox + human handoff + pipeline settings + qualification rules UI
- [x] 03-05-PLAN.md — Socket.IO real-time wiring + full Phase 3 verification checkpoint

### Phase 4: Platform + Channels
**Goal**: The platform has secure multi-user access, analytics visibility, Instagram and SMS channels, and an external API for third-party integrations
**Depends on**: Phase 3
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, CHAN-01, CHAN-02, CHAN-03
**Success Criteria** (what must be TRUE):
  1. User can log in with email/password; admin can create users, assign roles, and revoke access; unauthenticated requests to any API endpoint are rejected
  2. Dashboard displays lead volume, conversion rate by stage, and agent performance metrics; data is filterable by date range
  3. Operator can connect an Instagram account and the agent receives and responds to Instagram DMs using the same qualification flow; SMS follow-up messages are sent automatically after WhatsApp follow-up sequence completes
  4. All WhatsApp, Instagram, and SMS conversations are visible in a single unified chat interface
  5. Developer can register a webhook URL to receive events (new lead, lead qualified, stage changed) and can call the documented external REST API to read lead data
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete    | 2026-03-18 |
| 2. AI Agent | 3/3 | Complete    | 2026-03-18 |
| 3. CRM + Multichat | 5/5 | Complete    | 2026-03-19 |
| 4. Platform + Channels | 0/TBD | Not started | - |
