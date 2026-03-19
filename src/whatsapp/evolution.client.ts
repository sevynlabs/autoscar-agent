import axios, { type AxiosInstance } from 'axios';

interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
}

interface QrCodeResponse {
  base64: string;
  code: string;
}

interface SendTextResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  status: string;
}

interface ConnectionState {
  instance: {
    instanceName: string;
    state: string; // 'open' | 'close' | 'connecting'
  };
}

function getClient(): AxiosInstance {
  const baseURL = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error('EVOLUTION_API_URL and EVOLUTION_API_KEY must be set');
  }

  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    timeout: 15000,
  });
}

export const evolutionClient = {
  /**
   * Create a new WhatsApp instance using Baileys (QR code only, no API key needed from user)
   */
  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    const client = getClient();
    const { data } = await client.post<CreateInstanceResponse>('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      rejectCall: false,
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    });
    return data;
  },

  /**
   * Get QR code for connecting WhatsApp (base64 image)
   */
  async getQrCode(instanceName: string): Promise<string> {
    const client = getClient();
    const { data } = await client.get<QrCodeResponse>(
      `/instance/connect/${instanceName}`,
    );
    return data.base64;
  },

  /**
   * Get connection status of an instance
   */
  async getConnectionState(instanceName: string): Promise<string> {
    const client = getClient();
    try {
      const { data } = await client.get<ConnectionState>(
        `/instance/connectionState/${instanceName}`,
      );
      return data.instance?.state ?? 'unknown';
    } catch {
      return 'disconnected';
    }
  },

  /**
   * Set webhook URL for incoming messages
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    const client = getClient();
    await client.post(`/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ],
      },
    });
  },

  /**
   * Send text message via WhatsApp
   */
  async sendText(instanceName: string, to: string, text: string): Promise<SendTextResponse> {
    const client = getClient();
    const { data } = await client.post<SendTextResponse>(
      `/message/sendText/${instanceName}`,
      { number: to, text },
    );
    return data;
  },

  /**
   * Send media (image) via WhatsApp with optional caption
   */
  async sendMedia(
    instanceName: string,
    to: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<void> {
    const client = getClient();
    await client.post(`/message/sendMedia/${instanceName}`, {
      number: to,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media: mediaUrl,
      caption: caption ?? '',
      fileName: 'veiculo.jpg',
    });
  },

  /**
   * List all instances from Evolution API
   */
  async listInstances(): Promise<{ instanceName: string; status: string }[]> {
    const client = getClient();
    try {
      const { data } = await client.get('/instance/fetchInstances');
      if (Array.isArray(data)) {
        return data.map((i: any) => ({
          instanceName: i.instance?.instanceName ?? i.instanceName ?? 'unknown',
          status: i.instance?.status ?? i.status ?? 'unknown',
        }));
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Delete/logout an instance
   */
  async deleteInstance(instanceName: string): Promise<void> {
    const client = getClient();
    await client.delete(`/instance/delete/${instanceName}`);
  },

  /**
   * Logout (disconnect) without deleting
   */
  async logoutInstance(instanceName: string): Promise<void> {
    const client = getClient();
    await client.delete(`/instance/logout/${instanceName}`);
  },

  /**
   * Get instance profile info (number, name, picture)
   */
  async getInstanceInfo(instanceName: string): Promise<{ profileName: string; phoneNumber: string; profilePictureUrl: string | null }> {
    const client = getClient();
    try {
      const { data } = await client.get(`/instance/fetchInstances`, {
        params: { instanceName },
      });
      const inst = Array.isArray(data) ? data[0] : data;
      return {
        profileName: inst?.instance?.profileName ?? inst?.profileName ?? '',
        phoneNumber: inst?.instance?.owner?.split('@')[0] ?? inst?.owner?.split('@')[0] ?? '',
        profilePictureUrl: inst?.instance?.profilePictureUrl ?? inst?.profilePictureUrl ?? null,
      };
    } catch {
      return { profileName: '', phoneNumber: '', profilePictureUrl: null };
    }
  },

  /**
   * Fetch all WhatsApp groups for an instance
   */
  async fetchGroups(instanceName: string): Promise<{ id: string; subject: string; size: number }[]> {
    const client = getClient();
    try {
      const { data } = await client.get(`/group/fetchAllGroups/${instanceName}?getParticipants=false`);
      if (Array.isArray(data)) {
        return data.map((g: any) => ({
          id: g.id ?? g.jid ?? '',
          subject: g.subject ?? g.name ?? 'Sem nome',
          size: g.size ?? g.participants?.length ?? 0,
        }));
      }
      return [];
    } catch (err) {
      console.error(`[evolution] Failed to fetch groups for ${instanceName}:`, err);
      return [];
    }
  },
};
