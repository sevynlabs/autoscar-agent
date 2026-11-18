'use client';

import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Download, Search, Send, Store, MessageSquare, AlertTriangle } from 'lucide-react';

interface NotificationRow {
  id: string;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  vehicleUrl: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  groupName: string | null;
  destination: string;
  destinationType: string;
  channel: string | null;
  status: string;
  error: string | null;
  reason: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  from: string;
  to: string;
  truncated: boolean;
  notifications: NotificationRow[];
}

interface SellerGroup {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  leads: number;
  sent: number;
  failed: number;
  lastSentAt: string | null;
  rows: NotificationRow[];
}

const TZ = 'America/Sao_Paulo';

function toInputDate(d: Date): string {
  // en-CA formats as YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function formatPhone(p: string | null): string {
  if (!p) return '—';
  const d = p.replace(/\D/g, '');
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

const leadKey = (r: NotificationRow) => r.leadId || r.leadPhone || r.id;
const sellerKey = (r: NotificationRow) =>
  (r.sellerEmail || r.sellerPhone || r.sellerName || r.destination).toLowerCase();

function channelLabel(r: NotificationRow): string {
  if (r.destinationType === 'seller_group') return 'Grupo WhatsApp';
  if (r.channel === 'cloud_api') return 'Template (Cloud API)';
  if (r.channel === 'evolution') return 'Texto (Evolution)';
  return 'Telefone';
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function SellerReportPage() {
  const today = new Date();
  const [from, setFrom] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toInputDate(today));
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const validRange = !!from && !!to && from <= to;

  const { data, isLoading, error } = useQuery<NotificationsResponse>({
    queryKey: ['seller-notifications', from, to],
    queryFn: () => api.get(`/admin/seller-notifications?from=${from}&to=${to}`),
    enabled: validRange,
  });

  const sellers = useMemo<SellerGroup[]>(() => {
    const map = new Map<string, SellerGroup>();
    for (const r of data?.notifications ?? []) {
      const key = sellerKey(r);
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          name: r.sellerName?.trim() || r.groupName || (r.sellerPhone ? formatPhone(r.sellerPhone) : 'Vendedor sem nome'),
          email: r.sellerEmail,
          phone: r.sellerPhone,
          groupName: r.groupName,
          leads: 0, sent: 0, failed: 0, lastSentAt: null, rows: [],
        };
        map.set(key, g);
      }
      g.rows.push(r);
      if (r.status === 'sent') {
        g.sent++;
        if (!g.lastSentAt || r.createdAt > g.lastSentAt) g.lastSentAt = r.createdAt;
      } else {
        g.failed++;
      }
    }
    for (const g of map.values()) {
      g.leads = new Set(g.rows.filter(r => r.status === 'sent').map(leadKey)).size;
    }
    return [...map.values()].sort((a, b) => b.leads - a.leads || b.failed - a.failed);
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter(s =>
      [s.name, s.email, s.phone, s.groupName].some(v => v?.toLowerCase().includes(q)),
    );
  }, [sellers, search]);

  const totals = useMemo(() => {
    const rows = filtered.flatMap(s => s.rows);
    const sentRows = rows.filter(r => r.status === 'sent');
    return {
      leads: new Set(sentRows.map(leadKey)).size,
      sellers: filtered.filter(s => s.leads > 0).length,
      templates: sentRows.filter(r => r.channel === 'cloud_api').length,
      failed: rows.length - sentRows.length,
    };
  }, [filtered]);

  const exportCsv = () => {
    const header = ['Data/hora', 'Vendedor', 'E-mail vendedor', 'Telefone vendedor', 'Grupo', 'Lead', 'Telefone lead', 'Veículo', 'Canal', 'Status', 'Erro'];
    const lines = filtered.flatMap(s => s.rows).map(r => [
      formatDateTime(r.createdAt), r.sellerName, r.sellerEmail, r.sellerPhone, r.groupName,
      r.leadName, r.leadPhone, r.vehicleUrl, channelLabel(r), r.status === 'sent' ? 'Enviado' : 'Falhou', r.error,
    ].map(csvCell).join(';'));
    // BOM so Excel opens UTF-8 accents correctly
    const blob = new Blob(['﻿' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-por-vendedor_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: 'Leads enviados', value: totals.leads, icon: Send, tone: 'red' },
    { label: 'Vendedores', value: totals.sellers, icon: Store, tone: 'neutral' },
    { label: 'Templates enviados', value: totals.templates, icon: MessageSquare, tone: 'green' },
    { label: 'Falhas de envio', value: totals.failed, icon: AlertTriangle, tone: totals.failed > 0 ? 'amber' : 'neutral' },
  ];
  const toneClass: Record<string, string> = {
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    neutral: 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400',
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">Leads por Vendedor</h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1">
            Leads que o agente enviou para cada vendedor (template no WhatsApp ou grupo da loja)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="flex-1 sm:flex-none sm:w-36 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-sm h-9" />
          <span className="text-neutral-400 dark:text-neutral-500 text-xs sm:text-sm">até</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="flex-1 sm:flex-none sm:w-36 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-sm h-9" />
          <button onClick={exportCsv} disabled={!filtered.length}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {!validRange && (
        <p className="text-sm text-amber-600 dark:text-amber-400">A data inicial precisa ser anterior ou igual à final.</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar o relatório: {(error as Error).message}</p>
      )}
      {data?.truncated && (
        <p className="text-sm text-amber-600 dark:text-amber-400">O período tem mais de 5.000 envios; mostrando os mais recentes. Reduza o intervalo de datas.</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white dark:bg-[#141414] rounded-xl p-4 sm:p-5 border border-neutral-200 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">{k.label}</span>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ml-2 ${toneClass[k.tone]}`}>
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white">{k.value.toLocaleString('pt-BR')}</p>
            </div>
          );
        })}
      </div>

      {/* Seller table */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <Search className="h-4 w-4 text-neutral-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar vendedor, e-mail ou telefone..."
            className="flex-1 bg-transparent text-sm outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400" />
          <span className="text-xs text-neutral-400">{filtered.length} vendedor(es)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-white/[0.06]">
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Contato</th>
                <th className="px-4 py-3 font-medium text-right">Leads</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Envios</th>
                <th className="px-4 py-3 font-medium text-right">Falhas</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Último envio</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-400">Carregando...</td></tr>
              )}
              {!isLoading && validRange && !filtered.length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-400">Nenhum lead enviado a vendedores no período</td></tr>
              )}
              {filtered.map(s => {
                const isOpen = expanded === s.key;
                return (
                  <Fragment key={s.key}>
                    <tr onClick={() => setExpanded(isOpen ? null : s.key)}
                      className="border-b border-neutral-100 dark:border-white/[0.04] hover:bg-neutral-50 dark:hover:bg-white/[0.03] cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 dark:text-white truncate">{s.name}</p>
                            {s.groupName && <p className="text-xs text-neutral-500 truncate">Grupo: {s.groupName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-neutral-500 dark:text-neutral-400">
                        <p>{formatPhone(s.phone)}</p>
                        {s.email && <p className="truncate max-w-[240px]">{s.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-white">{s.leads}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-neutral-600 dark:text-neutral-300">{s.sent}</td>
                      <td className="px-4 py-3 text-right">
                        {s.failed > 0
                          ? <Badge variant="secondary" className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">{s.failed}</Badge>
                          : <span className="text-neutral-400">0</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-neutral-500 dark:text-neutral-400">
                        {s.lastSentAt ? formatDateTime(s.lastSentAt) : '—'}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-neutral-50/60 dark:bg-white/[0.02]">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-neutral-500 dark:text-neutral-400">
                                  <th className="py-2 pr-4 font-medium">Data/hora</th>
                                  <th className="py-2 pr-4 font-medium">Lead</th>
                                  <th className="py-2 pr-4 font-medium">Telefone</th>
                                  <th className="py-2 pr-4 font-medium">Veículo</th>
                                  <th className="py-2 pr-4 font-medium">Canal</th>
                                  <th className="py-2 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.rows.map(r => (
                                  <tr key={r.id} className="border-t border-neutral-200/70 dark:border-white/[0.04] text-neutral-700 dark:text-neutral-300">
                                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                                    <td className="py-2 pr-4">{r.leadName || '—'}</td>
                                    <td className="py-2 pr-4 whitespace-nowrap">{formatPhone(r.leadPhone)}</td>
                                    <td className="py-2 pr-4 max-w-[220px] truncate">
                                      {r.vehicleUrl
                                        ? <a href={r.vehicleUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                            className="text-red-600 dark:text-red-400 hover:underline">{r.vehicleUrl.replace(/^https?:\/\/(www\.)?/, '')}</a>
                                        : '—'}
                                    </td>
                                    <td className="py-2 pr-4 whitespace-nowrap">{channelLabel(r)}</td>
                                    <td className="py-2" title={r.error ?? undefined}>
                                      {r.status === 'sent'
                                        ? <span className="text-green-600 dark:text-green-400">Enviado</span>
                                        : <span className="text-amber-600 dark:text-amber-400">Falhou{r.error ? ` — ${r.error.slice(0, 80)}` : ''}</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
