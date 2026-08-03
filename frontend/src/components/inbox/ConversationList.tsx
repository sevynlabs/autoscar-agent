'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, User, Bot, Shield, MessageSquare, Phone, Instagram, Smartphone } from 'lucide-react';
import { leadPhone } from '@/lib/utils';

interface Conversation {
  id: string;
  leadId: string;
  channel: string;
  lead: { name: string | null; phone: string; contactPhone?: string | null; stage: { name: string } | null; humanOverride: boolean };
  messages: { content: string; role: string; createdAt: string }[];
  updatedAt: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const channelIcon: Record<string, { icon: typeof Phone; color: string }> = {
  whatsapp: { icon: Phone, color: 'text-green-600 dark:text-green-400' },
  instagram: { icon: Instagram, color: 'text-purple-600 dark:text-purple-400' },
  sms: { icon: Smartphone, color: 'text-blue-600 dark:text-blue-400' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filtered = conversations.filter(c => {
    const term = search.toLowerCase();
    const matchesSearch = !term || (c.lead.name?.toLowerCase().includes(term) ?? false) || leadPhone(c.lead).includes(term);
    const matchesChannel = !channelFilter || c.channel === channelFilter;
    const matchesStatus = !statusFilter || (statusFilter === 'human' && c.lead.humanOverride) || (statusFilter === 'ai' && !c.lead.humanOverride);
    return matchesSearch && matchesChannel && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const humanCount = conversations.filter(c => c.lead.humanOverride).length;

  return (
    <div className="w-full lg:w-80 lg:border-r border-neutral-200 dark:border-white/[0.06] flex flex-col h-full bg-white dark:bg-[#0f0f0f]">
      <div className="p-3 border-b border-neutral-200 dark:border-white/[0.06]">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Conversas</h2>
          <Badge className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20 text-[10px]">{conversations.length}</Badge>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-8 text-xs" />
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={channelFilter === null ? 'default' : 'outline'}
            className={`text-[10px] h-6 px-2 cursor-pointer ${channelFilter === null ? 'bg-red-600 text-white' : ''}`}
            onClick={() => setChannelFilter(null)}>Todos</Button>
          <Button size="sm" variant={channelFilter === 'whatsapp' ? 'default' : 'outline'}
            className={`text-[10px] h-6 px-2 cursor-pointer ${channelFilter === 'whatsapp' ? 'bg-green-600 text-white' : ''}`}
            onClick={() => setChannelFilter(channelFilter === 'whatsapp' ? null : 'whatsapp')}>WA</Button>
          <Button size="sm" variant={channelFilter === 'instagram' ? 'default' : 'outline'}
            className={`text-[10px] h-6 px-2 cursor-pointer ${channelFilter === 'instagram' ? 'bg-purple-600 text-white' : ''}`}
            onClick={() => setChannelFilter(channelFilter === 'instagram' ? null : 'instagram')}>IG</Button>
          <div className="w-px bg-neutral-200 dark:bg-white/10 mx-0.5" />
          <Button size="sm" variant={statusFilter === 'ai' ? 'default' : 'outline'}
            className={`text-[10px] h-6 px-2 cursor-pointer ${statusFilter === 'ai' ? 'bg-red-600 text-white' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'ai' ? null : 'ai')}>
            <Bot className="h-3 w-3 mr-0.5" /> IA</Button>
          <Button size="sm" variant={statusFilter === 'human' ? 'default' : 'outline'}
            className={`text-[10px] h-6 px-2 cursor-pointer ${statusFilter === 'human' ? 'bg-orange-600 text-white' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'human' ? null : 'human')}>
            <Shield className="h-3 w-3 mr-0.5" /> {humanCount}</Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
            <MessageSquare className="h-8 w-8 mb-2 text-neutral-300 dark:text-neutral-600" />
            <p className="text-xs">Nenhuma conversa</p>
          </div>
        )}
        {sorted.map(conv => {
          const latestMsg = conv.messages[conv.messages.length - 1];
          const chConfig = channelIcon[conv.channel] ?? channelIcon.whatsapp;
          const ChannelIcon = chConfig.icon;
          const isSelected = selectedId === conv.id;

          return (
            <button key={conv.id} type="button" onClick={() => onSelect(conv.id)}
              aria-pressed={isSelected}
              aria-label={`Abrir conversa de ${conv.lead.name || leadPhone(conv.lead) || 'Lead'}`}
              className={`px-3 py-3 cursor-pointer transition-all duration-150 border-l-2 ${
                isSelected ? 'bg-red-50/50 dark:bg-red-500/5 border-l-red-500' : 'border-l-transparent hover:bg-neutral-50 dark:hover:bg-white/[0.02]'
              } w-full text-left`}
            >
              <div className="flex items-start gap-2.5">
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    conv.lead.humanOverride ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-neutral-100 dark:bg-white/5'
                  }`}>
                    {conv.lead.name ? (
                      <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300">{conv.lead.name.charAt(0).toUpperCase()}</span>
                    ) : (<User className="h-4 w-4 text-neutral-400" />)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-[#0f0f0f] flex items-center justify-center">
                    <ChannelIcon className={`h-2.5 w-2.5 ${chConfig.color}`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">{conv.lead.name || leadPhone(conv.lead) || 'Lead'}</span>
                    <span className="text-[10px] text-neutral-400 flex-shrink-0 ml-2">{timeAgo(conv.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    {conv.lead.stage && (
                      <Badge className="bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-white/10 text-[9px] h-4 px-1">{conv.lead.stage.name}</Badge>
                    )}
                    {conv.lead.humanOverride && (
                      <Badge className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20 text-[9px] h-4 px-1">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />Humano</Badge>
                    )}
                  </div>
                  {latestMsg && (
                    <div className="flex items-center gap-1">
                      {latestMsg.role === 'agent' && <Bot className="h-3 w-3 text-red-400 flex-shrink-0" />}
                      {latestMsg.role === 'human' && <Shield className="h-3 w-3 text-green-400 flex-shrink-0" />}
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{latestMsg.content.slice(0, 80)}</p>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </ScrollArea>
    </div>
  );
}
