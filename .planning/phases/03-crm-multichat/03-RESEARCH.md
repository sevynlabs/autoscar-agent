# Phase 3: CRM + Multichat - Research

**Researched:** 2026-03-18
**Domain:** Next.js 15 frontend, dnd-kit Kanban, Socket.IO real-time, REST API for CRM, human handoff mechanism
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRM-01 | Usuário visualiza leads em Kanban com drag-and-drop | dnd-kit SortableContext + DndContext pattern; DragOverlay for performance |
| CRM-02 | Usuário configura etapas do pipeline (criar, editar, reordenar, excluir) | REST CRUD endpoints for Stage model; Fastify route + Prisma already has Stage model |
| CRM-03 | Usuário configura regras de qualificação por pipeline | QualificationRule model needed in schema; UI form with field/operator/value/stage_trigger |
| CRM-04 | Usuário busca e filtra leads por nome, telefone, estágio, veículo | Prisma `where` with multiple optional filters; client-side debounced search input |
| CRM-05 | Usuário visualiza histórico de conversa e notas de cada lead | Conversation + Message + LeadNote already in DB; REST endpoint GET /leads/:id/detail |
| CRM-06 | Usuário edita dados do lead manualmente | REST PATCH /leads/:id; updateLead service already exists; shadcn/ui Sheet/Dialog form |
| CRM-07 | CRM atualiza em tempo real via WebSocket | Socket.IO on Fastify backend; Next.js client subscribes; emit on lead mutations |
| WAPP-05 | Operador visualiza todas as conversas em inbox multichat | REST GET /conversations with messages; Socket.IO for new message events |
| WAPP-06 | Vendedor assume conversa e IA pausa automaticamente (handoff) | Lead.humanOverride already in schema; PATCH endpoint + agent.service checks flag |
</phase_requirements>

---

## Summary

Phase 3 is the full frontend + real-time API phase. The backend data model (Prisma schema with Lead, Stage, Pipeline, Conversation, Message, LeadNote) and core CRM services (lead.service.ts, pipeline.service.ts, conversation.service.ts) are already built in Phases 1-2. What's missing is: the REST API routes exposing this data, Socket.IO wiring on the Fastify backend, and the entire Next.js frontend.

The critical architectural decision is how Socket.IO lives alongside the existing Fastify 5 backend. The `fastify-socket.io` plugin officially supports only Fastify 4.x. For Fastify 5, the correct approach is to attach Socket.IO directly to the underlying HTTP server that Fastify exposes via `fastify.server`, bypassing the plugin layer entirely. This avoids both the plugin compatibility problem and the fragile "custom Next.js server" anti-pattern.

The frontend is a new Next.js 15 app (separate `frontend/` directory at project root, added as a Docker service). It connects to the Fastify backend via REST (proxied through Next.js rewrites to avoid CORS) and a Socket.IO client. The Kanban board uses dnd-kit with one `DndContext` wrapping multiple `SortableContext` instances (one per column), with a `DragOverlay` for cross-column drag performance.

**Primary recommendation:** Build REST routes first (Wave 1), then add Socket.IO to Fastify (Wave 2), then build Next.js frontend consuming both (Wave 3). Human handoff is a PATCH endpoint that sets `humanOverride=true` on Lead — the agent already checks this field.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 | Frontend app framework | SSR, App Router, API rewrites for proxy, already decided in Phase 1 research |
| Tailwind CSS | 4.x | Utility styling | Already decided; v4 requires no config file, uses CSS `@import "tailwindcss"` |
| shadcn/ui | latest | Component library | Accessible, Tailwind-based, customizable; provides Card, Sheet, Dialog, Input, Badge, Table |
| dnd-kit | 6.x (`@dnd-kit/core` + `@dnd-kit/sortable`) | Kanban drag-and-drop | Replaced react-beautiful-dnd (unmaintained); hook-based, accessible, Kanban-specific patterns well-documented |
| Socket.IO client | 4.x (`socket.io-client`) | Real-time frontend subscription | Pairs with Socket.IO on Fastify backend |
| Socket.IO server | 4.x (`socket.io`) | Real-time backend events | Attach to Fastify's `fastify.server` (Node http.Server) — bypasses plugin compatibility issue |
| TanStack Query | 5.x (`@tanstack/react-query`) | Server state, caching, refetch | Manages async data in Next.js client components; pairs naturally with Socket.IO invalidation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | 2.x | Charts (future dashboard) | Phase 4; not needed in Phase 3 |
| `@fastify/cors` | 4.x | CORS on Fastify | Required if frontend calls backend directly without proxy |
| Zod | 4.x (already installed) | Body validation on new routes | Already in project — use for all new API route schemas |
| `react-hook-form` | 7.x | Form state management | Pipeline config forms, lead edit forms |
| `@hookform/resolvers` | 3.x | Zod + react-hook-form bridge | Validate forms with same Zod schemas as backend |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dnd-kit | `@hello-pangea/dnd` | hello-pangea is a maintained fork of react-beautiful-dnd; simpler API but less flexible than dnd-kit for custom sensors |
| TanStack Query | SWR | Both valid; TanStack Query has better invalidation API for use with Socket.IO events |
| Socket.IO | native WebSocket | Socket.IO adds rooms, reconnection, namespaces — worth the overhead for multichat inbox with multiple lead conversations |
| Next.js rewrites proxy | @fastify/cors | Rewrites avoid CORS entirely; CORS needed anyway for Socket.IO connection from browser |

**Installation (frontend):**
```bash
# From project root — creates frontend/ directory
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd frontend
npx shadcn@latest init
npx shadcn@latest add card badge button sheet dialog input label table tabs scroll-area separator
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install socket.io-client
npm install @tanstack/react-query
npm install react-hook-form @hookform/resolvers zod
```

**Installation (backend additions):**
```bash
# From project root (Fastify backend)
npm install socket.io
npm install @fastify/cors
```

---

## Architecture Patterns

### Recommended Project Structure
```
autoscar-agent/          # existing Fastify backend
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── instance.ts      # existing
│   │   │   ├── webhook.ts       # existing
│   │   │   ├── scraper.ts       # existing
│   │   │   ├── leads.ts         # NEW: CRM CRUD
│   │   │   ├── pipelines.ts     # NEW: pipeline config
│   │   │   └── conversations.ts # NEW: multichat inbox
│   │   ├── plugins/
│   │   │   └── socket.ts        # NEW: Socket.IO init plugin
│   │   └── server.ts            # add CORS + socket plugin
│   └── crm/
│       └── qualification-rule.service.ts  # NEW for CRM-03
│
frontend/                # NEW Next.js 15 app
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # redirect to /crm
│   │   ├── crm/
│   │   │   └── page.tsx         # Kanban board
│   │   ├── inbox/
│   │   │   └── page.tsx         # Multichat inbox
│   │   └── settings/
│   │       └── pipeline/
│   │           └── page.tsx     # Pipeline config
│   ├── components/
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx  # DndContext wrapper
│   │   │   ├── KanbanColumn.tsx # SortableContext per column
│   │   │   └── LeadCard.tsx     # useSortable item
│   │   ├── inbox/
│   │   │   ├── ConversationList.tsx
│   │   │   └── ChatWindow.tsx
│   │   └── lead/
│   │       ├── LeadDetail.tsx
│   │       └── LeadEditForm.tsx
│   ├── lib/
│   │   ├── api.ts               # fetch wrapper pointing to /api proxy
│   │   └── socket.ts            # Socket.IO client singleton ("use client")
│   └── providers/
│       └── QueryProvider.tsx    # TanStack Query provider
```

### Pattern 1: Kanban with dnd-kit (cross-column drag)

**What:** One `DndContext` wraps all columns. Each column has its own `SortableContext`. `DragOverlay` renders the dragged card at the root level to avoid CSS clipping. `onDragOver` updates local state optimistically; `onDragEnd` commits to server.

**When to use:** Any multi-column sortable board.

```typescript
// Source: https://docs.dndkit.com/presets/sortable
// KanbanBoard.tsx
'use client';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function KanbanBoard({ columns, leads }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }, // prevent accidental drags
  }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragOver={handleDragOver}   // optimistic column move
      onDragEnd={handleDragEnd}     // commit to API
    >
      <div className="flex gap-4 overflow-x-auto">
        {columns.map((col) => (
          <SortableContext
            key={col.id}
            id={col.id}
            items={leads.filter(l => l.stageId === col.id).map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn column={col} leads={leads.filter(l => l.stageId === col.id)} />
          </SortableContext>
        ))}
      </div>
      <DragOverlay>
        {activeId ? <LeadCard lead={leads.find(l => l.id === activeId)!} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### Pattern 2: Socket.IO attached to Fastify 5 HTTP Server

**What:** Since `fastify-socket.io` does not officially support Fastify 5, attach Socket.IO directly to `fastify.server` (the Node.js `http.Server` Fastify exposes). Register as a Fastify plugin so the `io` instance is available on the `fastify` decorator.

**When to use:** Any Fastify 5 application needing Socket.IO.

```typescript
// Source: https://socket.io/docs/v4/server-initialization/
// src/api/plugins/socket.ts
import fp from 'fastify-plugin';
import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

export const socketPlugin = fp(async (fastify: FastifyInstance) => {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', (_instance, done) => {
    io.close();
    done();
  });

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });
});
```

**Emit from route handlers:**
```typescript
// In leads.ts route after a lead update:
fastify.io.emit('lead:updated', updatedLead);
// Or room-scoped:
fastify.io.to(`pipeline:${pipelineId}`).emit('lead:moved', { leadId, stageId });
```

### Pattern 3: Socket.IO client singleton in Next.js

**What:** Create one socket instance per browser session, exported as a module singleton. Mark file with `"use client"`. Consume in components via `useEffect`.

```typescript
// Source: https://socket.io/how-to/use-with-nextjs
// frontend/src/lib/socket.ts
'use client';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001', {
      autoConnect: false,
    });
  }
  return socket;
}
```

```typescript
// In a component:
useEffect(() => {
  const sock = getSocket();
  sock.connect();
  sock.on('lead:updated', (lead) => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  });
  return () => { sock.off('lead:updated'); };
}, [queryClient]);
```

### Pattern 4: Human Handoff (WAPP-06)

**What:** The `Lead.humanOverride` boolean is already in the Prisma schema (default `false`). The agent's `message.worker.ts` must check this flag before running the agentic loop. The frontend sends a PATCH to toggle it. Socket.IO broadcasts the change to all connected clients.

**Implementation steps:**
1. Add guard in `message.worker.ts`: load lead, if `humanOverride === true`, skip `runAgentTurn`, log "human override active"
2. Add `PATCH /leads/:id/handoff` endpoint: sets `humanOverride = true`, emits `lead:handoff` via Socket.IO
3. Add "Assumir conversa" button in `ChatWindow.tsx` that calls the endpoint
4. When operator sends a message from inbox, send via `POST /conversations/:id/message` (calls Evolution API `sendText`)

**The `humanOverride` flag resets to `false` when:** operator explicitly clicks "Devolver para IA" button (separate PATCH endpoint).

### Pattern 5: Next.js Rewrites as API Proxy

**What:** Configure `next.config.ts` to rewrite `/api/backend/*` to the Fastify server. This avoids CORS issues for REST calls. Socket.IO uses a direct connection (different port or path), which requires CORS on the Fastify side.

```typescript
// frontend/next.config.ts
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/:path*`,
      },
    ];
  },
};
export default nextConfig;
```

### Anti-Patterns to Avoid

- **Using `fastify-socket.io` npm package with Fastify 5:** Package is pinned to Fastify 4.x. Use the direct `new Server(fastify.server, ...)` pattern instead.
- **Custom Next.js server for Socket.IO:** The Socket.IO docs warn this removes Next.js performance optimizations. Since the Socket.IO server is already on Fastify, the Next.js app stays standard.
- **Calling Fastify API directly from browser without proxy:** Causes CORS issues in dev. Use Next.js rewrites to proxy REST calls.
- **Using `useSortable` and `useDroppable` on the same Kanban column element:** Causes dnd-kit conflicts. Use `useSortable` on cards only; columns use `useDroppable` (or wrap as SortableContext containers).
- **Initializing Socket.IO client at module-level without `"use client"`:** Causes SSR crash in Next.js App Router. Always wrap in `"use client"` or inside `useEffect`.
- **Forgetting `DragOverlay` in cross-column Kanban:** Without it, dragged card disappears from its origin column and the ghost element looks broken.
- **Optimistic updates without rollback:** When `onDragEnd` API call fails, the lead card stays in the wrong column. Always rollback local state on API error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop Kanban | Custom mouse event tracking | dnd-kit | Accessibility (keyboard, screen reader), touch support, sensors API, all edge cases handled |
| Form validation | Manual state + error tracking | react-hook-form + zod | Handles blur/submit validation, field arrays, nested objects, error messages |
| UI components (cards, dialogs, sheets) | Custom styled divs | shadcn/ui | Accessible, keyboard navigable, consistent theming, matches Tailwind 4 |
| Real-time state sync | Custom polling | Socket.IO + TanStack Query invalidation | Polling is inefficient; Socket.IO push + query invalidation is the correct pattern |
| CORS proxy | Express middleware | Next.js rewrites | Built into Next.js, zero overhead, no extra server |

**Key insight:** The heavy lifting (data model, CRM services, agent logic) is done. Phase 3 is assembly — connect existing backend services to new REST routes, add Socket.IO, build frontend consuming both.

---

## Common Pitfalls

### Pitfall 1: `fastify-socket.io` Incompatible with Fastify 5
**What goes wrong:** Installing `fastify-socket.io` and registering it causes a crash or silent failure because the plugin targets Fastify 4.x.
**Why it happens:** The project uses Fastify 5.x (installed in Phase 1). The plugin hasn't been updated.
**How to avoid:** Import `socket.io` directly, attach `new Server(fastify.server, options)`, decorate fastify manually via `fastify-plugin`.
**Warning signs:** Plugin registration throws `FST_ERR_*` or `io` decorator is undefined.

### Pitfall 2: Socket.IO CORS Mismatch
**What goes wrong:** Browser blocks Socket.IO connection with CORS error even though REST API works.
**Why it happens:** Next.js rewrites proxy REST calls (same origin), but Socket.IO is a direct WebSocket connection to a different port — not proxied.
**How to avoid:** Set `cors.origin` in Socket.IO server options to `process.env.FRONTEND_URL`. Also register `@fastify/cors` on Fastify with the same origin.
**Warning signs:** Console shows `Access-Control-Allow-Origin` error on `socket.io` requests, not on `/api/*` requests.

### Pitfall 3: Kanban Empty Column Drag Target
**What goes wrong:** Dragging the last card out of a column makes it impossible to drag cards back in (no drop target).
**Why it happens:** dnd-kit's `SortableContext` with an empty `items` array has no drop target.
**How to avoid:** Each column element must also implement `useDroppable` with the column's `id` as the droppable id. The empty column area becomes the drop target when `items` is empty.
**Warning signs:** Cards snap back when dropped on empty columns.

### Pitfall 4: `humanOverride` Flag Not Checked in Worker
**What goes wrong:** AI keeps responding to leads even after operator takes over.
**Why it happens:** Easy to forget the guard. `message.worker.ts` needs to load the lead before calling `runAgentTurn`.
**How to avoid:** First line of the worker job: load lead from DB, check `humanOverride === true`, early return with a log.
**Warning signs:** Operator and AI send messages simultaneously; lead sees double responses.

### Pitfall 5: Socket.IO Client Initialized Server-Side
**What goes wrong:** Next.js build fails or throws during SSR because `socket.io-client` requires browser APIs.
**Why it happens:** App Router components that import `socket.ts` without `"use client"` directive attempt to run on server.
**How to avoid:** The `socket.ts` lib file must have `"use client"` at top. Components using the socket must be client components. Never import socket in Server Components.
**Warning signs:** `ReferenceError: window is not defined` during build or `TypeError: navigator is not defined`.

### Pitfall 6: Prisma Missing QualificationRule Model (CRM-03)
**What goes wrong:** Pipeline config UI has nowhere to store qualification rules.
**Why it happens:** The ARCHITECTURE.md mentions `QualificationRule` in the data model, but it was never added to `prisma/schema.prisma` in Phases 1-2.
**How to avoid:** Wave 0 of Phase 3 must add `QualificationRule` model to schema + run `prisma migrate`.
**Warning signs:** Trying to call `prisma.qualificationRule` throws a runtime error.

---

## Code Examples

### REST Routes — Leads CRUD Pattern

```typescript
// Source: Fastify 5 docs + existing project pattern
// src/api/routes/leads.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import prisma from '../../db/prisma.js';
import { updateLead, moveToStage, addNote } from '../../crm/lead.service.js';

const LeadFilterSchema = z.object({
  search: z.string().optional(),
  stageId: z.string().optional(),
  pipelineId: z.string().optional(),
});

export default async function leadsRoutes(fastify: FastifyInstance) {
  // GET /leads?pipelineId=...&search=...
  fastify.get('/leads', async (req) => {
    const { search, stageId, pipelineId } = LeadFilterSchema.parse(req.query);
    return prisma.lead.findMany({
      where: {
        pipelineId: pipelineId ?? undefined,
        stageId: stageId ?? undefined,
        OR: search ? [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ] : undefined,
      },
      include: { stage: true, notes: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  });

  // GET /leads/:id/detail — conversation + all notes
  fastify.get('/leads/:id/detail', async (req) => {
    const { id } = req.params as { id: string };
    return prisma.lead.findUniqueOrThrow({
      where: { id },
      include: {
        stage: true,
        notes: { orderBy: { createdAt: 'asc' } },
        conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
      },
    });
  });

  // PATCH /leads/:id — manual edit (CRM-06)
  fastify.patch('/leads/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = req.body as Parameters<typeof updateLead>[1];
    const updated = await updateLead(id, data);
    fastify.io.emit('lead:updated', updated);
    return updated;
  });

  // PATCH /leads/:id/move — drag-and-drop stage move
  fastify.patch('/leads/:id/move', async (req) => {
    const { id } = req.params as { id: string };
    const { stageId } = req.body as { stageId: string };
    const updated = await moveToStage(id, stageId);
    fastify.io.emit('lead:moved', { leadId: id, stageId });
    return updated;
  });

  // PATCH /leads/:id/handoff — human takes over (WAPP-06)
  fastify.patch('/leads/:id/handoff', async (req) => {
    const { id } = req.params as { id: string };
    const { override } = req.body as { override: boolean };
    const updated = await prisma.lead.update({
      where: { id },
      data: { humanOverride: override },
    });
    fastify.io.emit('lead:handoff', { leadId: id, humanOverride: override });
    return updated;
  });
}
```

### Guard in message.worker.ts

```typescript
// Add at start of message worker job handler (after existing setup)
// src/queue/workers/message.worker.ts — add before runAgentTurn
const lead = await prisma.lead.findFirst({ where: { phone: phoneNumber } });
if (lead?.humanOverride === true) {
  fastify.log.info({ phoneNumber }, 'human override active — skipping AI agent');
  return; // drop the job, human is handling it
}
```

### QualificationRule Schema Addition

```prisma
// prisma/schema.prisma — add this model (required for CRM-03)
model QualificationRule {
  id           String   @id @default(cuid())
  pipelineId   String
  pipeline     Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  field        String   // e.g. "creditStatus", "city", "paymentMethod"
  operator     String   // "equals", "contains", "not_equals"
  value        String
  stageTrigger String   // stageId to move lead to when rule matches
  tenantId     String?
  createdAt    DateTime @default(now())
}
// Also add to Pipeline model: qualificationRules QualificationRule[]
```

### LeadCard with useSortable

```typescript
// Source: https://docs.dndkit.com/presets/sortable
// frontend/src/components/kanban/LeadCard.tsx
'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function LeadCard({ lead, isDragging = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="bg-white rounded-lg p-3 shadow-sm border cursor-grab active:cursor-grabbing">
      <p className="font-medium text-sm">{lead.name ?? lead.phone}</p>
      <p className="text-xs text-muted-foreground">{lead.stage?.name}</p>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | dnd-kit | 2022 (rbd unmaintained) | dnd-kit is the standard; rbd has open bugs unfixed |
| Tailwind config via `tailwind.config.ts` | CSS `@import "tailwindcss"` with `@theme` | Tailwind v4 (2025) | No config file needed; theme variables in CSS |
| Socket.IO in Next.js via custom server | Socket.IO on separate backend + direct connect | Ongoing | Custom Next.js server removes perf optimizations; separate backend is clean separation |
| `fastify-socket.io` plugin | Direct `new Server(fastify.server, ...)` | Fastify 5 upgrade | Plugin is Fastify 4 only; direct attachment is the workaround |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Unmaintained since 2022. Use dnd-kit.
- `tailwind.config.ts` file: Optional in v4. New projects use `@import "tailwindcss"` in CSS.
- `fastify-socket.io` npm package: Fastify 4 only as of 2024. Bypass with direct attachment.

---

## Open Questions

1. **Where does the Next.js app run in Docker?**
   - What we know: Current `docker-compose.yml` has `app` service (Fastify) on port not exposed to host. Nginx proxies to it. No `frontend` service exists.
   - What's unclear: Should Next.js run on port 3000 with Nginx routing `/` → Next.js and `/api/` → Fastify? Or Next.js proxies all Fastify calls via rewrites?
   - Recommendation: Add `frontend` service to docker-compose on port 3000. Update nginx.conf to route `/` → frontend:3000, `/api/` and `/socket.io/` → app:3001. This is the cleanest separation.

2. **Socket.IO port — same as Fastify or separate?**
   - What we know: Socket.IO can run on the same port as Fastify (shares http.Server).
   - What's unclear: Nginx must be configured to upgrade `/socket.io/` WebSocket connections.
   - Recommendation: Same port (3001). Add Nginx `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"` for `/socket.io/` location block.

3. **QualificationRule UI complexity (CRM-03)**
   - What we know: The data model is straightforward (field/operator/value/stageTrigger).
   - What's unclear: How the agent actually uses these rules — currently agent uses GPT-4o to decide stage moves, not a rules engine.
   - Recommendation: For Phase 3, build the UI to CRUD qualification rules (they're stored in DB). The agent integration (checking rules before moves) can be a Phase 4 enhancement. This satisfies the requirement as stated.

---

## Sources

### Primary (HIGH confidence)
- https://docs.dndkit.com/presets/sortable — dnd-kit SortableContext, useSortable, DragOverlay patterns
- https://socket.io/how-to/use-with-nextjs — official Socket.IO + Next.js integration guide
- https://socket.io/docs/v4/server-initialization/ — Socket.IO server initialization, attaching to existing http.Server
- https://ui.shadcn.com/docs/installation/next — shadcn/ui Next.js 15 + Tailwind 4 setup
- https://ui.shadcn.com/docs/tailwind-v4 — Tailwind v4 with shadcn/ui

### Secondary (MEDIUM confidence)
- https://github.com/ducktors/fastify-socket.io — confirmed Fastify 4 only (v5.1.0 latest, last published Aug 2024)
- https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui — reference implementation of dnd-kit + shadcn/ui Kanban
- https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html — 2026 production Kanban with shadcn/ui
- https://blog.logrocket.com/build-kanban-board-dnd-kit-react/ — dnd-kit Kanban with cross-column drag patterns

### Tertiary (LOW confidence)
- Fastify 5 + Socket.IO direct attachment pattern — verified by reading socket.io docs and Fastify server property, but no canonical "Fastify 5 + Socket.IO" tutorial found. Pattern is derived from both official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via official docs or Context7
- Architecture: HIGH — Socket.IO/Fastify pattern derived from official docs; dnd-kit Kanban patterns from official docs + multiple recent implementations
- Pitfalls: HIGH — fastify-socket.io Fastify 5 incompatibility verified from GitHub; other pitfalls from official docs and community
- QualificationRule gap: HIGH — confirmed by reading `prisma/schema.prisma` directly

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable stack; dnd-kit and Socket.IO don't change fast)
