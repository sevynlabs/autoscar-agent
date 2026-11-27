// Tracks whether the AI agent is currently able to answer leads, so the CRM
// panel can show an alert (e.g. OpenAI out of credits). Panel-only: this is
// never sent to sellers or leads. State lives in Redis so it is shared by all
// workers and survives restarts.
import { Redis } from 'ioredis';
import { emit } from '../realtime/emitter.js';

const KEY = 'agent:health';
const LOGS_KEY = 'agent:logs';
const MAX_LOGS = 1000;

export type AgentFailureKind = 'no_credits' | 'invalid_key' | 'model_unavailable' | 'rate_limited' | 'unknown';

export interface AgentHealth {
  ok: boolean;
  kind?: AgentFailureKind;
  message?: string; // human-readable, pt-BR
  detail?: string; // raw error
  since?: string; // ISO — first failure of the current outage
  lastAt?: string; // ISO — latest failure
  failedCount?: number; // lead messages that got no AI answer
}

let client: Redis | null = null;
function redis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return client;
}

export type AgentLogSource = 'message' | 'tool' | 'fallback' | 'send';

export interface AgentLogContext {
  phone?: string;
  leadId?: string;
  conversationId?: string;
  instance?: string;
  tool?: string;
}

export interface AgentLogEntry extends AgentLogContext {
  id: string;
  at: string; // ISO
  level: 'error' | 'warn';
  source: AgentLogSource;
  kind?: AgentFailureKind;
  message: string; // human-readable, pt-BR
  detail?: string; // raw error
}

export function classifyAgentError(err: unknown): { kind: AgentFailureKind; message: string } {
  const e = err as { status?: number; code?: string; error?: { code?: string }; message?: string };
  const status = e?.status;
  const code = e?.code ?? e?.error?.code;
  const text = String(e?.message ?? err).toLowerCase();

  if (code === 'insufficient_quota' || text.includes('insufficient_quota') || text.includes('exceeded your current quota')) {
    return { kind: 'no_credits', message: 'A IA parou de responder: sem créditos na OpenAI. Adicione créditos em platform.openai.com.' };
  }
  if (status === 401 || code === 'invalid_api_key' || text.includes('openai_api_key must be set')) {
    return { kind: 'invalid_key', message: 'A IA parou de responder: chave da OpenAI inválida ou ausente.' };
  }
  if (status === 404 || code === 'model_not_found') {
    return { kind: 'model_unavailable', message: 'A IA parou de responder: o modelo configurado no Agente IA não está disponível. Escolha outro modelo.' };
  }
  if (status === 429) {
    return { kind: 'rate_limited', message: 'A IA está recebendo limite de uso da OpenAI (rate limit). Algumas mensagens não foram respondidas.' };
  }
  return { kind: 'unknown', message: 'A IA teve erro ao responder leads. Verifique os logs do servidor.' };
}

export async function getAgentHealth(): Promise<AgentHealth> {
  try {
    const raw = await redis().get(KEY);
    return raw ? (JSON.parse(raw) as AgentHealth) : { ok: true };
  } catch {
    return { ok: true };
  }
}

/** Append one entry to the panel's AI log (newest first, capped). */
export async function appendAgentLog(entry: Omit<AgentLogEntry, 'id' | 'at'>): Promise<void> {
  try {
    const full: AgentLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
      detail: entry.detail?.slice(0, 2000),
    };
    await redis().multi().lpush(LOGS_KEY, JSON.stringify(full)).ltrim(LOGS_KEY, 0, MAX_LOGS - 1).exec();
    emit('agent:log', full);
  } catch { /* never break message handling */ }
}

export async function getAgentLogs(limit = 200): Promise<AgentLogEntry[]> {
  try {
    const raw = await redis().lrange(LOGS_KEY, 0, Math.min(Math.max(limit, 1), MAX_LOGS) - 1);
    return raw.map((r) => JSON.parse(r) as AgentLogEntry);
  } catch {
    return [];
  }
}

/** The AI could not answer a lead message: log it and raise the panel alert. */
export async function recordAgentFailure(err: unknown, ctx: AgentLogContext = {}): Promise<void> {
  const { kind, message } = classifyAgentError(err);
  const detail = errorDetail(err);
  await appendAgentLog({ level: 'error', source: 'message', kind, message, detail, ...ctx });
  try {
    const prev = await getAgentHealth();
    const now = new Date().toISOString();
    const next: AgentHealth = {
      ok: false,
      kind,
      message,
      detail: detail.slice(0, 500),
      since: prev.ok ? now : prev.since ?? now,
      lastAt: now,
      failedCount: (prev.ok ? 0 : prev.failedCount ?? 0) + 1,
    };
    await redis().set(KEY, JSON.stringify(next));
    emit('agent:health', next);
  } catch { /* never break message handling */ }
}

export function errorDetail(err: unknown): string {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    return `${status ? `[${status}] ` : ''}${err.message}`;
  }
  return String(err);
}

export async function recordAgentSuccess(): Promise<void> {
  try {
    // Only touch Redis/socket when an outage is actually being cleared.
    const deleted = await redis().del(KEY);
    if (deleted > 0) emit('agent:health', { ok: true });
  } catch { /* ignore */ }
}
