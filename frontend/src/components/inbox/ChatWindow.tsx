'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Shield, MessageSquare } from 'lucide-react';

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
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <MessageSquare className="h-8 w-8 text-slate-600" />
        </div>
        <p className="text-sm">Selecione uma conversa</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!message.trim() || !conversationId) return;
    setSending(true);
    try {
      await api.post(`/conversations/${conversationId}/message`, { content: message, instance: 'default' });
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
      <div className="border-b border-white/[0.06] px-5 py-3.5 flex items-center justify-between glass">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <User className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{lead?.name || lead?.phone}</p>
            {lead?.name && <p className="text-[11px] text-slate-500">{lead.phone}</p>}
          </div>
          {lead?.humanOverride && (
            <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs ml-2">Modo humano</Badge>
          )}
        </div>
        <div>
          {lead?.humanOverride ? (
            <Button size="sm" variant="outline" onClick={() => handleHandoff(false)}
              className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-500/10 cursor-pointer text-xs">
              <Bot className="h-3.5 w-3.5 mr-1.5" /> Devolver para IA
            </Button>
          ) : (
            <Button size="sm" onClick={() => handleHandoff(true)}
              className="bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 cursor-pointer text-xs">
              <Shield className="h-3.5 w-3.5 mr-1.5" /> Assumir conversa
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'lead' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'lead'
                  ? 'bg-white/[0.06] text-slate-200 rounded-bl-md'
                  : msg.role === 'agent'
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-100 border border-red-200 dark:border-red-500/20 rounded-br-md'
                  : 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20 rounded-br-md'
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {msg.role === 'lead' && <User className="h-3 w-3 text-slate-500" />}
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
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-white/[0.06] p-4 glass">
        <div className="flex gap-3 items-end">
          <Textarea
            placeholder="Digite sua mensagem..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="min-h-[44px] max-h-[120px] bg-white/5 border-white/10 focus:border-red-500/50 resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="bg-red-600 hover:bg-red-500 h-11 w-11 p-0 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
