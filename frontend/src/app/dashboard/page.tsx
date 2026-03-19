'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, MessageSquare, Target } from 'lucide-react';

interface DashboardStats {
  totalLeads: number;
  qualifiedCount: number;
  conversionRate: number;
  avgMessagesPerLead: number;
  leadsByStage: { stage: string; count: number }[];
  leadsPerDay: { date: string; count: number }[];
}

const kpiCards = [
  { key: 'totalLeads', label: 'Total de Leads', icon: Users, color: 'from-indigo-500/20 to-indigo-600/5', iconColor: 'text-indigo-400', borderColor: 'border-indigo-500/20' },
  { key: 'qualifiedCount', label: 'Qualificados', icon: Target, color: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400', borderColor: 'border-emerald-500/20' },
  { key: 'conversionRate', label: 'Taxa de Conversão', icon: TrendingUp, color: 'from-purple-500/20 to-purple-600/5', iconColor: 'text-purple-400', borderColor: 'border-purple-500/20', suffix: '%' },
  { key: 'avgMessagesPerLead', label: 'Msgs/Lead (IA)', icon: MessageSquare, color: 'from-cyan-500/20 to-cyan-600/5', iconColor: 'text-cyan-400', borderColor: 'border-cyan-500/20' },
];

export default function DashboardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard', from, to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return api.get(`/dashboard/stats?${params}`);
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Visão geral do atendimento</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-36 bg-white/5 border-white/10 text-sm h-9" />
          <span className="text-slate-500 text-sm">até</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-36 bg-white/5 border-white/10 text-sm h-9" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map(kpi => {
          const Icon = kpi.icon;
          const raw = stats?.[kpi.key as keyof DashboardStats];
          const value = typeof raw === 'number' ? raw : 0;
          return (
            <div key={kpi.key} className={`glass-card rounded-xl p-5 border ${kpi.borderColor} bg-gradient-to-br ${kpi.color} transition-all duration-300 hover:scale-[1.02] cursor-default`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">
                {value.toLocaleString('pt-BR')}{kpi.suffix ?? ''}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Leads by Stage */}
        <div className="glass-card rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white mb-4">Leads por Etapa</h2>
          <div className="space-y-3">
            {stats?.leadsByStage.map(item => {
              const pct = stats.totalLeads > 0 ? (item.count / stats.totalLeads) * 100 : 0;
              return (
                <div key={item.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-slate-300">{item.stage}</span>
                    <Badge variant="secondary" className="bg-white/5 text-slate-300 text-xs">{item.count}</Badge>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full h-2 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!stats?.leadsByStage.length && (
              <p className="text-sm text-slate-500 text-center py-8">Sem dados no período</p>
            )}
          </div>
        </div>

        {/* Leads per Day */}
        <div className="glass-card rounded-xl p-5 border border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white mb-4">Leads por Dia</h2>
          <div className="flex items-end gap-1.5 h-44">
            {stats?.leadsPerDay.map(item => {
              const max = Math.max(...(stats.leadsPerDay.map(d => d.count)));
              const height = max > 0 ? (item.count / max) * 100 : 0;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</span>
                  <div
                    className="w-full bg-gradient-to-t from-indigo-500 to-purple-400 rounded-t opacity-80 hover:opacity-100 transition-all duration-200"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-[10px] text-slate-500">{item.date.slice(5)}</span>
                </div>
              );
            })}
            {(!stats?.leadsPerDay.length) && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-500">Sem dados no período</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
