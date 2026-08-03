'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { leadPhone } from '@/lib/utils';
import {
  Send, Bot, User, Shield, MessageSquare, StickyNote, Clock,
  CheckCircle, XCircle, RotateCcw, Paperclip, Smile, Hash,
  ArrowRightLeft, Loader2, ChevronDown, ChevronLeft, Info,
} from 'lucide-react';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  leadId: string;
  channel: string;
  lead: { name: string | null; phone: string; contactPhone?: string | null; humanOverride: boolean };
  messages: Message[];
}

interface ChatWindowProps {
  conversationId: string | null;
  onBack?: () => void;
  onOpenInfo?: () => void;
}

const QUICK_REPLIES = [
  { label: 'Saudação', text: 'Olá! Bem-vindo à Autoscar. Como posso ajudar?' },
  { label: 'Veículo', text: 'Pode me enviar o link do veículo que te interessou no nosso site?' },
  { label: 'Financiamento', text: 'Trabalhamos com financiamento facilitado. Quer que eu verifique as condições para você?' },
  { label: 'Visita', text: 'Gostaria de agendar uma visita para ver o veículo pessoalmente?' },
  { label: 'Documentação', text: 'Para prosseguir, vou precisar do seu nome completo e CPF.' },
  { label: 'Obrigado', text: 'Obrigado pelo contato! Qualquer dúvida, estamos à disposição.' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function ChatWindow({ conversationId, onBack, onOpenInfo }: ChatWindowProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversation, isLoading: conversationLoading, isError: conversationError } = useQuery<ConversationDetail>({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  useEffect(() => {
    setShowQuickReplies(false);
    setShowNoteInput(false);
    setMessage('');
  }, [conversationId]);

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-neutral-50 dark:bg-white/5 flex items-center justify-center">
          <MessageSquare className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
        </div>
        <p className="text-sm">Selecione uma conversa</p>
        <p className="text-xs text-neutral-300 dark:text-neutral-600">Escolha um contato para iniciar</p>
      </div>
    );
  }

  if (conversationLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
        Carregando conversa...
      </div>
    );
  }

  if (conversationError || !conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-red-500">
        <MessageSquare className="h-7 w-7" />
        <p>Não foi possível abrir esta conversa.</p>
        <p className="text-xs text-neutral-400">Atualize a página e tente novamente.</p>
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

  const handleQuickReply = (text: string) => {
    setMessage(text);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !conversation?.leadId) return;
    setSavingNote(true);
    try {
      await api.post(`/leads/${conversation.leadId}/notes`, { content: noteText, type: 'human' });
      setNoteText('');
      setShowNoteInput(false);
      queryClient.invalidateQueries({ queryKey: ['lead-detail', conversation.leadId] });
    } finally {
      setSavingNote(false);
    }
  };

  const handleHandoff = async (override: boolean) => {
    if (!conversation) return;
    await api.patch(`/leads/${conversation.leadId}/handoff`, { override });
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['lead-detail', conversation.leadId] });
  };

  const handleMoveStage = async (stageName: string) => {
    if (!conversation?.leadId) return;
    try {
      const pipelines = await api.get<any[]>('/pipelines');
      const pipeline = pipelines[0];
      const stage = pipeline?.stages?.find((s: any) => s.name.toLowerCase().includes(stageName.toLowerCase()));
      if (stage) {
        await api.patch(`/leads/${conversation.leadId}/move`, { stageId: stage.id });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['lead-detail', conversation.leadId] });
      }
    } catch { /* ok */ }
  };

  const lead = conversation?.lead;
  const messages = conversation?.messages ?? [];

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groupedMessages.push({ date, msgs: [] });
    }
    groupedMessages[groupedMessages.length - 1].msgs.push(msg);
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-white/[0.06] px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2 bg-white dark:bg-[#0f0f0f]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Voltar"
              className="lg:hidden shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            {lead?.name ? (
              <span className="text-sm font-bold text-red-600 dark:text-red-400">{lead.name.charAt(0).toUpperCase()}</span>
            ) : (
              <User className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{lead?.name || (lead ? leadPhone(lead) : '') || 'Lead'}</p>
              <Badge className="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20 text-[10px] h-4 hidden sm:inline-flex">
                {conversation?.channel === 'instagram' ? 'Instagram' : conversation?.channel === 'sms' ? 'SMS' : 'WhatsApp'}
              </Badge>
            </div>
            {lead?.name && lead && leadPhone(lead) && <p className="text-[11px] text-neutral-400 truncate">{leadPhone(lead)}</p>}
          </div>
        </div>

        {/* Action buttons — desktop */}
        <div className="hidden lg:flex items-center gap-1.5">
          {lead?.humanOverride ? (
            <Button size="sm" variant="outline" onClick={() => handleHandoff(false)}
              className="border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer text-xs h-8">
              <Bot className="h-3.5 w-3.5 mr-1" /> Devolver IA
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => handleHandoff(true)}
              className="border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer text-xs h-8">
              <Shield className="h-3.5 w-3.5 mr-1" /> Assumir
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => handleMoveStage('qualificado')}
            className="border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 cursor-pointer text-xs h-8">
            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Qualificar
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleMoveStage('desqualificado')}
            className="border-neutral-200 dark:border-white/10 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-xs h-8">
            <XCircle className="h-3.5 w-3.5 mr-1" /> Descartar
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleMoveStage('follow-up')}
            className="border-neutral-200 dark:border-white/10 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer text-xs h-8">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Follow-up
          </Button>
        </div>

        {/* Mobile: quick handoff + info */}
        <div className="flex lg:hidden items-center gap-1 shrink-0">
          {lead?.humanOverride ? (
            <button
              onClick={() => handleHandoff(false)}
              aria-label="Devolver para IA"
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 cursor-pointer"
            >
              <Bot className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => handleHandoff(true)}
              aria-label="Assumir conversa"
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 cursor-pointer"
            >
              <Shield className="h-4 w-4" />
            </button>
          )}
          {onOpenInfo && (
            <button
              onClick={onOpenInfo}
              aria-label="Info do lead"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile-only stage actions row */}
      <div className="lg:hidden flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-[#0f0f0f]">
        <Button size="sm" variant="outline" onClick={() => handleMoveStage('qualificado')}
          className="border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400 text-[11px] h-7 shrink-0 cursor-pointer">
          <CheckCircle className="h-3 w-3 mr-1" /> Qualificar
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleMoveStage('follow-up')}
          className="text-[11px] h-7 shrink-0 cursor-pointer">
          <RotateCcw className="h-3 w-3 mr-1" /> Follow-up
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleMoveStage('desqualificado')}
          className="text-[11px] h-7 shrink-0 cursor-pointer">
          <XCircle className="h-3 w-3 mr-1" /> Descartar
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-neutral-50/50 dark:bg-[#0a0a0a]">
        <div className="p-3 sm:p-5 space-y-1">
          {groupedMessages.map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-neutral-200 dark:bg-white/[0.06]" />
                <span className="text-[10px] text-neutral-400 font-medium px-2">{group.date}</span>
                <div className="flex-1 h-px bg-neutral-200 dark:bg-white/[0.06]" />
              </div>

              {group.msgs.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'lead' ? 'justify-start' : 'justify-end'} mb-2`}>
                  {/* Avatar for lead */}
                  {msg.role === 'lead' && (
                    <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                    </div>
                  )}

                  <div className={`max-w-[82%] sm:max-w-[65%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm ${
                    msg.role === 'lead'
                      ? 'bg-white dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 rounded-bl-md shadow-sm'
                      : msg.role === 'agent'
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-100 border border-red-100 dark:border-red-500/20 rounded-br-md'
                      : 'bg-green-50 dark:bg-emerald-500/10 text-green-900 dark:text-emerald-100 border border-green-100 dark:border-emerald-500/20 rounded-br-md'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {msg.role === 'agent' && <Bot className="h-3 w-3 text-red-500 dark:text-red-400" />}
                      {msg.role === 'human' && <Shield className="h-3 w-3 text-green-600 dark:text-emerald-400" />}
                      <span className="text-[10px] font-medium opacity-50">
                        {msg.role === 'lead' ? (lead?.name || 'Lead') : msg.role === 'agent' ? 'Agente IA' : 'Operador'}
                      </span>
                      <span className="text-[10px] opacity-30 ml-auto">
                        {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Avatar for agent/human */}
                  {msg.role !== 'lead' && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ml-2 mt-1 flex-shrink-0 ${
                      msg.role === 'agent' ? 'bg-red-50 dark:bg-red-500/10' : 'bg-green-50 dark:bg-emerald-500/10'
                    }`}>
                      {msg.role === 'agent' ? <Bot className="h-3.5 w-3.5 text-red-500 dark:text-red-400" /> : <Shield className="h-3.5 w-3.5 text-green-600 dark:text-emerald-400" />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Quick replies panel */}
      {showQuickReplies && (
        <div className="border-t border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-[#141414] p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold mb-2">Respostas Rápidas</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REPLIES.map(qr => (
              <button key={qr.label} onClick={() => handleQuickReply(qr.text)}
                className="px-3 py-1.5 rounded-full text-xs bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/20 transition-colors cursor-pointer">
                {qr.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Note input */}
      {showNoteInput && (
        <div className="border-t border-neutral-200 dark:border-white/[0.06] bg-yellow-50/50 dark:bg-yellow-500/5 p-3">
          <div className="flex items-center gap-1 mb-2">
            <StickyNote className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-[10px] text-yellow-700 dark:text-yellow-400 font-semibold uppercase tracking-wider">Nota Interna (não enviada ao lead)</p>
          </div>
          <div className="flex gap-2">
            <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escreva uma nota..."
              className="bg-white dark:bg-white/5 border-yellow-200 dark:border-yellow-500/20 h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
            <Button size="sm" onClick={handleAddNote} disabled={savingNote || !noteText.trim()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white h-8 text-xs cursor-pointer">
              {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {/* Input toolbar + message */}
      <div className="border-t border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-[#0f0f0f]">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-3 pt-2">
          <Button size="icon" variant="ghost" onClick={() => { setShowQuickReplies(!showQuickReplies); setShowNoteInput(false); }}
            className={`h-7 w-7 cursor-pointer ${showQuickReplies ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
            title="Respostas rápidas">
            <Hash className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => { setShowNoteInput(!showNoteInput); setShowQuickReplies(false); }}
            className={`h-7 w-7 cursor-pointer ${showNoteInput ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
            title="Nota interna">
            <StickyNote className="h-3.5 w-3.5" />
          </Button>
          <div className="flex-1" />
          <span className="hidden sm:inline text-[10px] text-neutral-300 dark:text-neutral-600">Enter para enviar · Shift+Enter nova linha</span>
        </div>

        {/* Message input */}
        <div className="flex gap-3 items-end p-3 pt-1">
          <Textarea
            ref={inputRef}
            placeholder="Digite sua mensagem..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="min-h-[44px] max-h-[120px] bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 resize-none text-sm"
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
            className="bg-red-600 hover:bg-red-500 h-11 w-11 p-0 cursor-pointer flex-shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
