'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';

/**
 * Connects to Socket.IO and invalidates TanStack Query caches on real-time events.
 * Call once per page/layout that needs live updates.
 */
export function useSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const sock = getSocket();
    sock.connect();

    const onLeadUpdated = (payload: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', payload.id] });
    };

    const onLeadMoved = () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    };

    const onLeadHandoff = () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const onNoteAdded = (payload: { leadId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['lead', payload.leadId] });
    };

    const onMessageNew = (payload: { conversationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', payload.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    sock.on('lead:updated', onLeadUpdated);
    sock.on('lead:moved', onLeadMoved);
    sock.on('lead:handoff', onLeadHandoff);
    sock.on('lead:note-added', onNoteAdded);
    sock.on('message:new', onMessageNew);

    return () => {
      sock.off('lead:updated', onLeadUpdated);
      sock.off('lead:moved', onLeadMoved);
      sock.off('lead:handoff', onLeadHandoff);
      sock.off('lead:note-added', onNoteAdded);
      sock.off('message:new', onMessageNew);
      // Do NOT disconnect — singleton stays alive for other components
    };
  }, [queryClient]);
}
