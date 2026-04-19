'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Save, Loader2, MessageCircle, Play, AlertCircle,
  Bot, FileText, CalendarClock, Gauge, Activity, Check,
} from 'lucide-react';

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

const PREVIEW_VARS: Record<string, string> = {
  name: 'João',
  phone: '(11) 98765-4321',
  attempt: '1',
  maxAttempts: '3',
  vehicle: 'Toyota Hilux SRV 2022',
  city: 'São Paulo',
  creditStatus: 'aprovado',
};

const VARIABLE_TOKENS = [
  '{{name}}', '{{phone}}', '{{attempt}}', '{{maxAttempts}}',
  '{{vehicle}}', '{{city}}', '{{creditStatus}}',
] as const;

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function computeNextScan(now: Date, hour: number, minute: number, skipWeekends: boolean): Date {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  if (skipWeekends) {
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  }
  return next;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'agora';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `em ${days}d ${hours}h`;
  if (hours > 0) return `em ${hours}h ${mins}min`;
  return `em ${mins}min`;
}

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

function AttemptTimeline({ attempts, hoursBetween, exhaustedName }: { attempts: number; hoursBetween: number; exhaustedName: string }) {
  const dots = Array.from({ length: Math.max(1, Math.min(attempts, 10)) });
  return (
    <div className="bg-neutral-50 dark:bg-white/[0.02] rounded-lg p-4 border border-neutral-200 dark:border-white/[0.06]">
      <p className="text-[11px] uppercase tracking-wider text-neutral-400 mb-3">Como as tentativas serão enviadas</p>
      <div className="flex items-center flex-wrap gap-2">
        {dots.map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-red-600 dark:text-red-400">{i + 1}</span>
              </div>
              <span className="text-[10px] text-neutral-500 mt-1">tent.</span>
            </div>
            {i < dots.length - 1 && (
              <div className="flex flex-col items-center px-1">
                <div className="w-6 sm:w-10 h-px bg-neutral-300 dark:bg-white/10" />
                <span className="text-[10px] text-neutral-400 mt-1">{hoursBetween}h</span>
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-6 sm:w-10 h-px bg-neutral-300 dark:bg-white/10" />
          <div className="px-2 py-1 rounded-md bg-neutral-200 dark:bg-white/5 text-[10px] text-neutral-600 dark:text-neutral-400 font-medium">
            → {exhaustedName}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCard({ active, icon: Icon, title, description, onClick }: { active: boolean; icon: typeof Bot; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left p-4 rounded-xl border transition-all cursor-pointer ${
        active
          ? 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 ring-1 ring-red-400/40'
          : 'bg-neutral-50 dark:bg-white/[0.02] border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          active ? 'bg-red-100 dark:bg-red-500/20' : 'bg-neutral-100 dark:bg-white/5'
        }`}>
          <Icon className={`h-4 w-4 ${active ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`} />
        </div>
        {active && <Check className="h-4 w-4 text-red-600 dark:text-red-400" />}
      </div>
      <p className={`text-sm font-semibold mt-2 ${active ? 'text-red-700 dark:text-red-300' : 'text-neutral-900 dark:text-white'}`}>
        {title}
      </p>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
        {description}
      </p>
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
  const [now, setNow] = useState(() => new Date());

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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

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

  const nextScanText = useMemo(() => {
    if (!form) return '—';
    const next = computeNextScan(now, form.scanHour, form.scanMinute, form.skipWeekends);
    return formatCountdown(next.getTime() - now.getTime());
  }, [form, now]);

  const previewMessage = useMemo(() => {
    if (!form) return '';
    const tpl = form.customPromptTemplate?.trim() ? form.customPromptTemplate : DEFAULT_TEMPLATE;
    return interpolate(tpl, PREVIEW_VARS);
  }, [form]);

  if (isLoading || !form) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  const inputClass =
    'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 h-9 text-sm';

  const sectionCardClass = `bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm overflow-hidden ${
    !form.enabled ? 'opacity-60 pointer-events-none' : ''
  }`;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5 pb-24">
      {/* Header with inline master toggle */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white">Follow-up Automático</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {form.enabled
                ? 'Scans automáticos ativos segundo as regras abaixo'
                : 'Nenhum follow-up será enviado enquanto estiver desativado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${form.enabled ? 'text-green-600 dark:text-green-400' : 'text-neutral-500'}`}>
            {form.enabled ? 'Ativo' : 'Desativado'}
          </span>
          <Toggle checked={form.enabled} onChange={(v) => update('enabled', v)} />
        </div>
      </div>

      {/* Warning: no Follow-up stage */}
      {status && !status.active && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Nenhum estágio &quot;Follow-up&quot; encontrado no pipeline</p>
            <p className="text-xs opacity-80 mt-1">
              Crie um estágio chamado &quot;Follow-up&quot; no seu pipeline para ativar os follow-ups automáticos.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'No estágio', value: status?.totalLeads ?? 0, icon: Activity, color: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-white/5' },
          { label: 'Pendentes', value: status?.pendingFollowup ?? 0, icon: Gauge, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
          { label: 'Esgotados', value: status?.exhausted ?? 0, icon: AlertCircle, color: 'text-neutral-500 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-white/5' },
          { label: 'Próximo scan', value: form.enabled ? nextScanText : '—', icon: CalendarClock, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', isText: true },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white dark:bg-[#141414] rounded-xl p-3 sm:p-4 border border-neutral-200 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">{kpi.label}</span>
                <div className={`w-7 h-7 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0 ml-1`}>
                  <Icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                </div>
              </div>
              <p className={`font-bold text-neutral-900 dark:text-white ${kpi.isText ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>
                {kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rules card */}
      <div className={sectionCardClass}>
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <Gauge className="h-4 w-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Regras de Envio</h2>
        </div>

        <div className="p-5 space-y-6">
          {/* When */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-400 mb-3">Quando enviar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-500 dark:text-neutral-400">Hora do scan diário</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} max={23}
                    value={form.scanHour}
                    onChange={(e) => update('scanHour', Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                    className={`${inputClass} w-20 text-center`}
                  />
                  <span className="text-neutral-400 font-semibold">:</span>
                  <Input
                    type="number" min={0} max={59}
                    value={form.scanMinute}
                    onChange={(e) => update('scanMinute', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className={`${inputClass} w-20 text-center`}
                  />
                  <span className="text-xs text-neutral-400 ml-2">
                    ({String(form.scanHour).padStart(2, '0')}:{String(form.scanMinute).padStart(2, '0')})
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">Horário em que o sistema verifica e envia follow-ups pendentes</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-500 dark:text-neutral-400">Finais de semana</Label>
                <div className="flex items-center gap-3 h-9">
                  <Toggle checked={form.skipWeekends} onChange={(v) => update('skipWeekends', v)} />
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                    {form.skipWeekends ? 'Pular sábado e domingo' : 'Enviar todos os dias'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-400 mb-3">Limites</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-500 dark:text-neutral-400">Máximo de tentativas</Label>
                <Input
                  type="number" min={1} max={20}
                  value={form.maxAttempts}
                  onChange={(e) => update('maxAttempts', Math.max(1, parseInt(e.target.value) || 1))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-500 dark:text-neutral-400">Horas mínimas entre tentativas</Label>
                <Input
                  type="number" min={1} max={720}
                  value={form.minHoursBetween}
                  onChange={(e) => update('minHoursBetween', Math.max(1, parseInt(e.target.value) || 1))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-500 dark:text-neutral-400">Estágio ao esgotar tentativas</Label>
                <Input
                  type="text"
                  value={form.exhaustedStageName}
                  onChange={(e) => update('exhaustedStageName', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="mt-4">
              <AttemptTimeline
                attempts={form.maxAttempts}
                hoursBetween={form.minHoursBetween}
                exhaustedName={form.exhaustedStageName}
              />
            </div>
          </div>

          {/* Behavior */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-400 mb-3">Comportamento</p>
            <div className="flex items-center justify-between gap-4 bg-neutral-50 dark:bg-white/[0.02] rounded-lg p-4 border border-neutral-200 dark:border-white/[0.06]">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">Parar se o lead responder</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {form.skipIfLeadResponded
                    ? 'Quando o lead mandar qualquer mensagem, os próximos follow-ups são cancelados'
                    : 'Envia os follow-ups mesmo se o lead já tiver respondido'}
                </p>
              </div>
              <Toggle checked={form.skipIfLeadResponded} onChange={(v) => update('skipIfLeadResponded', v)} />
            </div>
          </div>
        </div>
      </div>

      {/* Message card */}
      <div className={sectionCardClass}>
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Mensagem</h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode selector */}
          <div className="flex flex-col sm:flex-row gap-3">
            <ModeCard
              active={form.useAgentPrompt}
              icon={Bot}
              title="Agente IA"
              description="A IA gera uma mensagem personalizada para cada lead baseada no histórico da conversa"
              onClick={() => update('useAgentPrompt', true)}
            />
            <ModeCard
              active={!form.useAgentPrompt}
              icon={FileText}
              title="Template fixo"
              description="Envia exatamente o texto escrito abaixo, substituindo as variáveis. Sem IA"
              onClick={() => update('useAgentPrompt', false)}
            />
          </div>

          {/* Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400">
                {form.useAgentPrompt ? 'Instruções extras para a IA (opcional)' : 'Texto da mensagem'}
              </Label>
              {!form.useAgentPrompt && (
                <button
                  onClick={() => update('customPromptTemplate', DEFAULT_TEMPLATE)}
                  className="text-[11px] text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  Restaurar template padrão
                </button>
              )}
            </div>
            <Textarea
              value={form.customPromptTemplate ?? ''}
              onChange={(e) => update('customPromptTemplate', e.target.value)}
              placeholder={form.useAgentPrompt
                ? 'Deixe vazio para usar o prompt padrão do agente.\nExemplo: Seja ainda mais direto, pergunte se o lead prefere ligação.'
                : DEFAULT_TEMPLATE}
              className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 text-sm min-h-[160px] font-mono text-xs leading-relaxed resize-y"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 mr-1">Variáveis (clique pra inserir):</span>
              {VARIABLE_TOKENS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update('customPromptTemplate', (form.customPromptTemplate ?? '') + v)}
                  className="text-[11px] bg-neutral-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-0.5 rounded cursor-pointer transition-colors font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-400 mb-2">Pré-visualização</p>
            {form.useAgentPrompt ? (
              <div className="bg-neutral-50 dark:bg-white/[0.02] rounded-lg p-4 border border-dashed border-neutral-300 dark:border-white/10 flex items-start gap-3">
                <Bot className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  No modo <strong>Agente IA</strong>, a mensagem é gerada dinamicamente no momento do envio com base no perfil do lead e na conversa anterior. Por isso não dá para mostrar um preview fixo aqui.
                </p>
              </div>
            ) : (
              <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-lg p-4 border border-neutral-200 dark:border-white/[0.06]">
                <div className="max-w-[85%] bg-[#dcf8c6] dark:bg-[#005c4b] rounded-xl rounded-br-sm px-3 py-2 shadow-sm">
                  <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                    {previewMessage.trim() || <span className="italic text-neutral-500">mensagem vazia…</span>}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-neutral-600 dark:text-white/60">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Check className="h-3 w-3 text-neutral-600 dark:text-white/60" />
                    <Check className="h-3 w-3 -ml-2 text-neutral-600 dark:text-white/60" />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-500 mt-2 italic">
                  Exemplo com dados fictícios do lead &quot;João&quot;.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {saveError && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <p className="font-medium">Erro</p>
          <p className="text-xs mt-1 opacity-80">{saveError}</p>
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md bg-white/95 dark:bg-[#0f0f0f]/95 backdrop-blur border border-neutral-200 dark:border-white/[0.06] rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-between shadow-xl z-10">
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
          {savedAt && Date.now() - savedAt < 3000 ? (
            <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Configurações salvas
            </span>
          ) : (
            'Alterações não salvas'
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={triggerScan}
            disabled={triggering || !form.enabled}
            className="cursor-pointer text-sm h-9 flex-1 sm:flex-none"
          >
            {triggering ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Disparar agora
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer text-sm h-9 flex-1 sm:flex-none"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
