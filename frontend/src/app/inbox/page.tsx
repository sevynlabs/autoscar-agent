'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatWindow } from '@/components/inbox/ChatWindow';

export default function InboxPage() {
  useSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<any[]>('/conversations'),
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
