'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  totalLeads: number;
  qualifiedCount: number;
  conversionRate: number;
  avgMessagesPerLead: number;
  leadsByStage: { stage: string; count: number }[];
  leadsPerDay: { date: string; count: number }[];
}

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de Leads</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats?.totalLeads ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Qualificados</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats?.qualifiedCount ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa de Conversão</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats?.conversionRate ?? 0}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Msgs/Lead (IA)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats?.avgMessagesPerLead ?? 0}</p></CardContent>
        </Card>
      </div>

      {/* Leads by Stage */}
      <Card>
        <CardHeader><CardTitle>Leads por Etapa</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats?.leadsByStage.map(item => (
              <div key={item.stage} className="flex items-center justify-between">
                <span className="text-sm">{item.stage}</span>
                <div className="flex items-center gap-2">
                  <div className="w-48 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2"
                      style={{ width: `${stats.totalLeads > 0 ? (item.count / stats.totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leads per Day */}
      <Card>
        <CardHeader><CardTitle>Leads por Dia</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {stats?.leadsPerDay.map(item => {
              const max = Math.max(...(stats.leadsPerDay.map(d => d.count)));
              const height = max > 0 ? (item.count / max) * 100 : 0;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs">{item.count}</span>
                  <div className="w-full bg-primary rounded-t" style={{ height: `${height}%` }} />
                  <span className="text-xs text-muted-foreground rotate-45">{item.date.slice(5)}</span>
                </div>
              );
            })}
            {(!stats?.leadsPerDay.length) && (
              <p className="text-muted-foreground text-sm">Sem dados no período</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
