import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';

// Agent config stored as a simple key-value in DB (or .env fallback)
// For v1, we store in a JSON file-like approach via a settings table

export default async function agentConfigRoutes(fastify: FastifyInstance) {
  // GET /agent/config
  fastify.get('/agent/config', async () => {
    return {
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      sellersGroupJid: process.env.SELLERS_GROUP_JID || '',
      maxFollowups: parseInt(process.env.MAX_FOLLOWUPS || '2'),
      followupDelayHours: parseInt(process.env.FOLLOWUP_DELAY_HOURS || '24'),
      portalUrl: 'https://www.autoscar.com.br',
      agentName: process.env.AGENT_NAME || 'Autoscar IA',
      welcomeMessage: process.env.WELCOME_MESSAGE || '',
      qualificationFields: ['interest', 'creditStatus', 'city', 'paymentMethod'],
    };
  });

  // GET /agent/stats
  fastify.get('/agent/stats', async () => {
    const totalConversations = await prisma.conversation.count();
    const totalMessages = await prisma.message.count();
    const agentMessages = await prisma.message.count({ where: { role: 'agent' } });
    const totalLeads = await prisma.lead.count();
    const qualifiedLeads = await prisma.lead.count({
      where: { stage: { name: 'Qualificado' } },
    });

    return {
      totalConversations,
      totalMessages,
      agentMessages,
      totalLeads,
      qualifiedLeads,
      avgMessagesPerConversation: totalConversations > 0
        ? Math.round((totalMessages / totalConversations) * 10) / 10
        : 0,
    };
  });
}
