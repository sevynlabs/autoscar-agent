'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab hover:shadow-md transition-shadow mb-2"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">{lead.name || lead.phone}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(lead.createdAt)}</span>
        </div>
        {lead.name && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
        {lead.humanOverride && (
          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">Humano</Badge>
        )}
        {latestNote && (
          <p className="text-xs text-muted-foreground truncate">{latestNote.content}</p>
        )}
      </CardContent>
    </Card>
  );
}
