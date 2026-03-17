# Stack Research: Autoscar Agent

## Domain
AI SDR Platform — WhatsApp-first CRM with AI agent, web scraping, Docker/VPS deployment

---

## Recommended Stack

### Backend — Runtime & Framework

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Node.js** | 22 LTS | Async-first for real-time messaging, Evolution API ecosystem is JS-native | High |
| **TypeScript** | 5.x | Type safety critical for CRM data models and API contracts | High |
| **Fastify** | 5.x | Fastest Node.js framework, excellent plugin ecosystem, webhook handling | High |
| **BullMQ** | 5.x | Job queue for async AI processing — webhook → queue → AI → response | High |

**Why NOT Express:** Slower, no native TypeScript support, Fastify has better webhook handling and validation.
**Why NOT NestJS:** Over-engineered for this scope. Fastify plugins provide enough structure.

### Database & Cache

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **PostgreSQL** | 16 | Relational data (leads, pipeline, users), JSONB for flexible qualification rules | High |
| **Prisma** | 6.x | Type-safe ORM, migration management, future multi-tenant support | High |
| **Redis** | 7.x | Session cache, BullMQ backend, scraping cache, rate limiting | High |
| **MinIO** | Latest | S3-compatible object storage for vehicle photos, self-hosted on VPS | Medium |

**Why NOT MongoDB:** CRM data is relational (leads → stages → pipelines → users). JSONB handles flexible fields.
**Why NOT Drizzle:** Prisma has better migration tooling and more mature ecosystem.

### Frontend

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Next.js** | 15 | SSR for dashboard, API routes, React Server Components | High |
| **Tailwind CSS** | 4.x | Utility-first, fast iteration for modern UI | High |
| **shadcn/ui** | Latest | Accessible components, Kanban/table primitives, customizable | High |
| **dnd-kit** | 6.x | Drag-and-drop for Kanban pipeline | High |
| **Socket.IO** | 4.x | Real-time CRM updates, live chat, agent status | High |
| **Recharts** | 2.x | Dashboard charts and analytics | Medium |

**Why NOT Vite+React SPA:** Next.js gives SSR for SEO-irrelevant dashboard BUT provides API routes and better DX.

### AI Agent

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **OpenAI API** | v1 (gpt-4o) | Function-calling for CRM tools, best Portuguese quality | High |
| **OpenAI Assistants API** | v2 | Thread management, tool-calls (scrape_vehicle, update_crm, notify_sellers) | Medium |

**Why NOT LangChain:** Unnecessary abstraction. OpenAI function-calling is sufficient and more predictable.
**Why NOT local LLMs:** Portuguese quality not competitive with GPT-4o for conversational SDR.

### WhatsApp & Messaging

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Evolution API** | 2.x | Brazilian standard for WhatsApp automation, multi-instance, QR code | High |
| **Instagram Graph API** | v21 | Official Meta API for Instagram DM | Medium |

### Web Scraping

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Playwright** | 1.x | Handles JS-rendered pages, screenshot capability, resilient selectors | High |
| **Cheerio** | 1.x | Fast HTML parsing after Playwright fetches page | High |

**Why NOT Puppeteer:** Playwright is faster, better API, multi-browser support.
**Why NOT HTTP-only scraping:** Portal likely has JS-rendered content.

### Infrastructure

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Docker Compose** | v2 | Single docker-compose.yml for entire stack on VPS | High |
| **Nginx** | Latest | Reverse proxy, SSL termination, WebSocket support | High |
| **Let's Encrypt** | — | Free SSL via Certbot | High |

---

## Architecture Note — Multi-Tenant Migration Path

Add `tenant_id` column to all tables from v1 (nullable, default constant). When SaaS migration happens, it's a config change, not a schema rewrite.

---

## What NOT to Use

| Technology | Reason |
|-----------|--------|
| Express.js | Slower than Fastify, less TypeScript support |
| MongoDB | CRM data is relational |
| LangChain | Over-abstraction for single-provider AI |
| Puppeteer | Playwright is superior in every way |
| Firebase | Vendor lock-in, not self-hosted |
| Supabase | Good but adds dependency, PostgreSQL direct is simpler on VPS |

---
*Researched: 2026-03-17*
