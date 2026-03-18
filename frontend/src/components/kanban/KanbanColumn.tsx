'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { LeadCard, type Lead } from './LeadCard';

interface KanbanColumnProps {
  column: { id: string; name: string; order: number };
  leads: Lead[];
  onLeadClick: (leadId: string) => void;
}

export function KanbanColumn({ column, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] max-w-[320px] bg-muted/50 rounded-lg p-3 flex flex-col ${
        isOver ? 'ring-2 ring-primary/50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{column.name}</h3>
        <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
      </div>
      <div className="flex-1 min-h-[100px]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
