'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Plus, Trash2, QrCode, RefreshCw, Loader2, MessageSquare, Instagram, Smartphone, Search, Users, Copy, Check } from 'lucide-react';

interface WhatsAppInstance {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  createdAt: string;
}

interface InstanceInfo {
  profileName: string;
  phoneNumber: string;
  profilePictureUrl: string | null;
}

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrData, setQrData] = useState<{ name: string; base64: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupInstance, setGroupInstance] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ id: string; subject: string; size: number }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [instanceInfos, setInstanceInfos] = useState<Record<string, InstanceInfo>>({});
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [webhookConfigured, setWebhookConfigured] = useState(false);

  // Fetch current webhook URL on load
  useEffect(() => {
    api.get<{ webhookUrl: string | null; configured: boolean }>('/instances/webhook-url')
      .then(res => {
        if (res.webhookUrl) setWebhookUrlInput(res.webhookUrl);
        setWebhookConfigured(res.configured);
      })
      .catch(() => {});
  }, []);

  const { data: instances, isLoading } = useQuery<WhatsAppInstance[]>({
    queryKey: ['instances'],
    queryFn: () => api.get('/instances'),
    refetchInterval: 10000,
  });

  // Auto-close QR when instance connects + fetch profile info
  useEffect(() => {
    if (!instances) return;
    if (qrData) {
      const inst = instances.find(i => i.name === qrData.name);
      if (inst?.status === 'connected') setQrData(null);
    }
    // Fetch profile info for connected instances
    instances.forEach(inst => {
      if ((inst.status === 'connected' || inst.status === 'open') && !instanceInfos[inst.name]) {
        api.get<InstanceInfo>(`/instances/${inst.name}/info`)
          .then(info => setInstanceInfos(prev => ({ ...prev, [inst.name]: info })))
          .catch(() => {});
      }
    });
  }, [instances, qrData]);

  const createNewInstance = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/instances', { name: newName.trim(), webhookUrl: webhookUrlInput || undefined });
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

      {/* ============ WEBHOOK URL CONFIG ============ */}
      {!webhookConfigured && (
        <div className="bg-yellow-50 dark:bg-yellow-500/5 rounded-xl border border-yellow-200 dark:border-yellow-500/20 p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <RefreshCw className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Configurar URL do Webhook</h3>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 mb-3">
                Para receber mensagens, informe o URL público onde esta aplicação está acessível.
                Exemplo: <code className="bg-yellow-100 dark:bg-yellow-500/10 px-1 rounded">https://seudominio.com/api</code>
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://seudominio.com/api"
                  value={webhookUrlInput}
                  onChange={e => setWebhookUrlInput(e.target.value)}
                  className="bg-white dark:bg-white/5 border-yellow-200 dark:border-yellow-500/20 h-9 text-sm flex-1"
                />
                <Button
                  onClick={async () => {
                    if (!webhookUrlInput) return;
                    // Reconfigure webhook on all connected instances
                    const insts = instances?.filter(i => i.status === 'connected' || i.status === 'open') ?? [];
                    for (const inst of insts) {
                      await api.post(`/instances/${inst.name}/webhook`, { webhookUrl: webhookUrlInput }).catch(() => {});
                    }
                    setWebhookConfigured(true);
                    alert(`Webhook configurado em ${insts.length} instância(s). Adicione WEBHOOK_URL=${webhookUrlInput} no .env para persistir.`);
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white cursor-pointer h-9 px-4 text-sm"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {instances?.map(inst => {
            const info = instanceInfos[inst.name];
            const isConnected = inst.status === 'connected' || inst.status === 'open';
            return (
            <div key={inst.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/[0.06] group">
              {info?.profilePictureUrl ? (
                <img src={info.profilePictureUrl} alt={info.profileName} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{inst.name}</p>
                  {info?.profileName && <span className="text-xs text-neutral-400">({info.profileName})</span>}
                </div>
                <p className="text-xs text-neutral-400 font-mono">
                  {info?.phoneNumber ? `+${info.phoneNumber}` : inst.phoneNumber ? `+${inst.phoneNumber}` : isConnected ? 'Carregando...' : 'Sem número'}
                </p>
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
          ); })}

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

          {/* Group Search */}
          {instances && instances.some(i => i.status === 'connected' || i.status === 'open') && (
            <div className="rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/[0.06] flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Buscar Grupo pelo Nome</h3>
                <span className="text-xs text-neutral-400 ml-1">(para configurar grupo de vendedores)</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  {instances.filter(i => i.status === 'connected' || i.status === 'open').length > 1 ? (
                    <select
                      value={groupInstance ?? ''}
                      onChange={e => setGroupInstance(e.target.value || null)}
                      className="bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg h-9 px-3 text-sm text-neutral-800 dark:text-neutral-200"
                    >
                      <option value="">Selecione instância</option>
                      {instances.filter(i => i.status === 'connected' || i.status === 'open').map(i => (
                        <option key={i.id} value={i.name}>{i.name}</option>
                      ))}
                    </select>
                  ) : null}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                    <Input
                      placeholder="Nome do grupo..."
                      value={groupSearch}
                      onChange={e => setGroupSearch(e.target.value)}
                      className="pl-9 bg-white dark:bg-white/5 border-neutral-200 dark:border-white/10 h-9 text-sm"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const instName = groupInstance ?? instances.find(i => i.status === 'connected' || i.status === 'open')?.name;
                          if (instName) {
                            setGroupsLoading(true);
                            api.get<{ id: string; subject: string; size: number }[]>(
                              `/instances/${instName}/groups?search=${encodeURIComponent(groupSearch)}`
                            ).then(setGroups).catch(() => setGroups([])).finally(() => setGroupsLoading(false));
                          }
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const instName = groupInstance ?? instances.find(i => i.status === 'connected' || i.status === 'open')?.name;
                      if (instName) {
                        setGroupsLoading(true);
                        api.get<{ id: string; subject: string; size: number }[]>(
                          `/instances/${instName}/groups?search=${encodeURIComponent(groupSearch)}`
                        ).then(setGroups).catch(() => setGroups([])).finally(() => setGroupsLoading(false));
                      }
                    }}
                    disabled={groupsLoading}
                    className="bg-green-600 hover:bg-green-700 text-white cursor-pointer h-9 px-4 text-sm"
                  >
                    {groupsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Search className="h-3.5 w-3.5 mr-1" /> Buscar</>}
                  </Button>
                </div>

                {/* Group results */}
                {groups.length > 0 && (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {groups.map(group => (
                      <div key={group.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] hover:border-green-300 dark:hover:border-green-500/30 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                          <Users className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{group.subject}</p>
                          <p className="text-[11px] text-neutral-400 font-mono truncate">{group.id}</p>
                        </div>
                        <Badge className="bg-neutral-100 dark:bg-white/5 text-neutral-500 border-neutral-200 dark:border-white/10 text-[10px]">
                          {group.size} membros
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(group.id);
                            setCopiedId(group.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="text-xs cursor-pointer h-7 px-2 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                        >
                          {copiedId === group.id ? <><Check className="h-3 w-3 mr-1" /> Copiado</> : <><Copy className="h-3 w-3 mr-1" /> Copiar JID</>}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {groups.length === 0 && !groupsLoading && groupSearch && (
                  <p className="text-xs text-neutral-400 text-center py-3">Nenhum grupo encontrado. Deixe vazio para listar todos.</p>
                )}

                <p className="text-[11px] text-neutral-400">
                  Copie o JID do grupo e cole no campo &quot;Grupo WhatsApp Vendedores&quot; nas configurações do Agente IA.
                </p>
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
