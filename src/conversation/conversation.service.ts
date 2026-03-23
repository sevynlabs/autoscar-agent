import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import prisma from '../db/prisma.js';
import { getDefaultPipeline, getStageByName } from '../crm/pipeline.service.js';

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
    // Auto-create lead in "Novo" stage with pipeline
    const pipeline = await getDefaultPipeline().catch(() => null);
    const novoStage = pipeline ? await getStageByName(pipeline.id, 'Novo') : null;

    lead = await prisma.lead.create({
      data: {
        phone: phoneNumber,
        pipelineId: pipeline?.id ?? null,
        stageId: novoStage?.id ?? null,
      },
      include: { stage: true },
    });
    console.log(`[conversation] Auto-created lead ${lead.id} in stage "${novoStage?.name ?? 'none'}" for ${phoneNumber}`);
  } else if (!lead.pipelineId || !lead.stageId) {
    // Fix orphan lead — assign to pipeline + Novo stage
    const pipeline = await getDefaultPipeline().catch(() => null);
    const novoStage = pipeline ? await getStageByName(pipeline.id, 'Novo') : null;
    if (pipeline && novoStage) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { pipelineId: pipeline.id, stageId: novoStage.id },
        include: { stage: true },
      });
      console.log(`[conversation] Fixed orphan lead ${lead.id} → stage "Novo"`);
    }
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
