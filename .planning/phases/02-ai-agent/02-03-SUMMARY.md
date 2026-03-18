---
phase: 02-ai-agent
plan: 03
subsystem: whatsapp
tags: [evolution-api, bullmq, followup, media, whatsapp]

requires:
  - phase: 02-01
    provides: "Evolution client with sendText, BullMQ message queue"
provides:
  - "sendMedia method on evolutionClient for photo carousel"
  - "getFollowupQueue for delayed follow-up job scheduling"
  - "FollowupJobData type for follow-up jobs"
  - "Follow-up worker with auto-reschedule and max-attempt logic"
  - "SELLERS_GROUP_JID env config for seller notifications"
affects: [02-04, 03-dashboard]

tech-stack:
  added: []
  patterns: [lazy-queue-init, structured-json-logging, graceful-worker-shutdown]

key-files:
  created:
    - src/queue/jobs/followup.job.ts
    - src/queue/workers/followup.worker.ts
  modified:
    - src/whatsapp/evolution.client.ts
    - src/queue/queues.ts
    - src/main.ts
    - .env.example

key-decisions:
  - "Follow-up worker concurrency 3 (lower than message worker 5) to avoid WhatsApp rate limits"
  - "MAX_FOLLOWUPS=2 with 48h delay between follow-ups"
  - "getFollowupWorker getter added for graceful shutdown parity with message worker"

patterns-established:
  - "Worker getter pattern: startXWorker returns worker, getXWorker returns cached instance for shutdown"
  - "Follow-up job ID format: followup-{phoneNumber} for deduplication"

requirements-completed: [WAPP-04, WAPP-07, AGENT-08]

duration: 2min
completed: 2026-03-18
---

# Phase 2 Plan 3: Outbound Capabilities Summary

**sendMedia for WhatsApp photo carousel, BullMQ follow-up queue with 24h/48h auto-nudge, and sellers group config**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T04:51:16Z
- **Completed:** 2026-03-18T04:52:46Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- sendMedia method added to Evolution client for image carousel sending
- Follow-up queue + worker with auto-reschedule (max 2 attempts, 48h intervals)
- Both workers start on boot with graceful shutdown support
- SELLERS_GROUP_JID env var configured for seller notifications

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sendMedia and follow-up queue infrastructure** - `70ebc2b` (feat)
2. **Task 2: Create follow-up worker and wire into main.ts** - `a8ecd29` (feat)

## Files Created/Modified
- `src/whatsapp/evolution.client.ts` - Added sendMedia method for Evolution API image sending
- `src/queue/queues.ts` - Added getFollowupQueue with lazy init pattern
- `src/queue/jobs/followup.job.ts` - FollowupJobData interface
- `src/queue/workers/followup.worker.ts` - Follow-up worker with Portuguese nudge messages
- `src/main.ts` - Starts follow-up worker, graceful shutdown for both workers
- `.env.example` - Added SELLERS_GROUP_JID

## Decisions Made
- Follow-up worker concurrency set to 3 (vs message worker 5) to reduce WhatsApp rate limit risk
- MAX_FOLLOWUPS=2 with 48h second follow-up delay
- Added getFollowupWorker getter for graceful shutdown consistency with message worker pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- sendMedia ready for agent tools to send vehicle photo carousels
- Follow-up queue ready for message worker to schedule follow-ups when leads go silent
- SELLERS_GROUP_JID needs to be set in .env before seller notifications work

---
*Phase: 02-ai-agent*
*Completed: 2026-03-18*
