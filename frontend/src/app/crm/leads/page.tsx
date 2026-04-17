'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LeadDetail } from '@/components/lead/LeadDetail';
import { Download, Search, List, Filter, X } from 'lucide-react';

interface Stage { id: string; name: string; order: number }
interface Pipeline { id: string; name: string; stages: Stage[] }
interface LeadRow {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  vehicleUrl: string | null;
  humanOverride: boolean;
  followupAttempts: number;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string } | null;
  notes: { id: string; content: string; createdAt: string }[];
}
interface LeadsResponse { leads: LeadRow[]; total: number; limit: number; offset: number }

const PAGE_SIZE = 50;
const ALL = '__all__';

export default function LeadsListPage() {
  const [pipelineId, setPipelineId] = useState<string>('');
  const [stageId, setStageId] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [humanOverride, setHumanOverride] = useState<string>(ALL);
  const [page, setPage] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [pipelineId, stageId, debouncedSearch, dateFrom, dateTo, humanOverride]);

  const { data: pipelines } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines'),
  });

  useEffect(() => {
    if (!pipelineId && pipelines && pipelines.length > 0) setPipelineId(pipelines[0].id);
  }, [pipelines, pipelineId]);

  const currentPipeline = pipelines?.find((p) => p.id === pipelineId);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (pipelineId) params.set('pipelineId', pipelineId);
    if (stageId && stageId !== ALL) params.set('stageId', stageId);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (humanOverride && humanOverride !== ALL) params.set('humanOverride', humanOverride);
    return params.toString();
  }, [pipelineId, stageId, debouncedSearch, dateFrom, dateTo, humanOverride]);

  const { data, isFetching } = useQuery<LeadsResponse>({
    queryKey: ['leads-list', queryString, page],
    queryFn: () => {
      const params = new URLSearchParams(queryString);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      return api.get(`/leads?${params.toString()}`);
    },
    enabled: !!pipelineId,
    placeholderData: (prev) => prev,
  });

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async () => {
    if (!pipelineId) return;
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await api.download(`/leads/export?${queryString}`, `leads-${stamp}.xlsx`);
    } catch (err) {
      console.error('Export failed', err);
      alert('Falha ao exportar. Veja o console.');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setStageId(ALL);
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setHumanOverride(ALL);
  };

  const hasActiveFilter =
    (stageId && stageId !== ALL) ||
    debouncedSearch ||
    dateFrom ||
    dateTo ||
    (humanOverride && humanOverride !== ALL);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-white/[0.06] px-4 sm:px-6 py-3 sm:py-4 glass flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <List className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white truncate">Lista de Leads</h1>
            <p className="text-[11px] sm:text-xs text-neutral-400 dark:text-neutral-500 truncate">
              {total} {total === 1 ? 'lead' : 'leads'}
              {hasActiveFilter ? ' (filtrados)' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || !pipelineId}
          className="bg-red-600 hover:bg-red-500 cursor-pointer h-9 text-sm gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{exporting ? 'Exportando...' : 'Exportar Excel'}</span>
          <span className="sm:hidden">{exporting ? '...' : 'Excel'}</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="border-b border-neutral-200 dark:border-white/[0.06] px-4 sm:px-6 py-3 bg-white dark:bg-[#0f0f0f]">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros:</span>
          </div>

          {/* Search (primeiro em mobile) */}
          <div className="relative w-full sm:flex-1 sm:min-w-[220px] sm:max-w-sm sm:order-last">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Nome, telefone ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 sm:items-center">
            {/* Pipeline */}
            <Select value={pipelineId} onValueChange={(v: string | null) => setPipelineId(v ?? '')}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
                {pipelines?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Stage */}
            <Select value={stageId} onValueChange={(v: string | null) => setStageId(v ?? ALL)}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
                <SelectItem value={ALL}>Todas as etapas</SelectItem>
                {currentPipeline?.stages
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* humanOverride */}
            <Select value={humanOverride} onValueChange={(v: string | null) => setHumanOverride(v ?? ALL)}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10">
                <SelectValue placeholder="Atendimento" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
                <SelectItem value={ALL}>IA ou humano</SelectItem>
                <SelectItem value="false">Apenas IA</SelectItem>
                <SelectItem value="true">Apenas humano</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 sm:w-40 h-9 text-sm bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10"
              />
              <span className="text-xs text-neutral-400 px-1">até</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 sm:w-40 h-9 text-sm bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10"
              />
            </div>
          </div>

          {hasActiveFilter && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-9 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-white gap-1 self-start"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {/* Mobile cards (abaixo de md) */}
        <div className="md:hidden space-y-2">
          {leads.length === 0 && !isFetching && (
            <div className="text-center text-neutral-400 py-10 text-sm">Nenhum lead encontrado</div>
          )}
          {leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => setSelectedLeadId(lead.id)}
              className="w-full text-left bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] p-3 active:bg-neutral-50 dark:active:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {lead.name ?? <span className="text-neutral-400 font-normal">Sem nome</span>}
                  </p>
                  <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{lead.phone}</p>
                </div>
                {lead.humanOverride ? (
                  <Badge className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-0 text-[10px] shrink-0">Humano</Badge>
                ) : (
                  <Badge className="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-0 text-[10px] shrink-0">IA</Badge>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-1.5">
                {lead.stage && (
                  <Badge className="bg-neutral-100 dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 border-0 text-[10px]">
                    {lead.stage.name}
                  </Badge>
                )}
                {lead.city && (
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{lead.city}</span>
                )}
                <span className="text-[10px] text-neutral-400 ml-auto shrink-0">
                  {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Desktop table (md+) */}
        <div className="hidden md:block rounded-lg border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-[#0f0f0f] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-200 dark:border-white/[0.06]">
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-center">Atendimento</TableHead>
                <TableHead>Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 && !isFetching && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-neutral-400 py-10 text-sm">
                    Nenhum lead encontrado
                  </TableCell>
                </TableRow>
              )}
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] border-neutral-200 dark:border-white/[0.04]"
                >
                  <TableCell className="font-medium text-neutral-900 dark:text-neutral-100">
                    {lead.name ?? <span className="text-neutral-400">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
                    {lead.phone}
                  </TableCell>
                  <TableCell className="text-neutral-600 dark:text-neutral-400">
                    {lead.email ?? <span className="text-neutral-400">—</span>}
                  </TableCell>
                  <TableCell className="text-neutral-600 dark:text-neutral-400">
                    {lead.city ?? <span className="text-neutral-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {lead.stage ? (
                      <Badge className="bg-neutral-100 dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 border-0">
                        {lead.stage.name}
                      </Badge>
                    ) : <span className="text-neutral-400">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {lead.humanOverride ? (
                      <Badge className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-0">Humano</Badge>
                    ) : (
                      <Badge className="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-0">IA</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-neutral-500 dark:text-neutral-500">
                    {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 gap-2">
            <div>
              Página {page + 1} de {totalPages} · {total} leads
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex-1 sm:flex-none"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex-1 sm:flex-none"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      <LeadDetail
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
}
