---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [docker, fastify, prisma, postgresql, redis, minio, evolution-api, nginx, typescript]

# Dependency graph
requires: []
provides:
  - Docker Compose stack with 6 services (PostgreSQL, Redis, MinIO, Evolution API, App, Nginx)
  - TypeScript ESM project scaffold with Fastify 5 server
  - Prisma schema with WhatsAppInstance and Vehicle models
  - Env validation plugin (fail-fast on missing vars)
  - Nginx reverse proxy with WebSocket support
affects: [01-02, 01-03, 01-04]

# Tech tracking
tech-stack:
  added: [fastify@5, prisma@6, bullmq@5, playwright, cheerio, zod, ioredis, pino, dotenv, axios, @fastify/env, @fastify/rate-limit, fastify-plugin]
  patterns: [fastify-plugin-pattern, env-validation-at-boot, prisma-singleton]

key-files:
  created:
    - docker-compose.yml
    - Dockerfile
    - nginx/nginx.conf
    - .env.example
    - package.json
    - tsconfig.json
    - prisma/schema.prisma
    - src/api/server.ts
    - src/api/plugins/env.ts
    - src/config/env.ts
    - src/db/prisma.ts
    - src/main.ts
  modified: []

key-decisions:
  - "Downgraded Prisma 7 to Prisma 6 — v7 removed datasource url from schema.prisma requiring config migration; v6 is stable and matches research"
  - "Removed deprecated docker-compose version key for modern Docker Compose compatibility"

patterns-established:
  - "Fastify plugin pattern: use fastify-plugin wrapper for encapsulation"
  - "Env validation at boot: @fastify/env with JSON Schema fails fast on missing vars"
  - "Prisma singleton: single PrismaClient instance exported from src/db/prisma.ts"
  - "ESM project: type=module in package.json, .js extensions in imports"

requirements-completed: [PLAT-06, PLAT-07]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 1 Plan 01: Docker Stack + Project Scaffold Summary

**Docker Compose with 6 services, Fastify 5 server with env validation, Prisma 6 schema with WhatsAppInstance and Vehicle models**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T02:01:23Z
- **Completed:** 2026-03-18T02:06:55Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Full Docker Compose stack with PostgreSQL, Redis, MinIO, Evolution API, App, and Nginx -- all configured with correct dependencies and volumes
- Evolution API configured with PostgreSQL session persistence (DATABASE_ENABLED=true) to survive container restarts
- TypeScript ESM project with Fastify server, env validation plugin, /health endpoint, and rate limiting
- Prisma schema with WhatsAppInstance and Vehicle models carrying nullable tenant_id for future SaaS migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Docker Compose stack, Dockerfile, Nginx config, and .env.example** - `0e1f199` (feat)
2. **Task 2: Initialize TypeScript project with Fastify server, env validation, and Prisma schema** - `fa45f12` (feat)

## Files Created/Modified
- `docker-compose.yml` - Full 6-service stack orchestration
- `Dockerfile` - Node.js 22 + Playwright Chromium build
- `nginx/nginx.conf` - Reverse proxy routing to app and Evolution API with WebSocket
- `.env.example` - Template for all required environment variables
- `.dockerignore` - Excludes node_modules, dist, .env, .git, .planning
- `.gitignore` - Excludes node_modules, dist, .env, logs
- `package.json` - ESM project with Fastify, BullMQ, Playwright, Prisma dependencies
- `tsconfig.json` - ES2022 target, NodeNext module resolution, strict mode
- `prisma/schema.prisma` - WhatsAppInstance and Vehicle models
- `src/config/env.ts` - Typed EnvConfig interface with Fastify declaration merge
- `src/api/plugins/env.ts` - @fastify/env plugin with JSON Schema validation
- `src/api/server.ts` - buildServer() with env plugin, rate-limit, and /health
- `src/main.ts` - Entry point with graceful shutdown
- `src/db/prisma.ts` - Singleton PrismaClient export

## Decisions Made
- Downgraded from Prisma 7.5.0 to Prisma 6.x because v7 removed `url = env("DATABASE_URL")` from schema.prisma, requiring a `prisma.config.ts` migration that is incompatible with the documented patterns in research
- Removed deprecated `version: '3.9'` from docker-compose.yml (modern Docker Compose ignores it with a warning)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma 7 breaking change — downgraded to Prisma 6**
- **Found during:** Task 2 (Prisma generate)
- **Issue:** Prisma 7.5.0 removed `url = env("DATABASE_URL")` from datasource block in schema.prisma, requiring a new prisma.config.ts approach
- **Fix:** Downgraded @prisma/client and prisma CLI to ^6.0.0 (installed 6.19.2)
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx prisma generate` succeeds, `npx tsc --noEmit` passes
- **Committed in:** fa45f12 (Task 2 commit)

**2. [Rule 1 - Bug] Removed deprecated docker-compose version key**
- **Found during:** Task 1 (docker compose config validation)
- **Issue:** `version: '3.9'` triggers deprecation warning in modern Docker Compose
- **Fix:** Removed the version key entirely
- **Files modified:** docker-compose.yml
- **Verification:** `docker compose config --quiet` exits 0 without warnings
- **Committed in:** 0e1f199 (Task 1 commit)

**3. [Rule 3 - Blocking] Added missing fastify-plugin dependency**
- **Found during:** Task 2 (env plugin implementation)
- **Issue:** fastify-plugin needed to wrap env validation plugin for proper encapsulation
- **Fix:** Ran `npm install fastify-plugin`
- **Files modified:** package.json, package-lock.json
- **Verification:** TypeScript compilation passes
- **Committed in:** fa45f12 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correct build. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Docker stack is ready for `docker-compose up` (requires `.env` with real credentials)
- Fastify server scaffold ready for webhook routes (Plan 01-02)
- Prisma schema ready for migrations once PostgreSQL is running
- All dependencies for Plans 02-04 are installed (BullMQ, Playwright, Cheerio, Zod, IORedis, axios)

## Self-Check: PASSED

All 12 created files verified present. Both task commits (0e1f199, fa45f12) verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
