---
phase: 02-ai-agent
plan: 02
subsystem: ai-agent
tags: [openai, gpt-4o, tool-calling, agentic-loop, zod, whatsapp, crm]

requires:
  - phase: 02-ai-agent
    plan: 01
    provides: CRM services (upsertLead, updateLead, moveToStage, addNote), conversation persistence, AgentContext type, pipeline service
provides:
  - buildSystemPrompt with PT-BR SDR qualification flow and injection defense
  - 7 agent tool definitions (scrape_vehicle, send_photos, create_lead, update_lead, move_lead_stage, add_note, notify_sellers_group)
  - executeToolCall dispatcher with Zod argument validation
  - runAgentTurn agentic loop with MAX_ITERATIONS=10 guard
  - Message worker fully replaced with agent-driven processing
affects: [02-ai-agent, 03-dashboard]

tech-stack:
  added: []
  patterns: [agentic-loop-with-tool-calling, lazy-openai-client, type-narrowing-for-union-tool-calls]

key-files:
  created:
    - src/agent/agent.prompts.ts
    - src/agent/agent.tools.ts
    - src/agent/agent.service.ts
  modified:
    - src/queue/workers/message.worker.ts

key-decisions:
  - "Used ChatCompletionMessageFunctionToolCall type narrowing for OpenAI v6 union type compatibility"
  - "send_photos tool gracefully skips if sendMedia not yet available (Plan 03 dependency)"
  - "notify_sellers_group reads SELLERS_GROUP_JID from env with graceful skip if not configured"

patterns-established:
  - "Agentic loop: while + MAX_ITERATIONS guard with Portuguese fallback message"
  - "Tool call error handling: catch per tool, return error JSON to model for self-correction"
  - "Type narrowing: filter toolCall.type === 'function' before accessing .function property"

requirements-completed: [AGENT-01, AGENT-02, AGENT-03, AGENT-09]

duration: 5min
completed: 2026-03-18
---

# Phase 2 Plan 2: AI Agent Agentic Loop Summary

**OpenAI GPT-4o agentic loop with 7 CRM/scraper tools, Zod validation, and PT-BR SDR system prompt replacing echo-bot**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T04:51:30Z
- **Completed:** 2026-03-18T04:56:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Full agentic loop with OpenAI Chat Completions tool calling replaces Phase 1 echo-bot
- 7 tools wired to scraper, CRM services, and WhatsApp client with Zod argument validation
- System prompt implements complete SDR qualification flow in Portuguese with injection defense
- Message worker handles follow-up scheduling and cancellation on lead reply

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent tools, system prompt, and agentic loop service** - `0db6ef1` (feat)
2. **Task 2: Replace echo-bot with agentic loop in message worker** - `249e317` (feat)

## Files Created/Modified
- `src/agent/agent.prompts.ts` - buildSystemPrompt with PT-BR SDR qualification flow and injection defense
- `src/agent/agent.tools.ts` - 7 tool definitions with Zod schemas + executeToolCall dispatcher
- `src/agent/agent.service.ts` - runAgentTurn agentic loop with MAX_ITERATIONS=10, token logging, conversation persistence
- `src/queue/workers/message.worker.ts` - Replaced echo/scraper logic with runAgentTurn + follow-up scheduling

## Decisions Made
- Used `ChatCompletionMessageFunctionToolCall` specific type instead of union `ChatCompletionMessageToolCall` due to OpenAI SDK v6 splitting tool calls into function vs custom variants
- send_photos tool checks for sendMedia method existence at runtime and gracefully skips if not available (Plan 03 will add sendMedia to evolution client)
- notify_sellers_group reads SELLERS_GROUP_JID from environment with warning log and skip if not configured

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] OpenAI v6 ChatCompletionMessageToolCall type union**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** OpenAI SDK v6 changed `ChatCompletionMessageToolCall` to a union of `ChatCompletionMessageFunctionToolCall | ChatCompletionMessageCustomToolCall`. The `.function` property only exists on the function variant, causing tsc errors.
- **Fix:** Used `ChatCompletionMessageFunctionToolCall` type for executeToolCall parameter, and added `toolCall.type !== 'function'` guard in the agentic loop
- **Files modified:** src/agent/agent.tools.ts, src/agent/agent.service.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 0db6ef1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary type adaptation for OpenAI v6 SDK. No scope creep.

## Issues Encountered
None beyond the type deviation above.

## User Setup Required
None - no external service configuration required. OPENAI_API_KEY and SELLERS_GROUP_JID are needed at runtime but both have graceful error handling.

## Next Phase Readiness
- Agent fully operational for message processing
- Ready for Plan 03 (follow-up worker, sendMedia integration)
- All agent tools compile and wire to existing services

---
*Phase: 02-ai-agent*
*Completed: 2026-03-18*
