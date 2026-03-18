import prisma from '../db/prisma.js';
import { getDefaultPipeline, getStageByName } from './pipeline.service.js';

export async function upsertLead(data: {
  phone: string;
  name?: string;
  vehicleUrl?: string;
}) {
  const pipeline = await getDefaultPipeline();
  const novoStage = await getStageByName(pipeline.id, 'Novo');

  return prisma.lead.upsert({
    where: {
      phone_pipelineId: {
        phone: data.phone,
        pipelineId: pipeline.id,
      },
    },
    create: {
      phone: data.phone,
      name: data.name ?? null,
      vehicleUrl: data.vehicleUrl ?? null,
      pipelineId: pipeline.id,
      stageId: novoStage?.id ?? null,
    },
    update: {
      name: data.name ?? undefined,
      vehicleUrl: data.vehicleUrl ?? undefined,
    },
    include: { stage: true },
  });
}

export async function updateLead(
  leadId: string,
  data: {
    name?: string;
    city?: string;
    creditStatus?: string;
    paymentMethod?: string;
    vehicleUrl?: string;
  },
) {
  return prisma.lead.update({
    where: { id: leadId },
    data,
    include: { stage: true },
  });
}

export async function moveToStage(leadId: string, stageId: string) {
  return prisma.lead.update({
    where: { id: leadId },
    data: { stageId },
    include: { stage: true },
  });
}

export async function addNote(
  leadId: string,
  content: string,
  type: 'ai' | 'human' = 'ai',
) {
  return prisma.leadNote.create({
    data: { leadId, content, type },
  });
}
