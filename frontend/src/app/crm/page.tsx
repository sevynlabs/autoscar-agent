'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadDetail } from '@/components/lead/LeadDetail';
import type { Lead } from '@/components/kanban/LeadCard';

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

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ['leads', { pipelineId: pipeline?.id, search: debouncedSearch }],
    queryFn: () =>
      api.get(`/leads?pipelineId=${pipeline!.id}${debouncedSearch ? `&search=${debouncedSearch}` : ''}`),
    enabled: !!pipeline,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-bold">CRM</h1>
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {pipeline && leads ? (
        <KanbanBoard
          stages={pipeline.stages}
          leads={leads}
          pipelineId={pipeline.id}
          onLeadClick={setSelectedLeadId}
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
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
