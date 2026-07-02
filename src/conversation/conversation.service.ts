import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import prisma from '../db/prisma.js';
import { getDefaultPipeline, getStageByName } from '../crm/pipeline.service.js';

export async function loadOrCreateConversation(
  phoneNumber: string,
  channel: string = 'whatsapp',
  limit = 30,
  vehicleUrl?: string | null,
) {
  let lead = null;

  // If vehicleUrl provided, look for lead with same phone + same vehicle
  if (vehicleUrl) {
    lead = await prisma.lead.findFirst({
      where: { phone: phoneNumber, vehicleUrl },
      include: { stage: true },
    });

    if (!lead) {
      // Check if there's a lead with same phone but NO vehicle yet (new lead in progress)
      const leadWithoutVehicle = await prisma.lead.findFirst({
        where: {
          phone: phoneNumber,
          vehicleUrl: null,
          // Only consider recent leads (last 24h) without vehicle
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        include: { stage: true },
        orderBy: { createdAt: 'desc' },
      });

      if (leadWithoutVehicle) {
        // Assign vehicle to existing lead without one
        lead = await prisma.lead.update({
          where: { id: leadWithoutVehicle.id },
          data: { vehicleUrl },
          include: { stage: true },
        });
        console.log(`[conversation] Assigned vehicle to existing lead ${lead.id}: ${vehicleUrl}`);
      }
    }
  } else {
    // No vehicleUrl - find most recent lead for this phone
    lead = await prisma.lead.findFirst({
      where: { phone: phoneNumber },
      include: { stage: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!lead) {
    // Auto-create lead in "Novo" stage with pipeline
    const pipeline = await getDefaultPipeline().catch(() => null);
    const novoStage = pipeline ? await getStageByName(pipeline.id, 'Novo') : null;

    lead = await prisma.lead.create({
      data: {
        phone: phoneNumber,
        vehicleUrl: vehicleUrl ?? null,
        pipelineId: pipeline?.id ?? null,
        stageId: novoStage?.id ?? null,
      },
      include: { stage: true },
    });
    console.log(`[conversation] Auto-created lead ${lead.id} in stage "${novoStage?.name ?? 'none'}" for ${phoneNumber}${vehicleUrl ? ` with vehicle ${vehicleUrl}` : ''}`);
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
      contactPhone: lead.contactPhone,
      city: lead.city,
      creditStatus: lead.creditStatus,
      paymentMethod: lead.paymentMethod,
      vehicleUrl: lead.vehicleUrl,
      campaignCode: lead.campaignCode,
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
