'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadDetail } from '@/components/lead/LeadDetail';
import type { Lead } from '@/components/kanban/LeadCard';
import { Search, LayoutDashboard } from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; order: number }[];
}

export default function CRMPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: pipelines } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines'),
  });

  const pipeline = pipelines?.[0];

  const { data: leadsData } = useQuery<{ leads: Lead[]; total: number }>({
    queryKey: ['leads', { pipelineId: pipeline?.id, search: debouncedSearch }],
    queryFn: () =>
      api.get(`/leads?pipelineId=${pipeline!.id}${debouncedSearch ? `&search=${debouncedSearch}` : ''}`),
    enabled: !!pipeline,
  });

  const leads = leadsData?.leads;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-white/[0.06] px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 glass">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">CRM</h1>
            <p className="text-[11px] sm:text-xs text-neutral-400 dark:text-neutral-500 truncate">{pipeline?.name ?? 'Pipeline'}</p>
          </div>
        </div>
        <div className="relative sm:ml-auto sm:max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 h-9"
          />
        </div>
      </div>

      {/* Kanban */}
      {pipeline && leads ? (
        <KanbanBoard
          stages={pipeline.stages}
          leads={leads}
          pipelineId={pipeline.id}
          onLeadClick={setSelectedLeadId}
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-neutral-400 dark:text-neutral-500">
          Carregando...
        </div>
      )}

      <LeadDetail
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
}
