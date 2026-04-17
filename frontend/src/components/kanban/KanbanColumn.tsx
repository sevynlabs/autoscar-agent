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
      className={`w-[86vw] min-w-[260px] max-w-[320px] sm:w-auto sm:min-w-[280px] rounded-xl flex flex-col transition-all duration-200 snap-start shrink-0 ${
        isOver ? 'ring-1 ring-red-500/40 bg-red-500/5' : 'bg-neutral-50/50 dark:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-neutral-200 dark:border-white/[0.06]">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">{column.name}</h3>
        <Badge className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/20 text-xs shrink-0">{leads.length}</Badge>
      </div>
      <div className="flex-1 p-2 min-h-[200px] overflow-y-auto">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-neutral-500 dark:text-neutral-400">
            Arraste leads aqui
          </div>
        )}
      </div>
    </div>
  );
}
