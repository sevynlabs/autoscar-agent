import { FastifyInstance } from 'fastify';
import { getMessageQueue } from '../../queue/queues.js';

export default async function instagramWebhookRoutes(fastify: FastifyInstance) {
  // GET /webhook/instagram — Meta verification
  fastify.get('/webhook/instagram', async (request, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
      request.query as Record<string, string>;

    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'autoscar-ig-verify';
    if (mode === 'subscribe' && token === verifyToken) {
      return reply.send(challenge);
    }
    return reply.code(403).send('Forbidden');
  });

  // POST /webhook/instagram — Incoming DMs
  fastify.post('/webhook/instagram', async (request, reply) => {
    const body = request.body as any;

    // Process messaging events
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      const messaging = entry.messaging ?? [];
      for (const event of messaging) {
        if (event.message?.text) {
          const queue = getMessageQueue();
          await queue.add('instagram-message', {
            channel: 'instagram',
            instance: 'instagram-default',
            phoneNumber: event.sender.id,
            message: event.message.text,
            instanceName: 'instagram',
          });
        }
      }
    }

    return reply.send('EVENT_RECEIVED');
  });
}
