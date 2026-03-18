# Phase 1: Foundation - Research

**Researched:** 2026-03-17
**Domain:** Async infrastructure, Docker stack, WhatsApp integration (Evolution API), web scraping (Playwright + Cheerio), BullMQ queue, Fastify webhook handler
**Confidence:** HIGH (core stack well-documented; autoscar.com.br structure needs empirical validation)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-06 | Configuração de APIs (.env) — Evolution API + OpenAI | .env-only pattern documented; Fastify env plugin validates at startup |
| PLAT-07 | Deploy via Docker Compose em VPS | Full docker-compose.yml stack documented; all 6 services confirmed |
| WAPP-01 | Usuário pode conectar número WhatsApp via QR code (Evolution API) | Evolution API POST /instance + QR code flow fully documented |
| WAPP-02 | Usuário pode conectar múltiplos números WhatsApp simultaneamente | Multi-instance support confirmed via Evolution API v2 instance model |
| WAPP-03 | Agente recebe e responde mensagens WhatsApp em tempo real | Webhook MESSAGES_UPSERT → BullMQ → worker → Evolution API send documented |
| SCRP-01 | Scraper extrai dados do veículo (modelo, ano, km, preço, fotos) | Playwright + Cheerio pattern confirmed; autoscar.com.br is JS-rendered (React) |
| SCRP-02 | Scraper cacheia resultados para evitar requisições repetidas | Redis SET with TTL pattern; 1-hour TTL recommended |
| SCRP-03 | Scraper valida dados extraídos e alerta em caso de falha | Zod schema validation after extraction; error surfacing pattern documented |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire async infrastructure from scratch on a blank repo. The core technical challenge is the **webhook-to-queue decoupling**: Evolution API webhooks have no stated timeout but empirically fail if the response takes more than ~5 seconds, while the scraper (Playwright) can take 5-30 seconds per page. The solution is mandatory — webhook handler enqueues a BullMQ job instantly (<50ms) and returns 200, while a separate worker process does the actual scraping and sends the reply via Evolution API REST.

The second major challenge is **autoscar.com.br scraping**. The site is confirmed React-rendered (client-side), meaning basic HTTP scraping will return an empty shell. Playwright is the correct tool — it loads the full page, waits for the JS to execute, then passes the rendered HTML to Cheerio for parsing. The site shows no obvious Cloudflare protection, but realistic request pacing and a real user-agent are still required. The exact CSS selectors for vehicle data (model, year, km, price) MUST be validated empirically during implementation — this is the highest-risk unknown in Phase 1.

Evolution API v2 runs as a Docker service with its own PostgreSQL backend for session persistence. This is the critical pitfall: without configuring `DATABASE_ENABLED=true` and mapping the correct environment variables, WhatsApp sessions die on every container restart requiring manual QR re-scan. The docker-compose.yml must configure Evolution API's database from day one.

**Primary recommendation:** Build in this order — (1) docker-compose.yml with all services healthy, (2) Evolution API instance creation + QR webhook, (3) Fastify webhook receiver + BullMQ queue, (4) message echo worker proving async pipeline, (5) Playwright scraper with Cheerio parsing, (6) Redis cache layer, (7) Zod validation with error surfacing.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22 LTS | Runtime | Async-first, Evolution API ecosystem is JS-native |
| TypeScript | 5.x | Type safety | Type-safe data models, API contracts, scraper schemas |
| Fastify | 5.x | HTTP server + webhook receiver | Fastest Node.js framework, plugin system, native TypeScript support |
| BullMQ | 5.x | Async job queue | Decouples webhook handler from AI/scraper processing; Redis-backed |
| IORedis | 5.x | Redis client | Required by BullMQ; also used for scrape cache |
| PostgreSQL | 16 | Primary database | All structured data (leads, instances, conversations) |
| Prisma | 6.x | ORM + migrations | Type-safe queries, migration management, future multi-tenant support |
| Redis | 7.x | Queue backend + cache | BullMQ requires Redis; scrape cache uses Redis SET with TTL |
| Evolution API | 2.x | WhatsApp automation | Brazilian standard, multi-instance QR code, webhook emission |
| Playwright | 1.x | Headless browser | Handles autoscar.com.br's React-rendered content |
| Cheerio | 1.x | HTML parsing | Fast server-side DOM traversal after Playwright fetches rendered HTML |
| Zod | 3.x | Runtime validation | Validates scraped vehicle data structure; surfaces missing fields |
| MinIO | latest | Object storage (S3-compatible) | Vehicle photo storage, self-hosted on VPS |
| Nginx | latest | Reverse proxy | SSL termination, routes traffic to Fastify + Evolution API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/env | 4.x | Env variable validation | Validates all .env keys at startup, fails fast if missing |
| @fastify/rate-limit | 9.x | Rate limiting | Protects webhook endpoint from flood; limits per-WhatsApp-number |
| dotenv | 16.x | .env loading | Load .env in local dev (Docker provides vars in production) |
| pino | 9.x | Structured logging | Built into Fastify; JSON logs for Docker log aggregation |
| playwright-extra + stealth plugin | latest | Anti-detection | Spoofs webdriver flag, randomizes fingerprints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | Bull (v4) | Bull is older, BullMQ is the successor with better TypeScript support and deduplication |
| Playwright | Puppeteer | Playwright is faster, has better multi-browser API, Puppeteer is Chrome-only |
| Playwright | HTTP-only (axios) | autoscar.com.br is React-rendered — HTTP-only returns empty shell |
| Prisma | Drizzle | Prisma has better migration tooling; Drizzle is lighter but less mature for production |
| Zod | joi / yup | Zod is TypeScript-native, better inference, lighter bundle |

**Installation:**
```bash
npm install fastify @fastify/env @fastify/rate-limit bullmq ioredis prisma @prisma/client zod pino dotenv
npm install playwright cheerio
npm install -D typescript @types/node tsx
npx playwright install chromium
```

---

## Architecture Patterns

### Recommended Project Structure
```
autoscar-agent/
├── src/
│   ├── api/                  # Fastify server, routes, plugins
│   │   ├── server.ts         # Fastify instance + plugin registration
│   │   ├── routes/
│   │   │   └── webhook.ts    # POST /webhook/whatsapp — receives Evolution API events
│   │   └── plugins/
│   │       └── env.ts        # @fastify/env schema + validation
│   ├── queue/                # BullMQ queues and workers
│   │   ├── queues.ts         # Queue instances (messageQueue)
│   │   ├── workers/
│   │   │   └── message.worker.ts  # Processes incoming WhatsApp messages
│   │   └── jobs/
│   │       └── message.job.ts     # Job payload type definition
│   ├── whatsapp/             # Evolution API integration
│   │   ├── evolution.client.ts    # REST client for Evolution API
│   │   └── instance.service.ts    # Instance create/list/connect logic
│   ├── scraper/              # autoscar.com.br scraper
│   │   ├── autoscar.scraper.ts    # Playwright + Cheerio extraction logic
│   │   ├── scraper.cache.ts       # Redis cache wrapper (GET/SET with TTL)
│   │   └── vehicle.schema.ts      # Zod schema for vehicle data validation
│   ├── db/                   # Prisma client and schema
│   │   └── prisma.ts         # Singleton PrismaClient export
│   └── config/
│       └── env.ts            # Typed env accessor
├── prisma/
│   └── schema.prisma         # Database schema
├── docker-compose.yml        # Full stack: PG, Redis, MinIO, Evolution API, App, Nginx
├── Dockerfile                # Node.js 22 + Playwright chromium
├── nginx/
│   └── nginx.conf            # Reverse proxy config
└── .env.example              # Template for required env vars
```

### Pattern 1: Webhook → Queue Decoupling (Critical)
**What:** Fastify webhook handler receives Evolution API event, immediately enqueues a BullMQ job, returns HTTP 200. Worker process picks up the job asynchronously.
**When to use:** Every incoming message. Non-negotiable — synchronous processing causes webhook timeouts.

```typescript
// src/api/routes/webhook.ts
// Source: BullMQ docs + Evolution API webhook documentation
import { FastifyPluginAsync } from 'fastify';
import { messageQueue } from '../../queue/queues';

const webhookRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhook/whatsapp', async (request, reply) => {
    const payload = request.body as EvolutionWebhookPayload;

    // Only process incoming messages
    if (payload.event !== 'MESSAGES_UPSERT') {
      return reply.send({ status: 'ignored' });
    }

    const { instance, data } = payload;
    const phoneNumber = data.key.remoteJid.replace('@s.whatsapp.net', '');

    // Enqueue with deduplication — phone number is the dedup key
    // Debounce mode: if lead sends 2 messages fast, merge into one job
    await messageQueue.add(
      'process-message',
      { instance, phoneNumber, message: data.message, messageId: data.key.id },
      {
        deduplication: {
          id: `${instance}-${phoneNumber}`,
          ttl: 1000,       // 1s debounce window
          extend: true,
          replace: true,
        },
        delay: 1000,       // Wait 1s to capture rapid follow-up messages
      }
    );

    // Return immediately — do NOT wait for processing
    return reply.send({ status: 'queued' });
  });
};

export default webhookRoute;
```

### Pattern 2: BullMQ Worker — Message Processing
**What:** Worker picks up jobs from the queue, runs the scraper if needed, sends reply via Evolution API.
**When to use:** All async processing — never in the webhook handler.

```typescript
// src/queue/workers/message.worker.ts
// Source: https://docs.bullmq.io/readme-1
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { evolutionClient } from '../../whatsapp/evolution.client';

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // Required for BullMQ workers
});

export const messageWorker = new Worker(
  'messages',
  async (job) => {
    const { instance, phoneNumber, message } = job.data;

    // Phase 1: echo back + optional scrape if URL in message
    const replyText = await buildReply(message);

    await evolutionClient.sendText(instance, phoneNumber, replyText);
  },
  { connection, concurrency: 5 }
);

messageWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
```

### Pattern 3: Playwright + Cheerio Scraper
**What:** Launch Playwright browser, navigate to autoscar.com.br vehicle URL, wait for React hydration, extract HTML, parse with Cheerio, validate with Zod.
**When to use:** Every vehicle URL lookup (before checking Redis cache).

```typescript
// src/scraper/autoscar.scraper.ts
// Source: brightdata.com/blog/how-tos/playwright-web-scraping
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { vehicleSchema } from './vehicle.schema';

export async function scrapeVehicle(url: string) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Hide webdriver flag
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

    // Wait for React to render vehicle data
    // NOTE: actual selectors must be validated empirically against live autoscar.com.br
    await page.waitForSelector('[data-vehicle], .vehicle-detail, h1', { timeout: 15_000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    // IMPORTANT: These selectors are placeholders — validate against live site
    const raw = {
      model: $('h1').first().text().trim() || null,
      year: $('[data-year], .vehicle-year').first().text().trim() || null,
      km: $('[data-km], .vehicle-km').first().text().trim() || null,
      price: $('[data-price], .vehicle-price').first().text().trim() || null,
      photos: $('img[data-src], .gallery img').map((_, el) => $(el).attr('src') || $(el).attr('data-src')).get().filter(Boolean),
    };

    // Validate — throws if required fields missing (SCRP-03)
    return vehicleSchema.parse(raw);
  } finally {
    await browser.close();
  }
}
```

### Pattern 4: Redis Cache for Scraper Results
**What:** Check Redis before scraping; store result after successful scrape with 1-hour TTL.
**When to use:** Every vehicle lookup — prevents redundant Playwright launches for the same URL.

```typescript
// src/scraper/scraper.cache.ts
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL!);

const CACHE_TTL_SECONDS = 3600; // 1 hour

export async function getCachedVehicle(url: string) {
  const key = `vehicle:${Buffer.from(url).toString('base64')}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheVehicle(url: string, data: unknown) {
  const key = `vehicle:${Buffer.from(url).toString('base64')}`;
  await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
}
```

### Pattern 5: Zod Validation Schema (SCRP-03)
**What:** Validates scraped data. If required fields are missing, throws a structured error that surfaces to the caller.

```typescript
// src/scraper/vehicle.schema.ts
import { z } from 'zod';

export const vehicleSchema = z.object({
  model: z.string().min(1, 'Vehicle model is required'),
  year: z.string().regex(/^\d{4}$/, 'Year must be 4-digit string'),
  km: z.string().min(1, 'Mileage is required'),
  price: z.string().min(1, 'Price is required'),
  photos: z.array(z.string().url()).min(1, 'At least 1 photo is required'),
});

export type Vehicle = z.infer<typeof vehicleSchema>;
```

### Pattern 6: Evolution API Client
**What:** Typed REST client wrapping Evolution API v2 endpoints.

```typescript
// src/whatsapp/evolution.client.ts
// Source: deepwiki.com/EvolutionAPI/evolution-api/7-api-reference
import axios from 'axios';

const evo = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: { apikey: process.env.EVOLUTION_API_KEY },
});

export const evolutionClient = {
  // Create a new WhatsApp instance (WAPP-01, WAPP-02)
  async createInstance(instanceName: string): Promise<{ instanceName: string; status: string }> {
    const { data } = await evo.post('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
    });
    return data;
  },

  // Fetch QR code for scanning (WAPP-01)
  async getQrCode(instanceName: string): Promise<string> {
    const { data } = await evo.get(`/instance/connect/${instanceName}`);
    return data.code; // base64 QR code
  },

  // Configure webhook for an instance
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    await evo.post(`/webhook/set?instanceName=${instanceName}`, {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    });
  },

  // Send text reply (WAPP-03)
  async sendText(instanceName: string, to: string, text: string): Promise<void> {
    await evo.post(`/message/sendText?instanceName=${instanceName}`, {
      number: to,
      text,
    });
  },
};
```

### Anti-Patterns to Avoid
- **Processing in webhook handler:** Never call Playwright or any async I/O in the webhook route. Always enqueue and return immediately.
- **Hardcoding API keys:** All secrets must live in `.env`. Use `@fastify/env` to validate presence at startup.
- **SQLite/memory for Evolution API sessions:** Without PostgreSQL backend, all WhatsApp sessions die on container restart.
- **Sending raw HTML to any downstream system:** Extract structured fields first; never propagate raw HTML.
- **Single-selector scraping:** autoscar.com.br can change its markup. Build fallback selector chains.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue | Custom Redis pub/sub | BullMQ | Retries, deduplication, visibility, dead-letter queue built in |
| Job deduplication | Custom Redis key locking | BullMQ deduplication option | Race conditions, TTL expiry, debounce all handled |
| HTML parsing | Custom regex | Cheerio | Cheerio is jQuery-compatible, battle-tested, handles malformed HTML |
| Runtime type validation | Manual `if` checks | Zod | Generates TypeScript types, descriptive errors, composable schemas |
| Env validation | try/catch at access sites | @fastify/env | Fails at startup with clear message, not at runtime |
| WhatsApp session management | Custom WS implementation | Evolution API | Session persistence, multi-device, QR code, reconnect logic |
| Browser automation | Custom HTTP + JS injection | Playwright | JS-rendered sites, auto-waiting, network interception |

**Key insight:** Every item in this list represents 2-5 days of debugging edge cases that open-source libraries have already handled.

---

## Common Pitfalls

### Pitfall 1: Evolution API Sessions Lost on Container Restart
**What goes wrong:** All WhatsApp numbers show "disconnected" after every `docker-compose down/up`. Operators must manually scan QR codes again.
**Why it happens:** Evolution API defaults to in-memory/SQLite session storage. Docker volumes don't map the right paths, or `DATABASE_ENABLED=true` is not set.
**How to avoid:**
- Set `DATABASE_ENABLED=true`, `DATABASE_PROVIDER=postgresql` in Evolution API env
- Set `DATABASE_SAVE_DATA_INSTANCE=true` and all other `DATABASE_SAVE_*` flags
- Map a Docker named volume for `/evolution/instances` even when using PostgreSQL backend
- Test survival: run `docker-compose down && docker-compose up` and verify instances reconnect automatically
**Warning signs:** QR code re-required after restart; instance list empty after deploy.

### Pitfall 2: Webhook Timeout Causing Message Loss
**What goes wrong:** Evolution API marks the webhook as failed; messages are dropped and never processed.
**Why it happens:** Playwright scraping inside the webhook handler. Even 3-4 seconds triggers failure.
**How to avoid:** Webhook handler MUST return in <500ms. Enqueue immediately, process in worker.
**Warning signs:** Sporadic missing messages under any load; Evolution API logs showing webhook failures.

### Pitfall 3: BullMQ Worker Missing `maxRetriesPerRequest: null`
**What goes wrong:** Worker crashes with `MaxRetriesPerRequestError` on any Redis hiccup.
**Why it happens:** IORedis default retry behavior conflicts with BullMQ's blocking operations.
**How to avoid:** Always create IORedis connection for workers with `{ maxRetriesPerRequest: null }`.
**Warning signs:** Worker process exits unexpectedly; jobs stuck in "active" state.

### Pitfall 4: Race Condition — Duplicate Job Processing
**What goes wrong:** Lead sends two messages in 2 seconds. Two webhook events create two jobs. Worker sends two replies.
**Why it happens:** No deduplication at queue level.
**How to avoid:** Use BullMQ debounce mode with `deduplication: { id: phoneNumber, ttl: 1000, extend: true, replace: true }` and `delay: 1000`. The 1-second window merges rapid messages.
**Warning signs:** Lead receives duplicate "welcome" messages; two CRM cards for same phone number.

### Pitfall 5: autoscar.com.br Selector Drift
**What goes wrong:** Scraper returns null for model/price/km after site update; agent sends garbage to leads.
**Why it happens:** Selectors were hardcoded to a specific DOM structure. React sites change class names frequently.
**How to avoid:** Build fallback selector chains (try 3-4 selectors per field). Use Zod validation to catch empty results immediately. Log scrape failures with the URL for debugging.
**Warning signs:** Zod validation throws for fields that were previously populated; vehicle data shows "undefined".

### Pitfall 6: Playwright Running in Docker Without Chromium Dependencies
**What goes wrong:** `playwright install chromium` works locally but fails in Docker container.
**Why it happens:** Playwright's Chromium needs specific system libraries that are not in a base Node.js Docker image.
**How to avoid:** Use the official Playwright Docker image as base (`mcr.microsoft.com/playwright:v1.x-jammy`) or install system dependencies via `RUN npx playwright install-deps chromium`.
**Warning signs:** Playwright throws "Executable not found" or missing `.so` library errors in Docker.

### Pitfall 7: VPS Resource Exhaustion
**What goes wrong:** Stack becomes unresponsive; containers OOM-killed.
**Why it happens:** PostgreSQL + Redis + MinIO + Evolution API + Node.js + Playwright (headless Chrome) collectively require 2-4GB under load.
**How to avoid:** Minimum 4GB RAM VPS (8GB recommended). Set memory limits in docker-compose.yml for each service. Playwright should use a pool of max 2-3 browser instances.
**Warning signs:** Container restarts in `docker ps`; OOMKilled in container logs.

---

## Code Examples

### docker-compose.yml — Full Phase 1 Stack

```yaml
# Source: Evolution API official docs + project architecture research
version: '3.9'

services:
  postgres:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_DB: autoscar
      POSTGRES_USER: autoscar
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - autoscar-net

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes  # AOF persistence
    volumes:
      - redis_data:/data
    networks:
      - autoscar-net

  minio:
    image: minio/minio:latest
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    networks:
      - autoscar-net

  evolution-api:
    image: atendai/evolution-api:v2.1.1
    restart: always
    environment:
      SERVER_URL: ${EVOLUTION_API_URL}
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
      DATABASE_ENABLED: 'true'
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://autoscar:${POSTGRES_PASSWORD}@postgres:5432/evolution
      DATABASE_SAVE_DATA_INSTANCE: 'true'
      DATABASE_SAVE_DATA_NEW_MESSAGE: 'true'
      DATABASE_SAVE_MESSAGE_UPDATE: 'true'
      DATABASE_SAVE_DATA_CONTACTS: 'true'
      DATABASE_SAVE_DATA_CHATS: 'true'
      REDIS_ENABLED: 'true'
      REDIS_URI: redis://redis:6379
      WEBHOOK_GLOBAL_ENABLED: 'false'  # Per-instance webhooks only
    volumes:
      - evolution_instances:/evolution/instances
    depends_on:
      - postgres
      - redis
    networks:
      - autoscar-net

  app:
    build: .
    restart: always
    env_file: .env
    depends_on:
      - postgres
      - redis
      - evolution-api
    networks:
      - autoscar-net

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - certbot_data:/etc/letsencrypt
    depends_on:
      - app
      - evolution-api
    networks:
      - autoscar-net

volumes:
  postgres_data:
  redis_data:
  minio_data:
  evolution_instances:
  certbot_data:

networks:
  autoscar-net:
    driver: bridge
```

### .env.example Template (PLAT-06)

```bash
# PostgreSQL
POSTGRES_PASSWORD=change-me-strong-password

# Redis
REDIS_URL=redis://redis:6379

# Evolution API
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=change-me-apikey

# OpenAI (configured but not used until Phase 2)
OPENAI_API_KEY=sk-...

# MinIO
MINIO_USER=minioadmin
MINIO_PASSWORD=change-me-minio-password
MINIO_ENDPOINT=http://minio:9000

# App
APP_PORT=3000
NODE_ENV=production
```

### Prisma Schema (Core Phase 1 Tables)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model WhatsAppInstance {
  id                  String   @id @default(cuid())
  name                String   @unique
  evolutionInstanceId String
  phoneNumber         String?
  status              String   @default("disconnected")
  tenantId            String?  // nullable for v1, required for SaaS
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model Vehicle {
  id        String   @id @default(cuid())
  portalUrl String   @unique
  model     String
  year      String
  price     String
  mileage   String
  photos    String[] // Array of URLs
  cachedAt  DateTime @default(now())
  tenantId  String?
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bull (v4) | BullMQ (v5) | 2022+ | BullMQ is the TypeScript-first successor; Bull is legacy |
| Puppeteer | Playwright | 2021+ | Playwright is cross-browser, faster API, better async handling |
| Express | Fastify 5 | 2024 | Fastify 5 drops legacy plugins, full ESM, better TypeScript |
| Prisma 5 | Prisma 6 | Late 2024 | TypeScript engine, smaller Docker images, faster cold starts |
| Evolution API v1 | Evolution API v2 | 2024 | v2 has proper multi-instance, PostgreSQL backend, better webhook events |
| Memory/SQLite (Evolution) | PostgreSQL backend | v2.x | Sessions survive container restart — critical for production |

**Deprecated/outdated:**
- Bull v4: Use BullMQ v5. Bull is no longer actively maintained.
- Puppeteer: Use Playwright. Same capability, better API, maintained by Microsoft.
- Express.js: Not deprecated, but Fastify is the production choice for this stack.

---

## Open Questions

1. **autoscar.com.br exact CSS selectors**
   - What we know: Site is React-rendered; uses CSS modules; displays vehicle data including photos, model, year, price
   - What's unclear: The exact data attribute names or class names for vehicle fields (model, year, km, price). React-generated class names are often hashed and change with builds.
   - Recommendation: First task in scraper implementation must be to inspect the live site manually, identify stable data attributes (`data-*`) or semantic HTML elements, and build the selector chain empirically. This CANNOT be done without accessing the live site.

2. **autoscar.com.br photo URL structure**
   - What we know: Site has a photo gallery component; photos are displayed in carousel
   - What's unclear: Whether photo URLs are absolute CDN URLs (stable) or relative paths that change per session/build
   - Recommendation: Validate during scraper implementation. If relative, resolve against base URL before storing.

3. **Evolution API v2 PostgreSQL migration — separate DB or shared?**
   - What we know: Evolution API can use an external PostgreSQL connection string
   - What's unclear: Whether it's better to use a separate `evolution` database within the same PostgreSQL instance or a completely separate service
   - Recommendation: Single PostgreSQL container, two databases: `autoscar` (app) and `evolution` (Evolution API). Simpler ops, one backup point.

4. **Playwright concurrency in Docker**
   - What we know: Playwright requires Chromium system dependencies; each browser instance uses ~200-400MB RAM
   - What's unclear: Optimal concurrency limit for a 4-8GB VPS
   - Recommendation: Cap BullMQ worker concurrency for scraper jobs at 2-3 simultaneous Playwright instances. Add this as a configurable env var from day one.

---

## Sources

### Primary (HIGH confidence)
- https://doc.evolution-api.com/v2/en/configuration/webhooks — Webhook events, MESSAGES_UPSERT, payload structure
- https://deepwiki.com/EvolutionAPI/evolution-api/7-api-reference — Instance create endpoint, webhook set endpoint, message send endpoint
- https://docs.bullmq.io/readme-1 — BullMQ Queue + Worker + IORedis setup pattern
- https://docs.bullmq.io/guide/jobs/deduplication — Deduplication modes (simple, throttle, debounce) with TypeScript examples
- https://fastify.dev/docs/latest/Reference/TypeScript/ — Fastify 5 TypeScript plugin pattern, route handler typing
- https://www.prisma.io/docs/guides/docker — Prisma 6 Docker + PostgreSQL configuration

### Secondary (MEDIUM confidence)
- https://brightdata.com/blog/how-tos/playwright-web-scraping — Playwright + Cheerio pattern, user-agent anti-detection
- https://doc.evolution-api.com/v2/en/install/docker — Evolution API Docker Compose configuration, env variables for session persistence
- WebSearch: Evolution API v2 PostgreSQL session persistence env variables (cross-verified with official Docker docs)
- WebSearch: BullMQ v5 TypeScript setup (cross-verified with official docs.bullmq.io)

### Tertiary (LOW confidence)
- WebFetch autoscar.com.br: React-rendered site confirmed from CSS analysis. Specific selectors NOT confirmed — requires empirical validation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries confirmed via official docs and Context7-equivalent sources
- Architecture: HIGH — Webhook/queue pattern confirmed; Evolution API endpoints documented
- Pitfalls: HIGH — All critical pitfalls documented in project PITFALLS.md plus verified against official sources
- autoscar.com.br selectors: LOW — Site is confirmed JS-rendered but exact selectors require live site inspection

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (Evolution API releases frequently; check changelog before implementation)
