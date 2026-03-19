'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { User, Clock } from 'lucide-react';

export interface Lead {
  id: string;
  phone: string;
  name: string | null;
  city: string | null;
  creditStatus: string | null;
  paymentMethod: string | null;
  vehicleUrl: string | null;
  stageId: string | null;
  pipelineId: string | null;
  humanOverride: boolean;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string; order: number } | null;
  notes?: { id: string; content: string; type: string; createdAt: string }[];
  conversation?: { messages: { id: string; role: string; content: string; createdAt: string }[] };
}

interface LeadCardProps {
  lead: Lead;
  isDragging?: boolean;
  onClick?: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function LeadCard({ lead, isDragging, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const latestNote = lead.notes?.[0];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="glass-card rounded-xl p-3.5 mb-2 cursor-grab hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-200 border border-white/[0.06] group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{lead.name || lead.phone}</p>
            {lead.name && <p className="text-[11px] text-slate-500">{lead.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500 flex-shrink-0">
          <Clock className="h-3 w-3" />
          {timeAgo(lead.createdAt)}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2.5">
        {lead.humanOverride && (
          <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] px-1.5 h-5">Humano</Badge>
        )}
        {lead.city && (
          <Badge className="bg-white/5 text-slate-400 border-white/10 text-[10px] px-1.5 h-5">{lead.city}</Badge>
        )}
        {lead.creditStatus && (
          <Badge className={`text-[10px] px-1.5 h-5 ${
            lead.creditStatus === 'Aprovado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10'
          }`}>{lead.creditStatus}</Badge>
        )}
      </div>

      {latestNote && (
        <p className="text-[11px] text-slate-500 mt-2 truncate leading-relaxed">{latestNote.content}</p>
      )}
    </div>
  );
}
