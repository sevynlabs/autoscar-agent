import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';
import { forceQualifyAllNovo } from '../../queue/workers/reengagement.worker.js';
import { notifySellersGroupForLead } from '../../crm/seller-notification.service.js';
import { emitLeadMoved } from '../../realtime/emitter.js';

export default async function reengagementRoutes(fastify: FastifyInstance) {
  // One-shot: force-qualify every lead currently in "Novo" stage, fetching
  // missing names from WhatsApp profile and notifying the sellers group.
  fastify.post('/reengagement/force-qualify-all', async () => {
    const result = await forceQualifyAllNovo();
    return result;
  });

  // Manually push a specific lead to the sellers group. Accepts:
  //   { leadId } | { phone } | { name } — name uses case-insensitive match
  // Also moves the lead to "Qualificado" if still in Novo / Em Qualificacao.
  fastify.post('/reengagement/notify-lead', async (request, reply) => {
    const body = (request.body ?? {}) as { leadId?: string; phone?: string; name?: string };

    type LeadWithStage = {
      id: string;
      name: string | null;
      phone: string;
      pipelineId: string | null;
      stageId: string | null;
      stage: { name: string } | null;
    };

    let lead: LeadWithStage | null = null;
    if (body.leadId) {
      lead = await prisma.lead.findUnique({ where: { id: body.leadId }, include: { stage: true } });
    } else if (body.phone) {
      lead = await prisma.lead.findFirst({ where: { phone: body.phone }, include: { stage: true } });
    } else if (body.name) {
      lead = await prisma.lead.findFirst({
        where: { name: { contains: body.name, mode: 'insensitive' } },
        orderBy: { updatedAt: 'desc' },
        include: { stage: true },
      });
    }

    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' });

    // Move to Qualificado if still in pre-qualification stages
    const stageName = lead.stage?.name?.toLowerCase() ?? '';
    const inPreQual =
      stageName === 'novo' || stageName === 'new' || stageName.includes('em qualifica');

    if (inPreQual && lead.pipelineId) {
      const qualifiedStage = await prisma.stage.findFirst({
        where: {
          pipelineId: lead.pipelineId,
          name: { contains: 'qualificado', mode: 'insensitive', not: { contains: 'des' } },
        },
      });
      if (qualifiedStage && qualifiedStage.id !== lead.stageId) {
        await prisma.lead.update({ where: { id: lead.id }, data: { stageId: qualifiedStage.id } });
        emitLeadMoved({ id: lead.id, stageId: qualifiedStage.id });
      }
    }

    const result = await notifySellersGroupForLead(lead.id, {
      reason: 'Envio manual pelo CRM',
      force: true,
    });

    return { leadId: lead.id, name: lead.name, phone: lead.phone, ...result };
  });
}
