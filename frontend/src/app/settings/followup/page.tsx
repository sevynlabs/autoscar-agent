'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Clock, Sparkles, MessageCircle, Power, PowerOff, Play, AlertCircle } from 'lucide-react';

interface FollowupConfig {
  id: string;
  enabled: boolean;
  maxAttempts: number;
  minHoursBetween: number;
  scanHour: number;
  scanMinute: number;
  skipWeekends: boolean;
  skipIfLeadResponded: boolean;
  useAgentPrompt: boolean;
  customPromptTemplate: string | null;
  exhaustedStageName: string;
}

interface FollowupStatus {
  active: boolean;
  enabled: boolean;
  totalLeads?: number;
  pendingFollowup?: number;
  exhausted?: number;
  maxAttempts?: number;
  schedule?: string;
  cron?: string;
  message?: string;
}

const DEFAULT_TEMPLATE = `Oi {{name}}! Tudo bem?

Notei que ainda não conseguimos conversar sobre o veículo que você se interessou.
{{vehicle}}

Ainda tem interesse? Posso te ajudar com mais informações.`;

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
        checked ? 'bg-red-600' : 'bg-neutral-300 dark:bg-white/10'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function FollowupSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FollowupConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [triggering, setTriggering] = useState(false);

  const { data: config, isLoading } = useQuery<FollowupConfig>({
    queryKey: ['followup-config'],
    queryFn: () => api.get('/followup-config'),
  });

  const { data: status } = useQuery<FollowupStatus>({
    queryKey: ['followup-status'],
    queryFn: () => api.get('/followup-workflow/status'),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (config && !form) setForm(config);
  }, [config, form]);

  const update = <K extends keyof FollowupConfig>(key: K, value: FollowupConfig[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        enabled: form.enabled,
        maxAttempts: form.maxAttempts,
        minHoursBetween: form.minHoursBetween,
        scanHour: form.scanHour,
        scanMinute: form.scanMinute,
        skipWeekends: form.skipWeekends,
        skipIfLeadResponded: form.skipIfLeadResponded,
        useAgentPrompt: form.useAgentPrompt,
        customPromptTemplate: form.customPromptTemplate?.trim() ? form.customPromptTemplate : null,
        exhaustedStageName: form.exhaustedStageName,
      };
      const updated = await api.patch<FollowupConfig>('/followup-config', payload);
      setForm(updated);
      queryClient.invalidateQueries({ queryKey: ['followup-config'] });
      queryClient.invalidateQueries({ queryKey: ['followup-status'] });
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  const triggerScan = async () => {
    setTriggering(true);
    try {
      await api.post('/followup-workflow/trigger');
      queryClient.invalidateQueries({ queryKey: ['followup-status'] });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao disparar scan');
    } finally {
      setTriggering(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  const inputClass =
    'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 h-9 text-sm';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Follow-up Automático</h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Ative, desative e personalize as regras de follow-up
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              form.enabled
                ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20'
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 border-neutral-200 dark:border-white/10'
            }
          >
            {form.enabled ? 'Ativo' : 'Desativado'}
          </Badge>
        </div>
      </div>

      {/* Master toggle card */}
      <div
        className={`rounded-xl border shadow-sm overflow-hidden ${
          form.enabled
            ? 'bg-white dark:bg-[#141414] border-neutral-200 dark:border-white/[0.06]'
            : 'bg-neutral-50 dark:bg-[#0f0f0f] border-neutral-200 dark:border-white/[0.04]'
        }`}
      >
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
                form.enabled ? 'bg-green-50 dark:bg-green-500/10' : 'bg-neutral-100 dark:bg-white/5'
              }`}
            >
              {form.enabled ? (
                <Power className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <PowerOff className="h-4 w-4 text-neutral-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Sistema de Follow-up</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {form.enabled
                  ? 'Scans automáticos estão ativos segundo as regras abaixo'
                  : 'Nenhum follow-up será enviado enquanto estiver desativado'}
              </p>
            </div>
          </div>
          <Toggle checked={form.enabled} onChange={(v) => update('enabled', v)} />
        </div>
      </div>

      {/* Status card */}
      {status && status.active && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'No estágio', value: status.totalLeads ?? 0 },
            { label: 'Pendentes', value: status.pendingFollowup ?? 0 },
            { label: 'Esgotados', value: status.exhausted ?? 0 },
            { label: 'Horário', value: status.schedule ?? '—', small: true },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white dark:bg-[#141414] rounded-xl p-3 border border-neutral-200 dark:border-white/[0.06]"
            >
              <p className="text-[10px] uppercase tracking-wider text-neutral-400">{kpi.label}</p>
              <p
                className={`font-bold text-neutral-900 dark:text-white mt-1 ${
                  kpi.small ? 'text-sm' : 'text-xl'
                }`}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {status && !status.active && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Nenhum estágio &quot;Follow-up&quot; encontrado</p>
            <p className="text-xs opacity-80 mt-1">
              Crie um estágio chamado &quot;Follow-up&quot; no seu pipeline para ativar os follow-ups automáticos.
            </p>
          </div>
        </div>
      )}

      {/* Rules card */}
      <div
        className={`bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden ${
          !form.enabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Regras</h2>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400">Máximo de tentativas</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.maxAttempts}
                onChange={(e) => update('maxAttempts', Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
              />
              <p className="text-[11px] text-neutral-400">Após esse total, o lead vai para {form.exhaustedStageName}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400">Horas mínimas entre tentativas</Label>
              <Input
                type="number"
                min={1}
                max={720}
                value={form.minHoursBetween}
                onChange={(e) => update('minHoursBetween', Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
              />
              <p className="text-[11px] text-neutral-400">Evita follow-ups consecutivos muito próximos</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400">Estágio ao esgotar tentativas</Label>
              <Input
                type="text"
                value={form.exhaustedStageName}
                onChange={(e) => update('exhaustedStageName', e.target.value)}
                className={inputClass}
              />
              <p className="text-[11px] text-neutral-400">Nome do estágio final (ex: Desqualificado)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400">Hora do scan diário</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.scanHour}
                  onChange={(e) => update('scanHour', Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                  className={inputClass}
                />
                <span className="text-neutral-400">:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={form.scanMinute}
                  onChange={(e) => update('scanMinute', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className={inputClass}
                />
              </div>
              <p className="text-[11px] text-neutral-400">Horário em que o scan diário é executado</p>
            </div>

            <div className="space-y-1.5 flex flex-col justify-between">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400">Pular finais de semana</Label>
              <div className="flex items-center gap-3 h-9">
                <Toggle checked={form.skipWeekends} onChange={(v) => update('skipWeekends', v)} />
                <span className="text-xs text-neutral-500">
                  {form.skipWeekends ? 'Apenas dias úteis (seg–sex)' : 'Todos os dias'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col justify-between">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400">Parar se o lead responder</Label>
              <div className="flex items-center gap-3 h-9">
                <Toggle
                  checked={form.skipIfLeadResponded}
                  onChange={(v) => update('skipIfLeadResponded', v)}
                />
                <span className="text-xs text-neutral-500">
                  {form.skipIfLeadResponded ? 'Não envia se respondeu' : 'Envia mesmo após resposta'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message card */}
      <div
        className={`bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden ${
          !form.enabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Mensagem de Follow-up</h2>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-start gap-4 flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">Usar Agente IA</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md">
                Quando ativado, a IA gera mensagens personalizadas para cada lead.
                Desative para enviar o template literal (sem IA).
              </p>
            </div>
            <Toggle checked={form.useAgentPrompt} onChange={(v) => update('useAgentPrompt', v)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-neutral-500 dark:text-neutral-400">
              {form.useAgentPrompt ? 'Instruções customizadas para a IA (opcional)' : 'Template da mensagem'}
            </Label>
            <Textarea
              value={form.customPromptTemplate ?? ''}
              onChange={(e) => update('customPromptTemplate', e.target.value)}
              placeholder={form.useAgentPrompt ? 'Deixe vazio para usar o prompt padrão do sistema' : DEFAULT_TEMPLATE}
              className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 text-sm min-h-[160px] font-mono text-xs leading-relaxed resize-y"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <p className="text-[11px] text-neutral-400 w-full mb-1">Variáveis disponíveis:</p>
              {['{{name}}', '{{phone}}', '{{attempt}}', '{{maxAttempts}}', '{{vehicle}}', '{{city}}', '{{creditStatus}}'].map((v) => (
                <code
                  key={v}
                  onClick={() => update('customPromptTemplate', (form.customPromptTemplate ?? '') + v)}
                  className="text-[11px] bg-neutral-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  {v}
                </code>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save + trigger */}
      {saveError && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <p className="font-medium">Erro</p>
          <p className="text-xs mt-1 opacity-80">{saveError}</p>
        </div>
      )}

      <div className="sticky bottom-4 bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur border border-neutral-200 dark:border-white/[0.06] rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-between shadow-lg">
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {savedAt && Date.now() - savedAt < 3000 ? (
            <span className="text-green-600 dark:text-green-400 font-medium">Configurações salvas.</span>
          ) : (
            'Clique em salvar para aplicar as alterações'
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={triggerScan}
            disabled={triggering || !form.enabled}
            className="cursor-pointer text-sm h-9"
          >
            {triggering ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Disparar scan agora
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer text-sm h-9"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
