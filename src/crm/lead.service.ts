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
      phone_pipelineId_vehicleUrl: {
        phone: data.phone,
        pipelineId: pipeline.id,
        vehicleUrl: data.vehicleUrl ?? '',
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
    email?: string;
    city?: string;
    contactPhone?: string;
    creditStatus?: string;
    paymentMethod?: string;
    vehicleUrl?: string;
  },
) {
  // If vehicleUrl is being updated, check if it's different from the current one.
  // If so, reset sellerNotifiedAt to allow a new notification to the seller of the new vehicle.
  let finalData: typeof data & { sellerNotifiedAt?: null } = { ...data };

  if (data.vehicleUrl) {
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { vehicleUrl: true },
    });

    // If vehicle URL changed, reset notification status to allow new notification
    if (currentLead && currentLead.vehicleUrl !== data.vehicleUrl) {
      finalData.sellerNotifiedAt = null;
      console.log(JSON.stringify({
        level: 'info',
        msg: '[lead-service] vehicle URL changed — resetting notification status',
        leadId,
        oldUrl: currentLead.vehicleUrl,
        newUrl: data.vehicleUrl,
      }));
    }
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: finalData,
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
