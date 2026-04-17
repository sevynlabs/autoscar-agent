'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Trash2, Plus, Settings, Layers, Filter } from 'lucide-react';

interface Stage { id: string; name: string; order: number; }
interface Pipeline { id: string; name: string; stages: Stage[]; }
interface QualificationRule { id: string; pipelineId: string; field: string; operator: string; value: string; stageTrigger: string; }

export default function PipelineSettingsPage() {
  const queryClient = useQueryClient();
  const [newStageName, setNewStageName] = useState('');
  const [ruleForm, setRuleForm] = useState({ field: '', operator: '', value: '', stageTrigger: '' });

  const { data: pipelines } = useQuery<Pipeline[]>({ queryKey: ['pipelines'], queryFn: () => api.get('/pipelines') });
  const pipeline = pipelines?.[0];
  const { data: rules } = useQuery<QualificationRule[]>({
    queryKey: ['rules', pipeline?.id],
    queryFn: () => api.get(`/pipelines/${pipeline!.id}/rules`),
    enabled: !!pipeline,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    if (pipeline) queryClient.invalidateQueries({ queryKey: ['rules', pipeline.id] });
  };

  const addStage = async () => { if (!newStageName.trim() || !pipeline) return; await api.post(`/pipelines/${pipeline.id}/stages`, { name: newStageName }); setNewStageName(''); invalidate(); };
  const deleteStage = async (stageId: string) => { if (!pipeline || !confirm('Excluir esta etapa?')) return; await api.delete(`/pipelines/${pipeline.id}/stages/${stageId}`); invalidate(); };
  const reorderStage = async (stage: Stage, direction: 'up' | 'down') => {
    if (!pipeline) return;
    const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);
    const idx = stages.findIndex(s => s.id === stage.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stages.length) return;
    await api.patch(`/pipelines/${pipeline.id}/stages/${stage.id}`, { order: stages[swapIdx].order });
    await api.patch(`/pipelines/${pipeline.id}/stages/${stages[swapIdx].id}`, { order: stage.order });
    invalidate();
  };
  const renameStage = async (stageId: string, name: string) => { if (!pipeline) return; await api.patch(`/pipelines/${pipeline.id}/stages/${stageId}`, { name }); invalidate(); };
  const addRule = async () => {
    if (!pipeline || !ruleForm.field || !ruleForm.operator || !ruleForm.value || !ruleForm.stageTrigger) return;
    await api.post(`/pipelines/${pipeline.id}/rules`, ruleForm);
    setRuleForm({ field: '', operator: '', value: '', stageTrigger: '' });
    invalidate();
  };
  const deleteRule = async (ruleId: string) => { if (!pipeline) return; await api.delete(`/pipelines/${pipeline.id}/rules/${ruleId}`); invalidate(); };

  const sortedStages = pipeline ? [...pipeline.stages].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-900 dark:text-white">Pipeline</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Configure etapas e regras de qualificação</p>
        </div>
      </div>

      {/* Stages */}
      <div className="glass-card rounded-xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <Layers className="h-4 w-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-900 dark:text-white">Etapas do Pipeline</h2>
          <Badge className="ml-auto bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/20 text-xs">{sortedStages.length}</Badge>
        </div>
        <div className="p-4 space-y-2">
          {sortedStages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2 group">
              <span className="w-7 h-7 rounded-lg bg-neutral-50 dark:bg-white/5 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400 font-mono">{idx + 1}</span>
              <Input
                defaultValue={stage.name}
                className="flex-1 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 h-9 text-sm"
                onBlur={e => { if (e.target.value !== stage.name) renameStage(stage.id, e.target.value); }}
              />
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" onClick={() => reorderStage(stage, 'up')} disabled={idx === 0} className="h-7 w-7 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:text-white cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => reorderStage(stage, 'down')} disabled={idx === sortedStages.length - 1} className="h-7 w-7 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:text-white cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => deleteStage(stage.id)} className="h-7 w-7 text-neutral-400 dark:text-neutral-500 hover:text-red-400 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-white/[0.06]">
            <Input placeholder="Nome da nova etapa" value={newStageName} onChange={e => setNewStageName(e.target.value)} className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-9 text-sm" />
            <Button onClick={addStage} size="sm" className="bg-red-600 hover:bg-red-500 cursor-pointer h-9 px-4">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="glass-card rounded-xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
          <Filter className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-900 dark:text-white">Regras de Qualificação</h2>
          <Badge className="ml-auto bg-red-500/10 text-red-300 border-red-500/20 text-xs">{rules?.length ?? 0}</Badge>
        </div>
        <div className="p-4 space-y-2">
          {rules?.map(rule => (
            <div key={rule.id} className="flex items-center justify-between glass rounded-lg px-4 py-3 group">
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                <span className="text-red-600 dark:text-red-300 font-medium">{rule.field}</span>
                <span className="text-neutral-400 dark:text-neutral-500 mx-1.5">{rule.operator}</span>
                <span className="text-neutral-900 dark:text-white font-medium">{rule.value}</span>
                <span className="text-neutral-400 dark:text-neutral-500 mx-1.5">→</span>
                <Badge className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/20 text-xs">
                  {sortedStages.find(s => s.id === rule.stageTrigger)?.name || rule.stageTrigger}
                </Badge>
              </span>
              <Button size="icon" variant="ghost" onClick={() => deleteRule(rule.id)} className="h-7 w-7 text-neutral-400 dark:text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!rules?.length && <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">Nenhuma regra configurada</p>}

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-white/[0.06]">
            <Select value={ruleForm.field} onValueChange={v => setRuleForm(f => ({ ...f, field: v ?? f.field }))}>
              <SelectTrigger className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-9 text-sm"><SelectValue placeholder="Campo" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
                <SelectItem value="creditStatus">Status de Crédito</SelectItem>
                <SelectItem value="city">Cidade</SelectItem>
                <SelectItem value="paymentMethod">Forma de Pagamento</SelectItem>
                <SelectItem value="interest">Interesse</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ruleForm.operator} onValueChange={v => setRuleForm(f => ({ ...f, operator: v ?? f.operator }))}>
              <SelectTrigger className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-9 text-sm"><SelectValue placeholder="Operador" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
                <SelectItem value="equals">igual a</SelectItem>
                <SelectItem value="contains">contém</SelectItem>
                <SelectItem value="not_equals">diferente de</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Valor" value={ruleForm.value} onChange={e => setRuleForm(f => ({ ...f, value: e.target.value }))} className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-9 text-sm" />
            <Select value={ruleForm.stageTrigger} onValueChange={v => setRuleForm(f => ({ ...f, stageTrigger: v ?? f.stageTrigger }))}>
              <SelectTrigger className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-9 text-sm"><SelectValue placeholder="Mover para" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
                {sortedStages.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRule} className="w-full mt-2 bg-red-700 hover:bg-red-500 cursor-pointer h-9 text-sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar regra
          </Button>
        </div>
      </div>
    </div>
  );
}
