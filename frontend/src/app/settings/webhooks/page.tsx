'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

const EVENTS = ['lead.created', 'lead.qualified', 'lead.stage_changed', 'conversation.new_message'];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data: webhooks } = useQuery<WebhookEndpoint[]>({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/webhooks'),
  });

  const addWebhook = async () => {
    if (!url || selectedEvents.length === 0) return;
    await api.post('/webhooks', { url, events: selectedEvents });
    setUrl('');
    setSelectedEvents([]);
    queryClient.invalidateQueries({ queryKey: ['webhooks'] });
  };

  const deleteWebhook = async (id: string) => {
    await api.delete(`/webhooks/${id}`);
    queryClient.invalidateQueries({ queryKey: ['webhooks'] });
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Webhooks</h1>

      <Card>
        <CardHeader><CardTitle>Endpoints Registrados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {webhooks?.map(wh => (
            <div key={wh.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <code className="text-sm">{wh.url}</code>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteWebhook(wh.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-1 mt-2">
                {wh.events.map(e => (
                  <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Secret: {wh.secret.slice(0, 8)}...</p>
            </div>
          ))}
          {!webhooks?.length && <p className="text-muted-foreground text-sm">Nenhum webhook registrado</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Adicionar Webhook</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {EVENTS.map(event => (
              <Button
                key={event} size="sm"
                variant={selectedEvents.includes(event) ? 'default' : 'outline'}
                className="text-xs"
                onClick={() => toggleEvent(event)}
              >{event}</Button>
            ))}
          </div>
          <Button onClick={addWebhook} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Registrar Webhook
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
