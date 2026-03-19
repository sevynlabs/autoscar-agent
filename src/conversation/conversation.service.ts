import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import prisma from '../db/prisma.js';

export async function loadOrCreateConversation(
  phoneNumber: string,
  channel: string = 'whatsapp',
  limit = 30,
) {
  let lead = await prisma.lead.findFirst({
    where: { phone: phoneNumber },
    include: { stage: true },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: { phone: phoneNumber },
      include: { stage: true },
    });
  }

  const conversation = await prisma.conversation.upsert({
    where: { leadId: lead.id },
    create: { leadId: lead.id, channel },
    update: {},
  });

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  // Map DB messages to OpenAI format for agent context
  const recentMessages: ChatCompletionMessageParam[] = messages.map((msg) => ({
    role: msg.role === 'lead' ? 'user' : 'assistant',
    content: msg.content,
  } as ChatCompletionMessageParam));

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
  messages: { role: string; content: string }[],
) {
  await prisma.message.createMany({
    data: messages.map((msg) => ({
      conversationId,
      role: msg.role,
      content: msg.content,
    })),
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
