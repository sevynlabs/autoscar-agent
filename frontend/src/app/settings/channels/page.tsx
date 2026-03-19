'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Plus, Trash2, QrCode, RefreshCw, Loader2, MessageSquare, Instagram, Smartphone } from 'lucide-react';

interface WhatsAppInstance {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  createdAt: string;
}

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrData, setQrData] = useState<{ name: string; base64: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const { data: instances, isLoading } = useQuery<WhatsAppInstance[]>({
    queryKey: ['instances'],
    queryFn: () => api.get('/instances'),
    refetchInterval: 10000,
  });

  // Auto-close QR when instance connects
  useEffect(() => {
    if (qrData && instances) {
      const inst = instances.find(i => i.name === qrData.name);
      if (inst?.status === 'connected') {
        setQrData(null);
      }
    }
  }, [instances, qrData]);

  const createNewInstance = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/instances', { name: newName.trim() });
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      // Auto-show QR
      setTimeout(() => showQr(newName.trim()), 1000);
    } catch (err: any) {
      alert(err.message ?? 'Erro ao criar instância');
    } finally {
      setCreating(false);
    }
  };

  const showQr = async (name: string) => {
    setQrLoading(true);
    try {
      const res = await api.get<{ qrCode: string }>(`/instances/${name}/qr`);
      setQrData({ name, base64: res.qrCode });
    } catch {
      alert('QR code não disponível. A instância já pode estar conectada.');
    } finally {
      setQrLoading(false);
    }
  };

  const deleteInst = async (name: string) => {
    if (!confirm(`Excluir instância "${name}"?`)) return;
    await api.delete(`/instances/${name}`);
    queryClient.invalidateQueries({ queryKey: ['instances'] });
    if (qrData?.name === name) setQrData(null);
  };

  const statusColor = (status: string) => {
    if (status === 'connected' || status === 'open') return 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20';
    if (status === 'connecting') return 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
    return 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-white/10';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <Phone className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Canais</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Conecte WhatsApp, Instagram e SMS</p>
        </div>
      </div>

      {/* ============ WHATSAPP ============ */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">WhatsApp</h2>
            <p className="text-xs text-neutral-400">Evolution API — Modo Baileys (QR Code)</p>
          </div>
          <Badge className="ml-auto bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20 text-xs">
            {instances?.filter(i => i.status === 'connected').length ?? 0} conectado(s)
          </Badge>
        </div>

        <div className="p-5 space-y-3">
          {/* Instance list */}
          {isLoading && <p className="text-sm text-neutral-400">Carregando...</p>}
          {instances?.map(inst => (
            <div key={inst.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/[0.06] group">
              <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{inst.name}</p>
                <p className="text-xs text-neutral-400">{inst.phoneNumber ?? 'Sem número'}</p>
              </div>
              <Badge className={`text-xs ${statusColor(inst.status)}`}>
                {inst.status === 'connected' || inst.status === 'open' ? 'Conectado' : inst.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </Badge>
              {inst.status !== 'connected' && inst.status !== 'open' && (
                <Button size="sm" variant="outline" onClick={() => showQr(inst.name)} disabled={qrLoading}
                  className="text-xs cursor-pointer border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10">
                  <QrCode className="h-3.5 w-3.5 mr-1" /> QR Code
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => deleteInst(inst.name)}
                className="h-8 w-8 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* QR Code display */}
          {qrData && (
            <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-green-200 dark:border-green-500/20">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                Escaneie o QR Code com WhatsApp — <span className="text-green-600 dark:text-green-400">{qrData.name}</span>
              </p>
              <div className="bg-white p-4 rounded-xl">
                <img src={qrData.base64} alt="QR Code WhatsApp" className="w-64 h-64" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => showQr(qrData.name)} className="text-xs cursor-pointer">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar QR
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setQrData(null)} className="text-xs cursor-pointer">
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {/* Add instance */}
          <div className="flex gap-2 pt-3 border-t border-neutral-200 dark:border-white/[0.06]">
            <Input placeholder="Nome da instância (ex: vendas-01)" value={newName} onChange={e => setNewName(e.target.value)}
              className="bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 h-9 text-sm"
              onKeyDown={e => e.key === 'Enter' && createNewInstance()} />
            <Button onClick={createNewInstance} disabled={creating} className="bg-green-600 hover:bg-green-700 text-white cursor-pointer h-9 px-4 text-sm">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" /> Conectar</>}
            </Button>
          </div>
        </div>
      </div>

      {/* ============ INSTAGRAM ============ */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
            <Instagram className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Instagram DM</h2>
            <p className="text-xs text-neutral-400">Meta Graph API v21</p>
          </div>
          <Badge className="ml-auto bg-neutral-100 dark:bg-white/5 text-neutral-500 border-neutral-200 dark:border-white/10 text-xs">
            {process.env.NEXT_PUBLIC_INSTAGRAM_CONFIGURED === 'true' ? 'Configurado' : 'Não configurado'}
          </Badge>
        </div>
        <div className="p-5">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            Configure as variáveis no arquivo <code className="text-xs bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">.env</code>:
          </p>
          <div className="space-y-1.5 text-xs font-mono text-neutral-500 bg-neutral-50 dark:bg-white/[0.02] rounded-lg p-3 border border-neutral-200 dark:border-white/[0.06]">
            <p>INSTAGRAM_ACCESS_TOKEN=seu_token</p>
            <p>INSTAGRAM_PAGE_ID=seu_page_id</p>
            <p>INSTAGRAM_VERIFY_TOKEN=autoscar-ig-verify</p>
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            O webhook de Instagram deve apontar para: <code className="bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">https://seu-dominio/api/webhook/instagram</code>
          </p>
        </div>
      </div>

      {/* ============ SMS ============ */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">SMS</h2>
            <p className="text-xs text-neutral-400">Twilio — Follow-up automático</p>
          </div>
          <Badge className="ml-auto bg-neutral-100 dark:bg-white/5 text-neutral-500 border-neutral-200 dark:border-white/10 text-xs">
            {process.env.NEXT_PUBLIC_TWILIO_CONFIGURED === 'true' ? 'Configurado' : 'Não configurado'}
          </Badge>
        </div>
        <div className="p-5">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            Configure as variáveis no arquivo <code className="text-xs bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">.env</code>:
          </p>
          <div className="space-y-1.5 text-xs font-mono text-neutral-500 bg-neutral-50 dark:bg-white/[0.02] rounded-lg p-3 border border-neutral-200 dark:border-white/[0.06]">
            <p>TWILIO_ACCOUNT_SID=seu_sid</p>
            <p>TWILIO_AUTH_TOKEN=seu_token</p>
            <p>TWILIO_FROM_NUMBER=+5511999999999</p>
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            SMS é enviado automaticamente como follow-up após 2 tentativas por WhatsApp sem resposta.
          </p>
        </div>
      </div>
    </div>
  );
}
