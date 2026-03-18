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
import { LeadEditForm } from './LeadEditForm';
import type { Lead } from '@/components/kanban/LeadCard';

interface LeadDetailProps {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetail({ leadId, open, onClose }: LeadDetailProps) {
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');

  const { data: lead } = useQuery<Lead>({
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

  const messages = lead?.conversation?.messages ?? [];
  const notes = lead?.notes ?? [];

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {lead?.name || lead?.phone || 'Lead'}
            {lead?.humanOverride && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">Humano</Badge>
            )}
          </SheetTitle>
          {lead?.name && <p className="text-sm text-muted-foreground">{lead.phone}</p>}
        </SheetHeader>

        <Tabs defaultValue="conversa" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conversa">Conversa</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="dados">Dados</TabsTrigger>
          </TabsList>

          <TabsContent value="conversa">
            <ScrollArea className="h-[calc(100vh-240px)]">
              <div className="space-y-3 p-2">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'lead' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'lead'
                          ? 'bg-muted'
                          : msg.role === 'agent'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-green-100 text-green-900'
                      }`}
                    >
                      <p className="text-xs font-medium mb-1">
                        {msg.role === 'lead' ? 'Lead' : msg.role === 'agent' ? 'IA' : 'Operador'}
                      </p>
                      <p>{msg.content}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notas">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-3 p-2">
                {notes.map(note => (
                  <div key={note.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={note.type === 'ai' ? 'secondary' : 'outline'} className="text-xs">
                        {note.type === 'ai' ? 'IA' : 'Humano'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm">{note.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 mt-2">
              <Textarea
                placeholder="Adicionar nota..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                className="min-h-[60px]"
              />
              <Button onClick={handleAddNote} size="sm">Salvar</Button>
            </div>
          </TabsContent>

          <TabsContent value="dados">
            {lead && <LeadEditForm lead={lead} />}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
