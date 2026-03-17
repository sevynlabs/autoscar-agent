# Architecture Research: Autoscar Agent

## Domain
AI SDR Platform — WhatsApp multichat, AI agent, web scraping, CRM Kanban

---

## Critical Architectural Constraint

**Webhook + Queue Decoupling:** Evolution API webhooks have a ~5s timeout. OpenAI calls take 5-15s. The AI agent MUST process in a BullMQ worker, NOT synchronously in the webhook handler. This is the single most important architectural decision.

```
Webhook → Redis Queue → AI Worker → Response via Evolution API
  (fast)    (instant)    (5-15s)      (async send)
```

---

## Major Components

### 1. Evolution API (External Docker Service)
- WhatsApp session management (QR code, multi-instance)
- Receives/sends WhatsApp messages
- Configured via .env (global API key, server URL)
- Communicates via: REST API + Webhooks

### 2. API Gateway + Webhook Handler (Fastify)
- Receives Evolution API webhooks (incoming messages)
- Receives Instagram webhooks
- Authentication & authorization (JWT)
- Rate limiting
- Routes to appropriate queue
- Communicates via: BullMQ queues → Redis

### 3. AI Agent (OpenAI Function-Calling Worker)
- BullMQ worker processes message jobs
- OpenAI Assistants API v2 with thread management
- Tool-calls available to the agent:
  - `scrape_vehicle(url)` → Scraper Service
  - `create_lead(data)` → CRM Engine
  - `update_lead(id, data)` → CRM Engine
  - `move_lead_stage(id, stage)` → CRM Engine
  - `add_note(lead_id, content)` → CRM Engine
  - `send_message(channel, to, content)` → Channel Manager
  - `send_photos(channel, to, photos[])` → Channel Manager
  - `notify_sellers_group(lead_summary)` → Channel Manager
- Persists conversation history per lead
- Communicates via: Direct service calls + Redis cache

### 4. Scraper Service (Playwright + Cheerio)
- Scrapes autoscar.com.br for vehicle data and photos
- Extracts: model, year, mileage, price, photos, specs
- Caches results in Redis (TTL: 1 hour)
- Stores photos in MinIO (S3-compatible)
- Resilience: selector fallbacks, retry logic, error alerts
- Communicates via: Internal API (called by AI Agent tools)

### 5. CRM Engine (Fastify + Prisma)
- Lead management (CRUD)
- Kanban pipeline with customizable stages
- Qualification rules engine (configurable per pipeline)
- Notes and activity log
- Lead assignment and distribution
- Communicates via: REST API (frontend) + Internal API (agent tools)

### 6. Channel Manager (Abstraction Layer)
- Unified interface for outbound messages
- WhatsApp via Evolution API REST
- Instagram via Graph API
- SMS via provider TBD
- Media handling (photos, files)
- Rate limiting per channel
- Communicates via: Internal API (called by AI Agent + CRM)

---

## Data Flow — Lead Qualification

```
1. Lead clicks ad → WhatsApp message → Evolution API
2. Evolution API → Webhook → API Gateway
3. API Gateway → BullMQ queue (instant, <100ms)
4. AI Worker picks up job
5. AI identifies vehicle interest from message
6. AI tool-call: scrape_vehicle(url) → Scraper gets data + photos
7. AI tool-call: create_lead(data) → CRM creates Kanban card
8. AI tool-call: send_photos(whatsapp, lead, photos[]) → Carousel sent
9. AI continues conversation, qualifying lead
10. AI tool-call: update_lead(id, qualification_data) → CRM updated
11. AI tool-call: move_lead_stage(id, "qualified") → Card moves
12. AI tool-call: add_note(lead_id, summary) → Qualification note saved
13. AI tool-call: notify_sellers_group(summary) → Group WhatsApp notified
```

---

## Data Model (Core Entities)

```
User (id, email, name, role, tenant_id)
Pipeline (id, name, stages[], tenant_id)
Stage (id, name, order, pipeline_id)
Lead (id, name, phone, city, stage_id, pipeline_id, assigned_to, tenant_id)
LeadNote (id, lead_id, content, created_by, type[ai|human])
Conversation (id, lead_id, channel, external_id)
Message (id, conversation_id, role[lead|agent|human], content, media[])
QualificationRule (id, pipeline_id, field, operator, value, stage_trigger)
WhatsAppInstance (id, name, number, evolution_instance_id, status, tenant_id)
Vehicle (id, portal_url, model, year, price, mileage, photos[], cached_at)
```

**Multi-tenant ready:** All tables include `tenant_id` (nullable in v1, required in SaaS).

---

## Suggested Build Order (Dependency-Driven)

| Phase | Component | Depends On |
|-------|-----------|------------|
| 1 | Infrastructure (Docker Compose: PG, Redis, MinIO, Evolution API) | Nothing |
| 2 | Channel Integration (Evolution API webhook + send/receive) | Infrastructure |
| 3 | Scraper Service (Playwright + cache) | Infrastructure |
| 4 | AI Agent (OpenAI + tools + queue) | Channels + Scraper |
| 5 | CRM Backend API (leads, pipeline, notes) | Infrastructure |
| 6 | CRM Frontend (Next.js Kanban, multichat, dashboard) | CRM Backend + Channels |
| 7 | Advanced (follow-up, Instagram, SMS, API/webhooks) | All above |

**Key insight:** Scraper and Channel Integration are independent — build in parallel.

---
*Researched: 2026-03-17*
