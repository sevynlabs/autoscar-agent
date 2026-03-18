'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatWindow } from '@/components/inbox/ChatWindow';

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<any[]>('/conversations'),
    refetchInterval: 10000,
  });

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <ChatWindow conversationId={selectedId} />
    </div>
  );
}
