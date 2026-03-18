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

interface InstanceInfo {
  instance: {
    instanceName: string;
    instanceId: string;
    owner: string;
    profileName: string;
    profilePictureUrl: string | null;
    status: string;
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
  });
}

export const evolutionClient = {
  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    const client = getClient();
    const { data } = await client.post<CreateInstanceResponse>('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
    });
    return data;
  },

  async getQrCode(instanceName: string): Promise<string> {
    const client = getClient();
    const { data } = await client.get<QrCodeResponse>(
      `/instance/connect/${instanceName}`,
    );
    return data.base64;
  },

  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    const client = getClient();
    await client.post(`/webhook/set/${instanceName}`, {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    });
  },

  async sendText(instanceName: string, to: string, text: string): Promise<SendTextResponse> {
    const client = getClient();
    const { data } = await client.post<SendTextResponse>(
      `/message/sendText/${instanceName}`,
      { number: to, text },
    );
    return data;
  },

  async listInstances(): Promise<InstanceInfo[]> {
    const client = getClient();
    const { data } = await client.get<InstanceInfo[]>('/instance/fetchInstances');
    return data;
  },
};
