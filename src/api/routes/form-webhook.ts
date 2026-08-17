import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod/v4';
import prisma from '../../db/prisma.js';
import { getDefaultPipeline, getStageByName } from '../../crm/pipeline.service.js';

const formLeadSchema = z.object({
  phone: z.string().min(10),
  name: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  vehicleUrl: z.string().optional(),
  message: z.string().optional(),
});

const formWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhook/form', async (request, reply) => {
    const parsed = formLeadSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        details: parsed.error.issues,
      });
    }

    const data = parsed.data;

    // Normaliza telefone
    let phone = data.phone.replace(/\D/g, '');
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone;
    }

    // Pega pipeline e stage padrão
    const pipeline = await getDefaultPipeline();
    const novoStage = await getStageByName(pipeline.id, 'Novo');

    // Cria ou atualiza lead
    const lead = await prisma.lead.upsert({
      where: {
        phone_pipelineId_vehicleUrl: {
          phone,
          pipelineId: pipeline.id,
          vehicleUrl: data.vehicleUrl ?? '',
        },
      },
      create: {
        phone,
        name: data.name ?? null,
        email: data.email ?? null,
        city: data.city ?? null,
        vehicleUrl: data.vehicleUrl ?? null,
        pipelineId: pipeline.id,
        stageId: novoStage?.id ?? null,
      },
      update: {
        name: data.name ?? undefined,
        email: data.email ?? undefined,
        city: data.city ?? undefined,
      },
    });

    // Adiciona nota se tiver mensagem
    if (data.message) {
      await prisma.leadNote.create({
        data: {
          leadId: lead.id,
          content: data.message,
          type: 'system',
        },
      });
    }

    return reply.status(201).send({
      success: true,
      leadId: lead.id,
    });
  });
};

export default formWebhookRoutes;
