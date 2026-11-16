/**
 * Evolution GO client (https://github.com/EvolutionAPI/evolution-go)
 *
 * Auth model:
 *  - Admin routes (/instance/create, /instance/all, /instance/delete) use the
 *    GLOBAL key (EVOLUTION_API_KEY) in the `apikey` header.
 *  - Every other route acts on ONE instance, selected by sending that
 *    instance's own token in the `apikey` header (no instance name in the URL).
 *
 * We keep instance names as the identifier in our DB and resolve name -> token
 * via /instance/all (cached). The public method signatures are unchanged so
 * callers don't need to know which Evolution flavor is behind it.
 */
import axios, { type AxiosInstance } from 'axios';
import { randomUUID } from 'node:crypto';

interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
}

interface SendTextResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  status: string;
}

interface GoInstance {
  id: string;
  name: string;
  token: string;
  webhook: string;
  events: string;
  jid: string;
  connected: boolean;
}

/** Events we subscribe to on Evolution GO */
export const EVOLUTION_GO_EVENTS = ['MESSAGE', 'CONNECTION'];

function http(apiKey: string): AxiosInstance {
  const baseURL = process.env.EVOLUTION_API_URL;
  if (!baseURL) throw new Error('EVOLUTION_API_URL must be set');
  return axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    timeout: 20000,
  });
}

function admin(): AxiosInstance {
  const key = process.env.EVOLUTION_API_KEY;
  if (!process.env.EVOLUTION_API_URL || !key) {
    throw new Error('EVOLUTION_API_URL and EVOLUTION_API_KEY must be set');
  }
  return http(key);
}

// ---- name -> instance (token/id) resolution ----
const instanceCache = new Map<string, GoInstance>();

async function fetchAll(): Promise<GoInstance[]> {
  const { data } = await admin().get('/instance/all');
  const list: GoInstance[] = Array.isArray(data?.data) ? data.data : [];
  instanceCache.clear();
  for (const inst of list) instanceCache.set(inst.name, inst);
  return list;
}

async function resolve(instanceName: string, fresh = false): Promise<GoInstance> {
  if (!fresh) {
    const cached = instanceCache.get(instanceName);
    if (cached) return cached;
  }
  await fetchAll();
  const inst = instanceCache.get(instanceName);
  if (!inst) throw new Error(`Evolution GO instance not found: ${instanceName}`);
  return inst;
}

async function forInstance(instanceName: string): Promise<AxiosInstance> {
  const inst = await resolve(instanceName);
  return http(inst.token);
}

export const evolutionClient = {
  /**
   * Create a new instance (webhook/connection is started by setWebhook)
   */
  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    const { data } = await admin().post('/instance/create', {
      name: instanceName,
      token: randomUUID(),
      advancedSettings: {
        alwaysOnline: false,
        rejectCall: false,
        msgRejectCall: '',
        readMessages: false,
        ignoreGroups: true,
        ignoreStatus: true,
      },
    });
    const created = data?.data ?? {};
    if (created?.name) instanceCache.set(created.name, created);
    return {
      instance: {
        instanceName: created.name ?? instanceName,
        instanceId: created.id ?? '',
        status: 'created',
      },
    };
  },

  /**
   * Get QR code for connecting WhatsApp (base64 data URL)
   */
  async getQrCode(instanceName: string): Promise<string> {
    const client = await forInstance(instanceName);
    // The QR takes a few seconds to be generated after the instance starts
    let lastErr: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const { data } = await client.get('/instance/qr');
        const raw: string = data?.data?.qrcode ?? '';
        // Evolution GO stores "data:image/png;base64,...|<raw code>"
        const base64 = raw.split('|')[0];
        if (base64) return base64;
      } catch (err) {
        lastErr = err;
        const msg = (err as any)?.response?.data?.error ?? '';
        if (String(msg).includes('already logged in')) throw err;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw lastErr ?? new Error('QR code not available');
  },

  /**
   * Connection state, normalized to Evolution v2 vocabulary: 'open' | 'close'
   */
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const client = await forInstance(instanceName);
      const { data } = await client.get('/instance/status');
      const s = data?.data ?? {};
      return s.Connected && s.LoggedIn ? 'open' : 'close';
    } catch {
      return 'disconnected';
    }
  },

  /**
   * Set webhook URL. On Evolution GO the webhook is configured through
   * /instance/connect, which also starts the instance if it isn't running.
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    const client = await forInstance(instanceName);
    await client.post('/instance/connect', {
      webhookUrl,
      subscribe: EVOLUTION_GO_EVENTS,
      immediate: true,
    });
    await resolve(instanceName, true).catch(() => undefined);
  },

  /**
   * Send text message (number can be digits or a full JID, incl. groups @g.us)
   */
  async sendText(instanceName: string, to: string, text: string): Promise<SendTextResponse> {
    const client = await forInstance(instanceName);
    const { data } = await client.post('/send/text', { number: to, text });
    const info = data?.data?.Info ?? {};
    return {
      key: {
        remoteJid: info.Chat ?? to,
        fromMe: true,
        id: info.ID ?? '',
      },
      status: data?.message ?? 'success',
    };
  },

  /**
   * Fetch a contact's profile name. WhatsApp only exposes names for verified
   * business accounts here, so this usually returns name=null.
   */
  async fetchProfile(instanceName: string, jid: string): Promise<{ name: string | null; pictureUrl: string | null } | null> {
    try {
      const client = await forInstance(instanceName);
      const { data } = await client.post('/user/info', { number: [jid] });
      const users = data?.data?.Users ?? {};
      const first: any = Object.values(users)[0];
      const name = first?.VerifiedName?.Details?.verifiedName ?? null;
      return { name, pictureUrl: null };
    } catch {
      return null;
    }
  },

  /**
   * Send media (image) with optional caption
   */
  async sendMedia(
    instanceName: string,
    to: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<void> {
    const client = await forInstance(instanceName);
    await client.post('/send/media', {
      number: to,
      type: 'image',
      url: mediaUrl,
      caption: caption ?? '',
      filename: 'veiculo.jpg',
    });
  },

  /**
   * List all instances
   */
  async listInstances(): Promise<{ instanceName: string; status: string }[]> {
    try {
      const list = await fetchAll();
      return list.map((i) => ({ instanceName: i.name, status: i.connected ? 'open' : 'close' }));
    } catch {
      return [];
    }
  },

  /**
   * Delete an instance
   */
  async deleteInstance(instanceName: string): Promise<void> {
    const inst = await resolve(instanceName, true);
    await admin().delete(`/instance/delete/${inst.id}`);
    instanceCache.delete(instanceName);
  },

  /**
   * Logout (disconnect) without deleting
   */
  async logoutInstance(instanceName: string): Promise<void> {
    const client = await forInstance(instanceName);
    await client.delete('/instance/logout');
  },

  /**
   * Instance profile info (number, name)
   */
  async getInstanceInfo(instanceName: string): Promise<{ profileName: string; phoneNumber: string; profilePictureUrl: string | null }> {
    try {
      const inst = await resolve(instanceName, true);
      let profileName = '';
      try {
        const { data } = await http(inst.token).get('/instance/status');
        profileName = data?.data?.Name ?? '';
      } catch {}
      // jid looks like "5511999999999:14@s.whatsapp.net"
      const phoneNumber = (inst.jid || '').split('@')[0].split(':')[0];
      return { profileName, phoneNumber, profilePictureUrl: null };
    } catch {
      return { profileName: '', phoneNumber: '', profilePictureUrl: null };
    }
  },

  /**
   * Fetch all WhatsApp groups the instance participates in
   */
  async fetchGroups(instanceName: string): Promise<{ id: string; subject: string; size: number }[]> {
    try {
      const client = await forInstance(instanceName);
      const { data } = await client.get('/group/list');
      const list = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.data?.Groups) ? data.data.Groups : [];
      return list.map((g: any) => ({
        id: g.JID ?? g.jid ?? '',
        subject: g.Name ?? g.GroupName ?? g.name ?? 'Sem nome',
        size: Array.isArray(g.Participants) ? g.Participants.length : 0,
      }));
    } catch (err) {
      console.error(`[evolution] Failed to fetch groups for ${instanceName}:`, err);
      return [];
    }
  },

  /**
   * Current webhook configuration for an instance
   */
  async getWebhook(instanceName: string): Promise<{
    enabled: boolean;
    url: string | null;
    events: string[];
  } | null> {
    try {
      const inst = await resolve(instanceName, true);
      return {
        enabled: !!inst.webhook,
        url: inst.webhook || null,
        events: (inst.events || '').split(',').filter(Boolean),
      };
    } catch (err) {
      console.error(`[evolution] Failed to get webhook for ${instanceName}:`, err);
      return null;
    }
  },
};
