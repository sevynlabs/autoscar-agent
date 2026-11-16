import type { FastifyPluginAsync } from 'fastify';
import { getMessageQueue } from '../../queue/queues.js';
import prisma from '../../db/prisma.js';
import type { MessageJobData } from '../../queue/jobs/message.job.js';

function extractPhone(remoteJid: string): string {
  // Handle both @s.whatsapp.net and @lid formats
  return remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
}

function extractText(msg: any): string | null {
  if (!msg) return null;
  // Evolution v2 various message formats
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    null
  );
}

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhook/whatsapp', async (request, reply) => {
    const body = request.body as any;
    const event = body.event;
    // Evolution v2 sends `instance`; Evolution GO sends `instanceName`
    const instance = body.instance ?? body.instanceName;

    // Log all incoming events for debugging
    console.log(JSON.stringify({
      level: 'debug',
      msg: '[webhook] Event received',
      event,
      instance,
      hasData: !!body.data,
      dataKeys: body.data ? Object.keys(body.data) : [],
    }));

    fastify.log.info({ event, instance }, 'Webhook received');

    // ---- CONNECTION_UPDATE ----
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = body.data?.state;
      if (state) {
        const status = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting';
        await prisma.whatsAppInstance.updateMany({ where: { name: instance }, data: { status } });
        fastify.log.info({ instance, state: status }, 'Connection updated');
      }
      return reply.send({ status: 'connection_updated' });
    }

    // ---- QRCODE ----
    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
      return reply.send({ status: 'qr_acknowledged' });
    }

    // ---- MESSAGES (upsert, update, set) ----
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      // Evolution v2 sends data as array or object
      const messages = Array.isArray(body.data) ? body.data : [body.data];

      for (const msg of messages) {
        const key = msg.key ?? msg;
        const remoteJid = key.remoteJid ?? '';
        const fromMe = key.fromMe ?? false;
        const messageId = key.id ?? `${Date.now()}`;

        // Skip self, group, status
        if (fromMe) continue;
        if (remoteJid.endsWith('@g.us')) continue;
        if (remoteJid === 'status@broadcast') continue;

        const text = extractText(msg) ?? extractText(msg.message);
        if (!text) continue;

        const phoneNumber = extractPhone(remoteJid);
        const pushName = typeof msg.pushName === 'string' ? msg.pushName.trim() || undefined : undefined;

        fastify.log.info({ phone: phoneNumber, preview: text.substring(0, 50), messageId, pushName }, 'Message received');

        const jobData: MessageJobData = {
          instance,
          phoneNumber,
          message: text,
          messageId,
          pushName,
        };

        const queue = getMessageQueue();
        await queue.add('incoming-message', jobData, {
          jobId: `msg-${instance}-${messageId}`,
          removeOnComplete: 100,
          removeOnFail: 50,
        });
      }

      return reply.send({ status: 'queued' });
    }

    // ================= Evolution GO =================

    // ---- GO: connection events ----
    if (event === 'Connected' || event === 'PairSuccess') {
      await prisma.whatsAppInstance.updateMany({ where: { name: instance }, data: { status: 'connected' } });
      fastify.log.info({ instance, state: 'connected' }, 'Connection updated');
      return reply.send({ status: 'connection_updated' });
    }
    if (event === 'LoggedOut' || event === 'Disconnected' || event === 'ConnectFailure' || event === 'TemporaryBan') {
      await prisma.whatsAppInstance.updateMany({ where: { name: instance }, data: { status: 'disconnected' } });
      fastify.log.info({ instance, state: 'disconnected', event }, 'Connection updated');
      return reply.send({ status: 'connection_updated' });
    }

    // ---- GO: incoming message ----
    if (event === 'Message') {
      const info = body.data?.Info ?? {};
      const chat: string = info.Chat ?? '';
      const messageId: string = info.ID ?? `${Date.now()}`;

      if (info.IsFromMe) return reply.send({ status: 'ignored_self' });
      if (info.IsGroup || chat.endsWith('@g.us')) return reply.send({ status: 'ignored_group' });
      if (chat === 'status@broadcast' || chat.endsWith('@newsletter')) return reply.send({ status: 'ignored' });

      const text = extractText(body.data?.Message);
      if (!text) return reply.send({ status: 'ignored_non_text' });

      // Prefer the real phone JID when the chat comes as @lid
      let jid = chat;
      if (jid.endsWith('@lid')) {
        const alt = [info.SenderAlt, info.Sender].find(
          (j: unknown) => typeof j === 'string' && j.endsWith('@s.whatsapp.net'),
        );
        if (alt) jid = alt;
      }
      const phoneNumber = extractPhone(jid.replace(/:\d+@/, '@'));
      const pushName = typeof info.PushName === 'string' ? info.PushName.trim() || undefined : undefined;

      fastify.log.info({ phone: phoneNumber, preview: text.substring(0, 50), messageId, pushName }, 'Message received');

      const jobData: MessageJobData = {
        instance,
        phoneNumber,
        message: text,
        messageId,
        pushName,
      };

      await getMessageQueue().add('incoming-message', jobData, {
        jobId: `msg-${instance}-${messageId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      return reply.send({ status: 'queued' });
    }

    // ---- Ignore other events ----
    return reply.send({ status: 'ignored', event });
  });

  // ---- Cloud API Webhook Verification (GET) ----
  fastify.get<{
    Querystring: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string }
  }>('/webhook/cloud-api', async (request, reply) => {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'autoscar-verify-token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[cloud-api-webhook] Verification successful');
      return reply.send(challenge);
    }

    console.warn('[cloud-api-webhook] Verification failed', { mode, token });
    return reply.status(403).send('Forbidden');
  });

  // ---- Cloud API Webhook Messages (POST) ----
  fastify.post('/webhook/cloud-api', async (request, reply) => {
    const body = request.body as any;

    console.log(JSON.stringify({
      level: 'debug',
      msg: '[cloud-api-webhook] Event received',
      hasEntry: !!body?.entry,
    }));

    // Meta sends messages in entry[].changes[].value.messages[]
    const entries = body?.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        if (!value) continue;

        // Get phone number ID to find the instance
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Find instance by phoneNumberId
        const instance = await prisma.whatsAppInstance.findFirst({
          where: { phoneNumberId, provider: 'cloud_api' },
        });

        if (!instance) {
          console.warn('[cloud-api-webhook] No instance found for phoneNumberId:', phoneNumberId);
          continue;
        }

        // Process incoming messages
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const msg of messages) {
          // Skip non-text messages for now
          if (msg.type !== 'text') continue;

          const from = msg.from; // Phone number of sender
          const text = msg.text?.body;
          const messageId = msg.id;

          if (!text || !from) continue;

          // Get contact name if available
          const contact = contacts.find((c: any) => c.wa_id === from);
          const pushName = contact?.profile?.name || undefined;

          console.log(JSON.stringify({
            level: 'info',
            msg: '[cloud-api-webhook] Message received',
            from,
            preview: text.substring(0, 50),
            messageId,
          }));

          const jobData: MessageJobData = {
            instance: instance.name,
            phoneNumber: from,
            message: text,
            messageId,
            pushName,
          };

          const queue = getMessageQueue();
          await queue.add('incoming-message', jobData, {
            jobId: `msg-${instance.name}-${messageId}`,
            removeOnComplete: 100,
            removeOnFail: 50,
          });
        }

        // Process status updates (delivery, read receipts)
        const statuses = value.statuses || [];
        for (const status of statuses) {
          console.log(JSON.stringify({
            level: 'debug',
            msg: '[cloud-api-webhook] Status update',
            messageId: status.id,
            status: status.status,
            recipient: status.recipient_id,
          }));
        }
      }
    }

    // Meta requires 200 response
    return reply.send({ status: 'ok' });
  });
};

export default webhookRoutes;
