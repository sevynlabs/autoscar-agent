'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface AgentHealth {
  ok: boolean;
  message?: string;
  since?: string;
  failedCount?: number;
}

function formatSince(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Panel-only alert shown while the AI agent cannot answer leads. */
export function AgentHealthBanner() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['agent-health'],
    queryFn: () => api.get<AgentHealth>('/system/agent-health'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const sock = getSocket();
    sock.connect();
    const onHealth = (payload: AgentHealth) => queryClient.setQueryData(['agent-health'], payload);
    sock.on('agent:health', onHealth);
    return () => { sock.off('agent:health', onHealth); };
  }, [queryClient]);

  if (!data || data.ok) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 px-4 py-3 bg-red-600 text-white text-sm"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-semibold">{data.message ?? 'A IA está com erro ao responder leads.'}</p>
        <p className="text-white/85">
          Desde {formatSince(data.since)}
          {data.failedCount ? ` · ${data.failedCount} mensagem(ns) de leads sem resposta da IA` : ''}
          {' · '}o aviso some sozinho quando a IA voltar a responder.{' '}
          <Link href="/relatorios/logs-ia" className="underline font-medium">Ver logs</Link>
        </p>
      </div>
    </div>
  );
}
