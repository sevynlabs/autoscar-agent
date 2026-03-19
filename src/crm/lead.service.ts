import prisma from '../db/prisma.js';
import { getDefaultPipeline, getStageByName } from './pipeline.service.js';
import { emitLeadCreated, emitLeadUpdated, emitLeadMoved } from '../realtime/emitter.js';
import { fireWebhooks } from '../webhooks/webhook.service.js';

export async function upsertLead(data: {
  phone: string;
  name?: string;
  vehicleUrl?: string;
}) {
  const pipeline = await getDefaultPipeline();
  const novoStage = await getStageByName(pipeline.id, 'Novo');

  const lead = await prisma.lead.upsert({
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

  emitLeadCreated(lead);
  fireWebhooks('lead.created', { leadId: lead.id, phone: lead.phone, name: lead.name }).catch(() => {});
  return lead;
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
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data,
    include: { stage: true },
  });
  emitLeadUpdated(updated);
  return updated;
}

export async function moveToStage(leadId: string, stageId: string) {
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { stageId },
    include: { stage: true },
  });
  emitLeadMoved(updated);
  fireWebhooks('lead.stage_changed', { leadId, stageId, stage: updated.stage?.name }).catch(() => {});
  return updated;
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
