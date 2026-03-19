'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  order: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

interface QualificationRule {
  id: string;
  pipelineId: string;
  field: string;
  operator: string;
  value: string;
  stageTrigger: string;
}

export default function PipelineSettingsPage() {
  const queryClient = useQueryClient();
  const [newStageName, setNewStageName] = useState('');
  const [ruleForm, setRuleForm] = useState({ field: '', operator: '', value: '', stageTrigger: '' });

  const { data: pipelines } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines'),
  });

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

  const addStage = async () => {
    if (!newStageName.trim() || !pipeline) return;
    await api.post(`/pipelines/${pipeline.id}/stages`, { name: newStageName });
    setNewStageName('');
    invalidate();
  };

  const deleteStage = async (stageId: string) => {
    if (!pipeline || !confirm('Excluir esta etapa? Leads serão desvinculados.')) return;
    await api.delete(`/pipelines/${pipeline.id}/stages/${stageId}`);
    invalidate();
  };

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

  const renameStage = async (stageId: string, name: string) => {
    if (!pipeline) return;
    await api.patch(`/pipelines/${pipeline.id}/stages/${stageId}`, { name });
    invalidate();
  };

  const addRule = async () => {
    if (!pipeline || !ruleForm.field || !ruleForm.operator || !ruleForm.value || !ruleForm.stageTrigger) return;
    await api.post(`/pipelines/${pipeline.id}/rules`, ruleForm);
    setRuleForm({ field: '', operator: '', value: '', stageTrigger: '' });
    invalidate();
  };

  const deleteRule = async (ruleId: string) => {
    if (!pipeline) return;
    await api.delete(`/pipelines/${pipeline.id}/rules/${ruleId}`);
    invalidate();
  };

  const sortedStages = pipeline ? [...pipeline.stages].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Configurações do Pipeline</h1>

      {/* Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Etapas do Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedStages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2">
              <Badge variant="outline" className="w-8 justify-center">{idx + 1}</Badge>
              <Input
                defaultValue={stage.name}
                className="flex-1"
                onBlur={e => {
                  if (e.target.value !== stage.name) renameStage(stage.id, e.target.value);
                }}
              />
              <Button size="icon" variant="ghost" onClick={() => reorderStage(stage, 'up')} disabled={idx === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => reorderStage(stage, 'down')} disabled={idx === sortedStages.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteStage(stage.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <Input
              placeholder="Nome da nova etapa"
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
            />
            <Button onClick={addStage}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Qualification Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Regras de Qualificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules?.map(rule => (
            <div key={rule.id} className="flex items-center justify-between border rounded-lg p-3">
              <span className="text-sm">
                <strong>{rule.field}</strong> {rule.operator} <em>{rule.value}</em> → mover para{' '}
                <Badge variant="secondary">
                  {sortedStages.find(s => s.id === rule.stageTrigger)?.name || rule.stageTrigger}
                </Badge>
              </span>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRule(rule.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2 mt-3">
            <Select value={ruleForm.field} onValueChange={v => setRuleForm(f => ({ ...f, field: v ?? f.field }))}>
              <SelectTrigger><SelectValue placeholder="Campo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="creditStatus">Status de Crédito</SelectItem>
                <SelectItem value="city">Cidade</SelectItem>
                <SelectItem value="paymentMethod">Forma de Pagamento</SelectItem>
                <SelectItem value="interest">Interesse</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ruleForm.operator} onValueChange={v => setRuleForm(f => ({ ...f, operator: v ?? f.operator }))}>
              <SelectTrigger><SelectValue placeholder="Operador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">igual a</SelectItem>
                <SelectItem value="contains">contém</SelectItem>
                <SelectItem value="not_equals">diferente de</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Valor"
              value={ruleForm.value}
              onChange={e => setRuleForm(f => ({ ...f, value: e.target.value }))}
            />
            <Select value={ruleForm.stageTrigger} onValueChange={v => setRuleForm(f => ({ ...f, stageTrigger: v ?? f.stageTrigger }))}>
              <SelectTrigger><SelectValue placeholder="Mover para etapa" /></SelectTrigger>
              <SelectContent>
                {sortedStages.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRule} className="w-full mt-2">
            <Plus className="h-4 w-4 mr-1" /> Adicionar regra
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
