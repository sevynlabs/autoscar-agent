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
  { key: 'totalLeads', label: 'Total de Leads', icon: Users, iconBg: 'bg-red-50 dark:bg-red-500/10', iconColor: 'text-red-600 dark:text-red-400', borderColor: 'border-neutral-200 dark:border-white/[0.06]' },
  { key: 'qualifiedCount', label: 'Qualificados', icon: Target, iconBg: 'bg-green-50 dark:bg-green-500/10', iconColor: 'text-green-600 dark:text-green-400', borderColor: 'border-neutral-200 dark:border-white/[0.06]' },
  { key: 'conversionRate', label: 'Taxa de Conversão', icon: TrendingUp, iconBg: 'bg-red-50 dark:bg-red-500/10', iconColor: 'text-red-600 dark:text-red-400', borderColor: 'border-neutral-200 dark:border-white/[0.06]', suffix: '%' },
  { key: 'avgMessagesPerLead', label: 'Msgs/Lead (IA)', icon: MessageSquare, iconBg: 'bg-neutral-100 dark:bg-white/5', iconColor: 'text-neutral-600 dark:text-neutral-400', borderColor: 'border-neutral-200 dark:border-white/[0.06]' },
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">Dashboard</h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1">Visão geral do atendimento</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="flex-1 sm:flex-none sm:w-36 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-sm h-9" />
          <span className="text-neutral-400 dark:text-neutral-500 text-xs sm:text-sm">até</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="flex-1 sm:flex-none sm:w-36 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-sm h-9" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpiCards.map(kpi => {
          const Icon = kpi.icon;
          const raw = stats?.[kpi.key as keyof DashboardStats];
          const value = typeof raw === 'number' ? raw : 0;
          return (
            <div key={kpi.key} className={`bg-white dark:bg-[#141414] rounded-xl p-4 sm:p-5 border ${kpi.borderColor} transition-all duration-300 hover:scale-[1.02] cursor-default shadow-sm`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">{kpi.label}</span>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0 ml-2`}>
                  <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${kpi.iconColor}`} />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white">
                {value.toLocaleString('pt-BR')}{kpi.suffix ?? ''}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Leads by Stage */}
        <div className="glass-card rounded-xl p-4 sm:p-5 border border-neutral-200 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Leads por Etapa</h2>
          <div className="space-y-3">
            {stats?.leadsByStage.map(item => {
              const pct = stats.totalLeads > 0 ? (item.count / stats.totalLeads) * 100 : 0;
              return (
                <div key={item.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.stage}</span>
                    <Badge variant="secondary" className="bg-neutral-50 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 text-xs">{item.count}</Badge>
                  </div>
                  <div className="w-full bg-neutral-50 dark:bg-white/5 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-red-500 to-red-600 rounded-full h-2 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!stats?.leadsByStage.length && (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">Sem dados no período</p>
            )}
          </div>
        </div>

        {/* Leads per Day */}
        <div className="glass-card rounded-xl p-4 sm:p-5 border border-neutral-200 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Leads por Dia</h2>
          <div className="flex items-end gap-1.5 h-44">
            {stats?.leadsPerDay.map(item => {
              const max = Math.max(...(stats.leadsPerDay.map(d => d.count)));
              const height = max > 0 ? (item.count / max) * 100 : 0;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</span>
                  <div
                    className="w-full bg-gradient-to-t from-red-500 to-red-600 rounded-t opacity-80 hover:opacity-100 transition-all duration-200"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{item.date.slice(5)}</span>
                </div>
              );
            })}
            {(!stats?.leadsPerDay.length) && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-neutral-400 dark:text-neutral-500">Sem dados no período</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
