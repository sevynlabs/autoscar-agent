import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import prisma from '../db/prisma.js';

export async function loadOrCreateConversation(
  phoneNumber: string,
  limit = 30,
) {
  // Find lead by phone (any pipeline)
  const lead = await prisma.lead.findFirst({
    where: { phone: phoneNumber },
    include: { stage: true },
  });

  if (!lead) {
    // No lead yet -- create a conversation placeholder
    const conversation = await prisma.conversation.create({
      data: {
        lead: {
          create: {
            phone: phoneNumber,
          },
        },
      },
    });
    return { id: conversation.id, recentMessages: [] as ChatCompletionMessageParam[], lead: null };
  }

  // Find or create conversation for this lead
  const conversation = await prisma.conversation.upsert({
    where: { leadId: lead.id },
    create: { leadId: lead.id },
    update: {},
  });

  // Load recent messages
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const recentMessages: ChatCompletionMessageParam[] = messages.map((msg) =>
    JSON.parse(msg.content) as ChatCompletionMessageParam,
  );

  return {
    id: conversation.id,
    recentMessages,
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      city: lead.city,
      creditStatus: lead.creditStatus,
      paymentMethod: lead.paymentMethod,
      vehicleUrl: lead.vehicleUrl,
      stage: lead.stage,
    },
  };
}

export async function appendMessages(
  conversationId: string,
  messages: ChatCompletionMessageParam[],
) {
  await prisma.message.createMany({
    data: messages.map((msg) => ({
      conversationId,
      role: msg.role,
      content: JSON.stringify(msg),
    })),
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
