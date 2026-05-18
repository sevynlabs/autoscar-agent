'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadEditForm } from './LeadEditForm';
import type { Lead } from '@/components/kanban/LeadCard';
import { leadPhone } from '@/lib/utils';
import { User, Bot, Shield, MessageSquare, FileText, Settings2, Plus, Trash2 } from 'lucide-react';

interface LeadDetailProps {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetail({ leadId, open, onClose }: LeadDetailProps) {
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => api.get(`/leads/${leadId}/detail`),
    enabled: !!leadId,
  });

  const handleAddNote = async () => {
    if (!noteContent.trim() || !leadId) return;
    await api.post(`/leads/${leadId}/notes`, { content: noteContent, type: 'human' });
    setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
  };

  const handleDelete = async () => {
    if (!leadId || !confirm('Tem certeza que deseja excluir este lead? Todas as conversas e notas serão apagadas.')) return;
    setDeleting(true);
    try {
      await api.delete(`/leads/${leadId}`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const messages = lead?.conversation?.messages ?? [];
  const notes = lead?.notes ?? [];

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:w-[500px] sm:max-w-[500px] bg-white dark:bg-[#0f0f0f] border-l border-neutral-200 dark:border-white/[0.06] p-0">
        {/* Header */}
        <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-neutral-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <User className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <SheetTitle className="text-neutral-900 dark:text-white text-base">{lead?.name || (lead ? leadPhone(lead) : '') || 'Lead'}</SheetTitle>
              {lead?.name && lead && leadPhone(lead) && <p className="text-xs text-neutral-400 dark:text-neutral-500">{leadPhone(lead)}</p>}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {lead?.humanOverride && (
                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">Humano</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-8 w-8 p-0 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                title="Excluir lead"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick stats */}
          {lead && (
            <div className="flex gap-2 mt-3">
              {lead.stage && (
                <Badge className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/20 text-xs">{lead.stage.name}</Badge>
              )}
              {lead.city && (
                <Badge className="bg-neutral-50 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-white/10 text-xs">{lead.city}</Badge>
              )}
              {lead.creditStatus && (
                <Badge className={`text-xs ${
                  lead.creditStatus === 'Aprovado'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-neutral-50 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-white/10'
                }`}>{lead.creditStatus}</Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="conversa" className="flex flex-col h-[calc(100vh-160px)]">
            <TabsList className="mx-6 mt-4 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/[0.06] p-1 rounded-xl">
              <TabsTrigger value="conversa" className="data-[state=active]:bg-red-50 dark:bg-red-500/10 data-[state=active]:text-red-600 dark:text-red-300 rounded-lg text-xs gap-1.5 cursor-pointer">
                <MessageSquare className="h-3.5 w-3.5" /> Conversa
              </TabsTrigger>
              <TabsTrigger value="notas" className="data-[state=active]:bg-red-50 dark:bg-red-500/10 data-[state=active]:text-red-600 dark:text-red-300 rounded-lg text-xs gap-1.5 cursor-pointer">
                <FileText className="h-3.5 w-3.5" /> Notas
              </TabsTrigger>
              <TabsTrigger value="dados" className="data-[state=active]:bg-red-50 dark:bg-red-500/10 data-[state=active]:text-red-600 dark:text-red-300 rounded-lg text-xs gap-1.5 cursor-pointer">
                <Settings2 className="h-3.5 w-3.5" /> Dados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conversa" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-6">
                  {messages.length === 0 && (
                    <div className="text-center py-12 text-neutral-400 dark:text-neutral-500 text-sm">Nenhuma mensagem ainda</div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'lead' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === 'lead'
                          ? 'bg-neutral-50 dark:bg-neutral-100 dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 rounded-bl-md'
                          : msg.role === 'agent'
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-500/20 rounded-br-md'
                          : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-100 border border-emerald-500/20 rounded-br-md'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {msg.role === 'lead' && <User className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />}
                          {msg.role === 'agent' && <Bot className="h-3 w-3 text-red-600 dark:text-red-400" />}
                          {msg.role === 'human' && <Shield className="h-3 w-3 text-emerald-400" />}
                          <span className="text-[10px] font-medium opacity-60">
                            {msg.role === 'lead' ? 'Lead' : msg.role === 'agent' ? 'IA' : 'Operador'}
                          </span>
                        </div>
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className="text-[10px] opacity-40 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="notas" className="flex-1 flex flex-col overflow-hidden mt-0">
              <ScrollArea className="flex-1">
                <div className="space-y-3 p-6">
                  {notes.length === 0 && (
                    <div className="text-center py-12 text-neutral-400 dark:text-neutral-500 text-sm">Nenhuma nota ainda</div>
                  )}
                  {notes.map(note => (
                    <div key={note.id} className="glass-card rounded-xl p-4 border border-neutral-200 dark:border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-2">
                        {note.type === 'ai' ? (
                          <Badge className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/20 text-[10px]">
                            <Bot className="h-3 w-3 mr-1" /> IA
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px]">
                            <User className="h-3 w-3 mr-1" /> Humano
                          </Badge>
                        )}
                        <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                          {new Date(note.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-neutral-200 dark:border-white/[0.06]">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Adicionar nota..."
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    className="min-h-[60px] bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 resize-none"
                  />
                  <Button onClick={handleAddNote} size="sm" className="bg-red-600 hover:bg-red-500 cursor-pointer self-end">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dados" className="flex-1 overflow-auto mt-0">
              <div className="p-6">
                {lead && <LeadEditForm lead={lead} />}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
