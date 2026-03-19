'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Bot, Brain, MessageSquare, Users, Target, Zap, Globe, Settings2 } from 'lucide-react';

interface AgentConfig {
  model: string;
  sellersGroupJid: string;
  maxFollowups: number;
  followupDelayHours: number;
  portalUrl: string;
  agentName: string;
  qualificationFields: string[];
}

interface AgentStats {
  totalConversations: number;
  totalMessages: number;
  agentMessages: number;
  totalLeads: number;
  qualifiedLeads: number;
  avgMessagesPerConversation: number;
}

export default function AgentSettingsPage() {
  const { data: config } = useQuery<AgentConfig>({
    queryKey: ['agent-config'],
    queryFn: () => api.get('/agent/config'),
  });

  const { data: stats } = useQuery<AgentStats>({
    queryKey: ['agent-stats'],
    queryFn: () => api.get('/agent/stats'),
  });

  const fieldLabels: Record<string, string> = {
    interest: 'Interesse no veículo',
    creditStatus: 'Status de crédito',
    city: 'Cidade',
    paymentMethod: 'Forma de pagamento',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Agente IA</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Configuração e performance do SDR</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Conversas', value: stats?.totalConversations ?? 0, icon: MessageSquare, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
          { label: 'Leads Criados', value: stats?.totalLeads ?? 0, icon: Users, color: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-white/5' },
          { label: 'Qualificados', value: stats?.qualifiedLeads ?? 0, icon: Target, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white dark:bg-[#141414] rounded-xl p-5 border border-neutral-200 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Config */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-red-600 dark:text-red-400" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Configuração</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Modelo IA</span>
              <Badge className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20">{config?.model ?? 'gpt-4o'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Nome do Agente</span>
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{config?.agentName ?? 'Autoscar IA'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Portal</span>
              <span className="text-sm text-neutral-800 dark:text-neutral-200">{config?.portalUrl}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Follow-ups</span>
              <span className="text-sm text-neutral-800 dark:text-neutral-200">{config?.maxFollowups}x a cada {config?.followupDelayHours}h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Grupo Vendedores</span>
              <Badge className={config?.sellersGroupJid
                ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20'
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 border-neutral-200 dark:border-white/10'
              }>{config?.sellersGroupJid ? 'Configurado' : 'Não configurado'}</Badge>
            </div>
          </div>
        </div>

        {/* Qualification Flow */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
            <Brain className="h-4 w-4 text-red-600 dark:text-red-400" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Fluxo de Qualificação</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="space-y-2">
              {[
                { step: 1, icon: Globe, label: 'Identifica veículo de interesse', desc: 'Pela mensagem ou URL do anúncio' },
                { step: 2, icon: Zap, label: 'Busca dados no portal', desc: 'Web scraping do autoscar.com.br' },
                { step: 3, icon: MessageSquare, label: 'Envia fotos do veículo', desc: 'Carrossel com até 5 fotos' },
                { step: 4, icon: Brain, label: 'Qualifica o lead', desc: 'Coleta interesse, crédito, cidade, pagamento' },
                { step: 5, icon: Target, label: 'Notifica vendedores', desc: 'Resumo enviado no grupo WhatsApp' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-red-600 dark:text-red-400">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.label}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-white/[0.06]">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Campos de qualificação:</p>
              <div className="flex flex-wrap gap-1.5">
                {config?.qualificationFields.map(field => (
                  <Badge key={field} className="bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-white/10 text-xs">
                    {fieldLabels[field] ?? field}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <Zap className="h-4 w-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Performance</h2>
        </div>
        <div className="p-5 grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Msgs Totais</p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats?.totalMessages ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Msgs do Agente</p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats?.agentMessages ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Média Msgs/Conversa</p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats?.avgMessagesPerConversation ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
