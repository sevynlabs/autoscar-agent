import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import prisma from '../../db/prisma.js';
import { loadOrCreateConversation } from '../../conversation/conversation.service.js';
import { runAgentTurn } from '../../agent/agent.service.js';
import { runPostTurn } from '../../conversation/post-turn.js';
import { emitNewMessage, emitConversationUpdated, emitLeadCreated } from '../../realtime/emitter.js';
import { getVehicleData } from '../../scraper/scraper.service.js';

const WEBCHAT_CHANNEL = 'webchat';

interface WebchatAgentConfig {
  id: string;
  webchatEnabled: boolean;
  webchatTitle: string | null;
  webchatSubtitle: string | null;
  webchatBrandColor: string | null;
  webchatAvatarUrl: string | null;
  webchatWelcome: string | null;
  welcomeMessage: string | null;
  name: string;
  triggerVehicleUrls: string[];
  triggerVehicleCodes: string[];
}

async function getWebchatAgent(): Promise<WebchatAgentConfig | null> {
  return prisma.agent.findFirst({
    where: { active: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      webchatEnabled: true,
      webchatTitle: true,
      webchatSubtitle: true,
      webchatBrandColor: true,
      webchatAvatarUrl: true,
      webchatWelcome: true,
      welcomeMessage: true,
      name: true,
      triggerVehicleUrls: true,
      triggerVehicleCodes: true,
    },
  });
}

const SHORT_LINK_BASE = 'https://www.autoscar.com.br/carros/';

/**
 * Resolve which vehicle the lead is asking about, from the ad link query:
 *  - ?carro=<full url>  → use it directly
 *  - ?codigo=<code>     → 1) a code registered on the agent wins (custom map);
 *                          2) otherwise treat it as the autoscar ad ID and
 *                             resolve the canonical vehicle URL via the API,
 *                             so EVERY ad just needs ?codigo=<adId> with no
 *                             pre-registration. Falls back to the short link
 *                             autoscar.com.br/carros/<adId> (still scrapeable).
 *  - nothing            → fall back to the single trigger URL if there's one
 */
async function resolveVehicleUrl(
  agent: WebchatAgentConfig | null,
  carro?: string,
  codigo?: string,
): Promise<string | null> {
  if (carro && /^https?:\/\//i.test(carro)) return carro.trim();

  const code = codigo?.trim();
  if (code) {
    // 1. Custom mapping registered on the agent takes priority.
    if (agent) {
      const idx = agent.triggerVehicleCodes.findIndex((c) => c.trim() === code);
      if (idx >= 0 && agent.triggerVehicleUrls[idx]) {
        return agent.triggerVehicleUrls[idx].trim();
      }
    }

    // 2. Any numeric autoscar ad ID — resolve the real vehicle URL.
    if (/^\d{3,}$/.test(code)) {
      try {
        const result = await getVehicleData(code);
        if (result.fullUrl) return result.fullUrl;
      } catch {
        /* fall through to the short link below */
      }
      return `${SHORT_LINK_BASE}${code}`;
    }
  }

  if (agent?.triggerVehicleUrls.length === 1) {
    return agent.triggerVehicleUrls[0].trim();
  }

  return null;
}

const webchatRoutes: FastifyPluginAsync = async (fastify) => {
  // ---- Public branding/config for the /atendimento page ----
  fastify.get('/webchat/config', async (request) => {
    const { carro, codigo } = request.query as { carro?: string; codigo?: string };
    const agent = await getWebchatAgent();

    const vehicleUrl = await resolveVehicleUrl(agent, carro, codigo);

    return {
      enabled: agent?.webchatEnabled ?? false,
      title: agent?.webchatTitle?.trim() || agent?.name || 'Autoscar',
      subtitle: agent?.webchatSubtitle?.trim() || 'online',
      brandColor: agent?.webchatBrandColor?.trim() || '#075E54',
      avatarUrl: agent?.webchatAvatarUrl?.trim() || null,
      welcome:
        agent?.webchatWelcome?.trim() ||
        agent?.welcomeMessage?.trim() ||
        null,
      vehicleUrl,
    };
  });

  // ---- Start (or describe) a session ----
  fastify.post('/webchat/session', async (request, reply) => {
    const body = (request.body ?? {}) as { carro?: string; codigo?: string };
    const agent = await getWebchatAgent();

    if (!agent || !agent.webchatEnabled) {
      return reply.code(403).send({ error: 'Atendimento web indisponível no momento.' });
    }

    const vehicleUrl = await resolveVehicleUrl(agent, body.carro, body.codigo);

    const sessionId = `web:${randomUUID()}`;
    const conversation = await loadOrCreateConversation(sessionId, WEBCHAT_CHANNEL);

    // Anchor the conversation to the ad's vehicle so the agent talks about it.
    if (vehicleUrl && conversation.lead && !conversation.lead.vehicleUrl?.trim()) {
      await prisma.lead
        .update({ where: { id: conversation.lead.id }, data: { vehicleUrl } })
        .catch(() => {});
      conversation.lead.vehicleUrl = vehicleUrl;
    }

    if (conversation.lead) emitLeadCreated({ id: conversation.lead.id });

    // Typebot-style opener: run one agent turn with a hidden seed message so
    // the agent greets and presents the vehicle exactly like a real first
    // WhatsApp contact. The seed is removed afterwards so it never renders.
    const seed = vehicleUrl
      ? `Olá! Tenho interesse neste veículo: ${vehicleUrl}`
      : body.codigo?.trim()
        ? body.codigo.trim()
        : 'Olá! Quero saber mais sobre os veículos de vocês.';

    let opener = '';
    try {
      opener = await runAgentTurn({
        instance: WEBCHAT_CHANNEL,
        phoneNumber: sessionId,
        userMessage: seed,
        conversationId: conversation.id,
        history: conversation.recentMessages,
        lead: conversation.lead,
      });
    } catch (err) {
      fastify.log.error({ err }, 'webchat opener failed');
      opener =
        agent.webchatWelcome?.trim() ||
        agent.welcomeMessage?.trim() ||
        'Olá! Seja bem-vindo à Autoscar. Como posso te ajudar?';
    }

    // Drop the hidden seed so the lead never sees it.
    await prisma.message
      .deleteMany({
        where: { conversationId: conversation.id, role: 'lead', content: seed },
      })
      .catch(() => {});

    emitNewMessage({ conversationId: conversation.id });
    emitConversationUpdated({ id: conversation.id });

    await runPostTurn(conversation.lead?.id).catch((err) => {
      fastify.log.error({ err }, 'webchat post-turn failed');
    });

    return {
      sessionId,
      messages: opener.trim() ? [{ role: 'agent', content: opener }] : [],
    };
  });

  // ---- Resume an existing session (page refresh) ----
  fastify.get('/webchat/history', async (request, reply) => {
    const { sessionId } = request.query as { sessionId?: string };
    if (!sessionId?.startsWith('web:')) {
      return reply.code(400).send({ error: 'sessionId inválido' });
    }

    const lead = await prisma.lead.findFirst({ where: { phone: sessionId } });
    if (!lead) return { messages: [] };

    const conversation = await prisma.conversation.findUnique({
      where: { leadId: lead.id },
    });
    if (!conversation) return { messages: [] };

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return {
      messages: messages.map((m) => ({
        role: m.role === 'lead' ? 'lead' : 'agent',
        content: m.content,
      })),
    };
  });

  // ---- Send a message and get the agent reply (synchronous, Typebot-style) ----
  fastify.post('/webchat/message', async (request, reply) => {
    const body = (request.body ?? {}) as { sessionId?: string; message?: string };
    const sessionId = body.sessionId?.trim();
    const message = body.message?.trim();

    if (!sessionId?.startsWith('web:')) {
      return reply.code(400).send({ error: 'sessionId inválido' });
    }
    if (!message) {
      return reply.code(400).send({ error: 'Mensagem vazia' });
    }
    if (message.length > 2000) {
      return reply.code(400).send({ error: 'Mensagem muito longa' });
    }

    const agent = await getWebchatAgent();
    if (!agent || !agent.webchatEnabled) {
      return reply.code(403).send({ error: 'Atendimento web indisponível.' });
    }

    const conversation = await loadOrCreateConversation(sessionId, WEBCHAT_CHANNEL);

    // Respect human override just like the WhatsApp worker does.
    if (conversation.lead) {
      const fresh = await prisma.lead.findUnique({
        where: { id: conversation.lead.id },
        select: { humanOverride: true },
      });
      if (fresh?.humanOverride) {
        return reply.send({
          reply:
            'Um consultor já está acompanhando seu atendimento e vai te responder por aqui em instantes 😊',
        });
      }
    }

    let agentReply = '';
    try {
      agentReply = await runAgentTurn({
        instance: WEBCHAT_CHANNEL,
        phoneNumber: sessionId,
        userMessage: message,
        conversationId: conversation.id,
        history: conversation.recentMessages,
        lead: conversation.lead,
      });
    } catch (err) {
      fastify.log.error({ err }, 'webchat agent turn failed');
      agentReply =
        'Desculpe, tive um probleminha agora. Pode tentar novamente em instantes? 😊';
    }

    emitNewMessage({ conversationId: conversation.id });
    emitConversationUpdated({ id: conversation.id });

    await runPostTurn(conversation.lead?.id).catch((err) => {
      fastify.log.error({ err }, 'webchat post-turn failed');
    });

    return { reply: agentReply };
  });
};

export default webchatRoutes;
