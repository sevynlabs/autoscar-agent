'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  leadId: string;
  lead: { name: string | null; phone: string; humanOverride: boolean };
  messages: Message[];
}

interface ChatWindowProps {
  conversationId: string | null;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useQuery<ConversationDetail>({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Selecione uma conversa
      </div>
    );
  }

  const handleSend = async () => {
    if (!message.trim() || !conversationId) return;
    setSending(true);
    try {
      await api.post(`/conversations/${conversationId}/message`, {
        content: message,
        instance: 'default',
      });
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } finally {
      setSending(false);
    }
  };

  const handleHandoff = async (override: boolean) => {
    if (!conversation) return;
    await api.patch(`/leads/${conversation.leadId}/handoff`, { override });
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  const lead = conversation?.lead;
  const messages = conversation?.messages ?? [];

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{lead?.name || lead?.phone}</span>
          {lead?.humanOverride && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">Modo humano</Badge>
          )}
        </div>
        <div>
          {lead?.humanOverride ? (
            <Button size="sm" variant="outline" onClick={() => handleHandoff(false)}>
              Devolver para IA
            </Button>
          ) : (
            <Button size="sm" variant="default" className="bg-orange-500 hover:bg-orange-600" onClick={() => handleHandoff(true)}>
              Assumir conversa
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'lead' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
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
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Textarea
          placeholder="Digite sua mensagem..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="min-h-[44px] max-h-[120px]"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={sending || !message.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
