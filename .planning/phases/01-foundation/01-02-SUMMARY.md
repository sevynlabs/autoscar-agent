---
phase: 01-foundation
plan: 02
subsystem: whatsapp
tags: [evolution-api, bullmq, ioredis, webhook, fastify, async-pipeline]

requires:
  - phase: 01-foundation-01
    provides: "Fastify server, Prisma schema (WhatsAppInstance model), env config, Docker stack"
provides:
  - "Evolution API typed REST client (create, QR, webhook, sendText, list)"
  - "WhatsApp instance management service with DB persistence"
  - "Fastify routes: POST/GET /instances, GET /instances/:name/qr"
  - "Webhook receiver: POST /webhook/whatsapp with BullMQ enqueue"
  - "Message worker with echo reply (Phase 1 behavior)"
  - "Async message pipeline pattern: webhook -> queue -> worker -> reply"
affects: [02-ai-core, 03-scraper]

tech-stack:
  added: [axios, bullmq, ioredis]
  patterns: [lazy-initialization, async-pipeline, factory-pattern, webhook-receiver]

key-files:
  created:
    - src/whatsapp/evolution.client.ts
    - src/whatsapp/instance.service.ts
    - src/api/routes/instance.ts
    - src/api/routes/webhook.ts
    - src/queue/queues.ts
    - src/queue/jobs/message.job.ts
    - src/queue/workers/message.worker.ts
  modified:
    - src/api/server.ts
    - src/main.ts

key-decisions:
  - "Used lazy initialization for Evolution API client and BullMQ queue to avoid reading env vars at module import time"
  - "Used BullMQ built-in connection URL instead of separate ioredis instances to avoid type incompatibility between bundled ioredis versions"
  - "Worker uses untyped Job with runtime cast to avoid BullMQ generic type complexity"

patterns-established:
  - "Lazy init pattern: factory functions (getMessageQueue, getClient) that create singletons on first call"
  - "Webhook fast-return: enqueue to BullMQ and return immediately, processing in worker"
  - "Graceful shutdown: close worker before server on SIGTERM/SIGINT"

requirements-completed: [WAPP-01, WAPP-02, WAPP-03]

duration: 5min
completed: 2026-03-17
---

# Phase 1 Plan 2: WhatsApp Integration Summary

**Evolution API client with instance management, webhook receiver, BullMQ async pipeline, and echo reply worker**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T02:10:15Z
- **Completed:** 2026-03-18T02:15:05Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Full Evolution API v2 typed client covering create instance, QR code, webhook config, send text, and list instances
- Async message pipeline: webhook receives Evolution events, enqueues to BullMQ, worker sends echo reply
- Instance management with automatic webhook configuration and DB persistence
- Graceful shutdown closes worker before server

## Task Commits

Each task was committed atomically:

1. **Task 1: Evolution API client, instance service, and routes** - `3c9039d` (feat)
2. **Task 2: BullMQ queue, message worker, and webhook route** - `c4b45cf` (feat)

## Files Created/Modified
- `src/whatsapp/evolution.client.ts` - Typed REST client for Evolution API v2 (create, QR, webhook, sendText, list)
- `src/whatsapp/instance.service.ts` - Business logic: create instance with auto-webhook, list, get QR
- `src/api/routes/instance.ts` - Fastify routes: POST/GET /instances, GET /instances/:name/qr
- `src/api/routes/webhook.ts` - POST /webhook/whatsapp: processes MESSAGES_UPSERT, enqueues to BullMQ
- `src/queue/queues.ts` - BullMQ queue with lazy initialization from REDIS_URL
- `src/queue/jobs/message.job.ts` - MessageJobData type definition
- `src/queue/workers/message.worker.ts` - Worker processes messages, sends echo reply (concurrency: 5)
- `src/api/server.ts` - Registered instance and webhook route plugins
- `src/main.ts` - Starts worker after server, graceful shutdown for both

## Decisions Made
- Used lazy initialization (factory functions) for Evolution API client and BullMQ queue to avoid env var reads at import time
- Used BullMQ's built-in `connection: { url }` instead of separate ioredis instances to avoid type incompatibility between BullMQ's bundled ioredis and the project's ioredis
- Worker uses untyped Job with runtime cast to avoid BullMQ v5 generic type complexity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ioredis import and type incompatibility with BullMQ**
- **Found during:** Task 2 (BullMQ queue and worker)
- **Issue:** BullMQ bundles its own ioredis with different type signatures; using project-level ioredis caused TS2322 type errors
- **Fix:** Switched from `new IORedis(url)` to BullMQ's built-in `connection: { url }` config
- **Files modified:** src/queue/queues.ts, src/queue/workers/message.worker.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** c4b45cf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to resolve type incompatibility. No scope creep.

## Issues Encountered
None beyond the ioredis type fix documented above.

## User Setup Required
None - no external service configuration required. Evolution API and Redis are already configured in Docker stack from Plan 01.

## Next Phase Readiness
- WhatsApp async pipeline ready for AI processing in Phase 2
- Echo reply worker will be replaced with OpenAI conversation logic
- Instance management routes ready for dashboard integration in Phase 3
- Webhook deduplication prevents duplicate message processing

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
