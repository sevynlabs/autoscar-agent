import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import prisma from '../../db/prisma.js';
import { updateLead, moveToStage, addNote } from '../../crm/lead.service.js';

const leadQuerySchema = z.object({
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  search: z.string().optional(),
});

const patchLeadSchema = z.object({
  name: z.string().optional(),
  city: z.string().optional(),
  creditStatus: z.string().optional(),
  paymentMethod: z.string().optional(),
  vehicleUrl: z.string().optional(),
});

const moveSchema = z.object({
  stageId: z.string(),
});

const handoffSchema = z.object({
  override: z.boolean(),
});

const noteSchema = z.object({
  content: z.string(),
});

export default async function leadsRoutes(fastify: FastifyInstance) {
  // GET /leads?pipelineId=&stageId=&search=
  fastify.get('/leads', async (request, reply) => {
    const query = leadQuerySchema.parse(request.query);

    const where: Record<string, unknown> = {};
    if (query.pipelineId) where.pipelineId = query.pipelineId;
    if (query.stageId) where.stageId = query.stageId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        stage: true,
        notes: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return leads;
  });

  // GET /leads/:id/detail
  fastify.get('/leads/:id/detail', async (request, reply) => {
    const { id } = request.params as { id: string };

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id },
      include: {
        stage: true,
        notes: { orderBy: { createdAt: 'asc' } },
        conversation: {
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return lead;
  });

  // PATCH /leads/:id
  fastify.patch('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = patchLeadSchema.parse(request.body);

    const updated = await updateLead(id, body);
    fastify.io.emit('lead:updated', updated);

    return updated;
  });

  // PATCH /leads/:id/move
  fastify.patch('/leads/:id/move', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = moveSchema.parse(request.body);

    const updated = await moveToStage(id, body.stageId);
    fastify.io.emit('lead:moved', { leadId: id, stageId: body.stageId });

    return updated;
  });

  // PATCH /leads/:id/handoff
  fastify.patch('/leads/:id/handoff', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = handoffSchema.parse(request.body);

    const updated = await prisma.lead.update({
      where: { id },
      data: { humanOverride: body.override },
      include: { stage: true },
    });
    fastify.io.emit('lead:handoff', { leadId: id, humanOverride: body.override });

    return updated;
  });

  // POST /leads/:id/notes
  fastify.post('/leads/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = noteSchema.parse(request.body);

    const note = await addNote(id, body.content, 'human');
    fastify.io.emit('lead:note-added', note);

    return note;
  });
}
