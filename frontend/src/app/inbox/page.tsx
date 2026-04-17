'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { LeadInfoPanel } from '@/components/inbox/LeadInfoPanel';

interface Conversation {
  id: string;
  leadId: string;
  channel: string;
  lead: { name: string | null; phone: string; stage: { name: string } | null; humanOverride: boolean };
  messages: { content: string; role: string; createdAt: string }[];
  updatedAt: string;
}

export default function InboxPage() {
  useSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/conversations'),
  });

  const selectedConv = conversations?.find((c) => c.id === selectedId);
  const leadId = selectedConv?.leadId ?? null;

  const hasSelection = !!selectedId;

  return (
    <div className="flex h-full">
      {/* Conversation list: always visible on lg+, visible on mobile when nothing selected */}
      <div className={`${hasSelection ? 'hidden lg:flex' : 'flex'} flex-1 lg:flex-none w-full`}>
        <ConversationList
          conversations={conversations ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Chat: on mobile, only when a conversation is selected */}
      <div className={`${hasSelection ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0`}>
        <ChatWindow
          conversationId={selectedId}
          onBack={() => setSelectedId(null)}
          onOpenInfo={() => setInfoOpen(true)}
        />
      </div>

      {/* Lead info: desktop always visible; mobile as drawer */}
      <div className="hidden lg:flex">
        <LeadInfoPanel leadId={leadId} />
      </div>

      {infoOpen && leadId && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="relative h-full w-[85vw] max-w-[340px] bg-white dark:bg-[#0f0f0f] shadow-2xl animate-in slide-in-from-right duration-200">
            <button
              onClick={() => setInfoOpen(false)}
              aria-label="Fechar"
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <LeadInfoPanel leadId={leadId} />
          </div>
        </div>
      )}
    </div>
  );
}
