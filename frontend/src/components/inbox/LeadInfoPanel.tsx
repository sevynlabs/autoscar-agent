'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Phone, MapPin, CreditCard, Car, Calendar, Tag, FileText, Bot, Shield, ExternalLink, Save, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface LeadDetail {
  id: string;
  phone: string;
  name: string | null;
  city: string | null;
  creditStatus: string | null;
  paymentMethod: string | null;
  vehicleUrl: string | null;
  humanOverride: boolean;
  followupAttempts: number;
  lastFollowupAt: string | null;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string } | null;
  pipeline: { id: string; name: string } | null;
  notes: { id: string; content: string; type: string; createdAt: string }[];
}

interface LeadInfoPanelProps {
  leadId: string | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function LeadInfoPanel({ leadId }: LeadInfoPanelProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', creditStatus: '', paymentMethod: '' });

  const { data: lead, isLoading } = useQuery<LeadDetail>({
    queryKey: ['lead-detail', leadId],
    queryFn: () => api.get(`/leads/${leadId}/detail`),
    enabled: !!leadId,
  });

  if (!leadId) {
    return (
      <div className="w-full lg:w-80 lg:border-l border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.01] flex items-center justify-center">
        <p className="text-xs text-neutral-400">Selecione uma conversa</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full lg:w-80 lg:border-l border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.01] p-4 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }

  if (!lead) return null;

  const startEdit = () => {
    setForm({
      name: lead.name ?? '',
      city: lead.city ?? '',
      creditStatus: lead.creditStatus ?? '',
      paymentMethod: lead.paymentMethod ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/leads/${lead.id}`, form);
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const creditColor = (status: string | null) => {
    if (!status) return 'bg-neutral-100 dark:bg-white/5 text-neutral-500';
    if (status.toLowerCase().includes('aprovado')) return 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20';
    if (status.toLowerCase().includes('reprovado')) return 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
    return 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
  };

  const inputClass = "bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-8 text-xs";

  return (
    <div className="w-full lg:w-80 lg:border-l border-neutral-200 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.01] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <User className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{lead.name || 'Sem nome'}</p>
            <p className="text-xs text-neutral-400 font-mono">{lead.phone}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {lead.stage && (
            <Badge className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20 text-[10px]">
              <Tag className="h-3 w-3 mr-1" />{lead.stage.name}
            </Badge>
          )}
          {lead.humanOverride && (
            <Badge className="bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20 text-[10px]">
              <Shield className="h-3 w-3 mr-1" />Humano
            </Badge>
          )}
          <Badge className="bg-neutral-100 dark:bg-white/5 text-neutral-500 border-neutral-200 dark:border-white/10 text-[10px]">
            <Calendar className="h-3 w-3 mr-1" />{timeAgo(lead.createdAt)}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Lead Data */}
          {!editing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Dados do Lead</h3>
                <Button size="sm" variant="ghost" onClick={startEdit} className="h-6 text-[10px] cursor-pointer text-red-600 dark:text-red-400">Editar</Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06]">
                  <User className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-neutral-400">Nome</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200 truncate">{lead.name || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06]">
                  <MapPin className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-neutral-400">Cidade</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200">{lead.city || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06]">
                  <CreditCard className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-neutral-400">Crédito</p>
                    <Badge className={`text-[10px] ${creditColor(lead.creditStatus)}`}>{lead.creditStatus || '—'}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06]">
                  <CreditCard className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-neutral-400">Pagamento</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200">{lead.paymentMethod || '—'}</p>
                  </div>
                </div>

                {lead.vehicleUrl && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06]">
                    <Car className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-neutral-400">Veículo</p>
                      <a href={lead.vehicleUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer">
                        Ver anúncio <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {lead.followupAttempts > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/20">
                    <Bot className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-yellow-600 dark:text-yellow-400">Follow-up</p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">{lead.followupAttempts}/3 tentativas</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Edit form */
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Editar Lead</h3>
              <div className="space-y-2">
                <div><Label className="text-[10px] text-neutral-400">Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} /></div>
                <div><Label className="text-[10px] text-neutral-400">Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputClass} /></div>
                <div><Label className="text-[10px] text-neutral-400">Crédito</Label><Input value={form.creditStatus} onChange={e => setForm(f => ({ ...f, creditStatus: e.target.value }))} className={inputClass} placeholder="Aprovado, Pendente, Reprovado" /></div>
                <div><Label className="text-[10px] text-neutral-400">Pagamento</Label><Input value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className={inputClass} placeholder="Financiamento, À vista, Consórcio" /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="flex-1 h-7 text-xs cursor-pointer">Cancelar</Button>
                <Button size="sm" onClick={saveEdit} disabled={saving} className="flex-1 h-7 text-xs bg-red-600 hover:bg-red-700 text-white cursor-pointer">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Salvar</>}
                </Button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Notas</h3>
            {lead.notes.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-3">Sem notas</p>
            ) : (
              lead.notes.slice(0, 5).map(note => (
                <div key={note.id} className="p-2 rounded-lg bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06]">
                  <div className="flex items-center gap-1 mb-1">
                    {note.type === 'ai' ? <Bot className="h-3 w-3 text-red-500" /> : <User className="h-3 w-3 text-neutral-400" />}
                    <span className="text-[10px] text-neutral-400">{note.type === 'ai' ? 'IA' : 'Humano'} · {timeAgo(note.createdAt)}</span>
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{note.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
