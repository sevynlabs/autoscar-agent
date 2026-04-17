'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { KanbanColumn } from './KanbanColumn';
import { LeadCard, type Lead } from './LeadCard';

interface Stage {
  id: string;
  name: string;
  order: number;
}

interface KanbanBoardProps {
  stages: Stage[];
  leads: Lead[];
  pipelineId: string;
  onLeadClick: (leadId: string) => void;
}

export function KanbanBoard({ stages, leads, pipelineId, onLeadClick }: KanbanBoardProps) {
  useSocket();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads);

  // Sync localLeads when server data changes
  if (JSON.stringify(leads.map(l => l.id + l.stageId)) !== JSON.stringify(localLeads.map(l => l.id + l.stageId))) {
    setLocalLeads(leads);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeLead = localLeads.find(l => l.id === activeId);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const targetStage = stages.find(s => s.id === overId);
    if (!targetStage) return;

    setLocalLeads(prev =>
      prev.map(l =>
        l.id === active.id
          ? { ...l, stageId: targetStage.id, stage: targetStage }
          : l
      )
    );
  }, [stages]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const overId = over.id as string;
    const targetStage = stages.find(s => s.id === overId);
    if (!targetStage) return;

    const lead = leads.find(l => l.id === active.id);
    if (!lead || lead.stageId === targetStage.id) return;

    try {
      await api.patch(`/leads/${active.id}/move`, { stageId: targetStage.id });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch {
      setLocalLeads(leads); // rollback
    }
  }, [stages, leads, queryClient]);

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 sm:gap-4 overflow-x-auto min-h-[calc(100dvh-180px)] p-3 sm:p-4 snap-x snap-mandatory sm:snap-none scroll-pl-3 sm:scroll-pl-0">
        {sortedStages.map(stage => (
          <KanbanColumn
            key={stage.id}
            column={stage}
            leads={localLeads.filter(l => l.stageId === stage.id)}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <LeadCard lead={activeLead} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
