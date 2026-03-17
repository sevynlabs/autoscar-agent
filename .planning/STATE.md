# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** O agente de IA deve atender o lead instantaneamente, identificar o veículo de interesse, buscar dados/fotos no portal e qualificar o lead de forma autônoma — sem intervenção humana até o momento de negociação.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-17 — Roadmap created (4 phases, 36 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: Node.js 22 + TypeScript + Fastify + BullMQ + PostgreSQL + Prisma + Redis + Next.js 15 + shadcn/ui stack (from research)
- [Setup]: BullMQ async queue is non-negotiable — Evolution API has 5s timeout, OpenAI calls take 5-15s
- [Setup]: All DB tables must carry nullable `tenant_id` from day one for future SaaS migration
- [Setup]: Evolution API via Docker with persistent volumes — session loss on restart is a critical pitfall

### Pending Todos

None yet.

### Blockers/Concerns

- SMS provider not selected (Twilio vs Zenvia vs Vonage — needed before Phase 4 planning)
- autoscar.com.br live HTML structure needs empirical validation during Phase 1 scraper build
- OpenAI cost per lead unknown until Phase 2 produces real data

## Session Continuity

Last session: 2026-03-17
Stopped at: Roadmap created, STATE.md initialized. Ready to plan Phase 1.
Resume file: None
