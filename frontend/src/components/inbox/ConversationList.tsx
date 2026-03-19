'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface Conversation {
  id: string;
  leadId: string;
  channel: string;
  lead: { name: string | null; phone: string; stage: { name: string } | null; humanOverride: boolean };
  messages: { content: string; role: string; createdAt: string }[];
  updatedAt: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const channelConfig: Record<string, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: 'text-green-600 border-green-300' },
  instagram: { label: 'Instagram', color: 'text-purple-600 border-purple-300' },
  sms: { label: 'SMS', color: 'text-blue-600 border-blue-300' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string | null>(null);

  const filtered = conversations.filter(c => {
    const term = search.toLowerCase();
    const matchesSearch =
      (c.lead.name?.toLowerCase().includes(term) ?? false) ||
      c.lead.phone.includes(term);
    const matchesChannel = !channelFilter || c.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="w-80 border-r flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Input
          placeholder="Buscar conversa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          <Button
            size="sm" variant={channelFilter === null ? 'default' : 'outline'}
            className="text-xs h-6 px-2" onClick={() => setChannelFilter(null)}
          >Todos</Button>
          {Object.entries(channelConfig).map(([key, cfg]) => (
            <Button
              key={key} size="sm"
              variant={channelFilter === key ? 'default' : 'outline'}
              className="text-xs h-6 px-2"
              onClick={() => setChannelFilter(key)}
            >{cfg.label}</Button>
          ))}
        </div>
      </div>
      <ScrollArea className="flex-1">
        {sorted.map(conv => {
          const latestMsg = conv.messages[conv.messages.length - 1];
          const cfg = channelConfig[conv.channel] ?? channelConfig.whatsapp;
          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`p-3 border-b cursor-pointer hover:bg-accent/50 ${
                selectedId === conv.id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">
                  {conv.lead.name || conv.lead.phone}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(conv.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                {conv.lead.humanOverride && (
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                )}
                {conv.lead.stage && (
                  <Badge variant="secondary" className="text-xs">{conv.lead.stage.name}</Badge>
                )}
              </div>
              {latestMsg && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {latestMsg.content.slice(0, 60)}
                </p>
              )}
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}
