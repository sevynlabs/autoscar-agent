'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface AgentLogEntry {
  id: string;
  at: string;
  level: 'error' | 'warn';
  source: 'message' | 'tool' | 'fallback' | 'send';
  kind?: string;
  message: string;
  detail?: string;
  phone?: string;
  leadId?: string;
  conversationId?: string;
  instance?: string;
  tool?: string;
}

interface AgentHealth {
  ok: boolean;
  message?: string;
  since?: string;
  failedCount?: number;
}

const TZ = 'America/Sao_Paulo';

const SOURCE_LABEL: Record<AgentLogEntry['source'], string> = {
  message: 'Resposta ao lead',
  tool: 'Ferramenta',
  fallback: 'Loop da IA',
  send: 'Envio WhatsApp',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AgentLogsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'all' | 'error' | 'warn'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-logs'],
    queryFn: () => api.get<{ logs: AgentLogEntry[] }>('/system/agent-logs?limit=500'),
    refetchInterval: 60_000,
  });
  const { data: health } = useQuery({
    queryKey: ['agent-health'],
    queryFn: () => api.get<AgentHealth>('/system/agent-health'),
    refetchInterval: 60_000,
  });

  // Live: prepend new entries as they happen.
  useEffect(() => {
    const sock = getSocket();
    sock.connect();
    const onLog = (entry: AgentLogEntry) => {
      queryClient.setQueryData<{ logs: AgentLogEntry[] }>(['agent-logs'], (prev) => ({
        logs: [entry, ...(prev?.logs ?? []).filter((l) => l.id !== entry.id)].slice(0, 500),
      }));
    };
    sock.on('agent:log', onLog);
    return () => { sock.off('agent:log', onLog); };
  }, [queryClient]);

  const logs = data?.logs ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) =>
      (level === 'all' || l.level === level) &&
      (!q || [l.message, l.detail, l.phone, l.tool, l.instance].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [logs, search, level]);

  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const errors24h = logs.filter((l) => l.level === 'error' && new Date(l.at).getTime() >= since24h).length;
  const warns24h = logs.filter((l) => l.level === 'warn' && new Date(l.at).getTime() >= since24h).length;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">Logs da IA</h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1">
          Erros e avisos do agente de IA ao atender leads. Atualiza em tempo real.
        </p>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className={`rounded-xl p-4 sm:p-5 border shadow-sm ${health && !health.ok
          ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
          : 'bg-white dark:bg-[#141414] border-neutral-200 dark:border-white/[0.06]'}`}>
          <span className="text-[10px] sm:text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Status da IA</span>
          {health && !health.ok ? (
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {health.message}
            </p>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Respondendo normalmente
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl p-4 sm:p-5 border border-neutral-200 dark:border-white/[0.06] shadow-sm">
          <span className="text-[10px] sm:text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Erros (24h)</span>
          <p className="text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white mt-2">{errors24h.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl p-4 sm:p-5 border border-neutral-200 dark:border-white/[0.06] shadow-sm">
          <span className="text-[10px] sm:text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Avisos (24h)</span>
          <p className="text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white mt-2">{warns24h.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar os logs: {(error as Error).message}</p>
      )}

      <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-white/[0.06] flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <Search className="h-4 w-4 text-neutral-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por telefone, erro, ferramenta..."
              className="flex-1 bg-transparent text-sm outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400" />
          </div>
          <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}
            className="h-8 rounded-lg text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 px-2 text-neutral-900 dark:text-white">
            <option value="all">Todos</option>
            <option value="error">Só erros</option>
            <option value="warn">Só avisos</option>
          </select>
          <span className="text-xs text-neutral-400">{filtered.length} registro(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-white/[0.06]">
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Origem</th>
                <th className="px-4 py-3 font-medium">Mensagem</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Lead</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-neutral-400">Carregando...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-neutral-400">Nenhum erro registrado</td></tr>
              )}
              {filtered.map((l) => (
                <Fragment key={l.id}>
                  <tr onClick={() => setOpen(open === l.id ? null : l.id)}
                    className="border-b border-neutral-100 dark:border-white/[0.04] hover:bg-neutral-50 dark:hover:bg-white/[0.03] cursor-pointer align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-600 dark:text-neutral-300">
                      <span className="inline-flex items-center gap-1">
                        {open === l.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {formatDateTime(l.at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${l.level === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'}`}>
                        {l.level === 'error' ? 'Erro' : 'Aviso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-neutral-600 dark:text-neutral-300">{SOURCE_LABEL[l.source] ?? l.source}</td>
                    <td className="px-4 py-3 text-neutral-900 dark:text-white">{l.message}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-neutral-600 dark:text-neutral-300 whitespace-nowrap">{l.phone ?? '—'}</td>
                  </tr>
                  {open === l.id && (
                    <tr className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-100 dark:border-white/[0.04]">
                      <td colSpan={5} className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                        {l.detail && (
                          <pre className="whitespace-pre-wrap break-all font-mono bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/[0.06] rounded-lg p-3">{l.detail}</pre>
                        )}
                        <p>
                          {l.phone && <>Telefone: {l.phone} · </>}
                          {l.instance && <>Instância: {l.instance} · </>}
                          {l.tool && <>Ferramenta: {l.tool} · </>}
                          {l.kind && <>Tipo: {l.kind}</>}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
