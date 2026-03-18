import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import prisma from '../../db/prisma.js';
import { listRules, createRule, deleteRule } from '../../crm/qualification-rule.service.js';

const createStageSchema = z.object({
  name: z.string(),
});

const patchStageSchema = z.object({
  name: z.string().optional(),
  order: z.number().optional(),
});

const createRuleSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.string(),
  stageTrigger: z.string(),
});

export default async function pipelinesRoutes(fastify: FastifyInstance) {
  // GET /pipelines
  fastify.get('/pipelines', async () => {
    const pipelines = await prisma.pipeline.findMany({
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { leads: true } },
          },
        },
      },
    });

    return pipelines;
  });

  // GET /pipelines/:id
  fastify.get('/pipelines/:id', async (request) => {
    const { id } = request.params as { id: string };

    const pipeline = await prisma.pipeline.findUniqueOrThrow({
      where: { id },
      include: {
        stages: { orderBy: { order: 'asc' } },
      },
    });

    return pipeline;
  });

  // POST /pipelines/:id/stages
  fastify.post('/pipelines/:id/stages', async (request) => {
    const { id } = request.params as { id: string };
    const body = createStageSchema.parse(request.body);

    // Find max order
    const maxStage = await prisma.stage.findFirst({
      where: { pipelineId: id },
      orderBy: { order: 'desc' },
    });
    const nextOrder = (maxStage?.order ?? -1) + 1;

    const stage = await prisma.stage.create({
      data: {
        name: body.name,
        order: nextOrder,
        pipelineId: id,
      },
    });

    fastify.io.emit('stage:created', stage);
    return stage;
  });

  // PATCH /pipelines/:pipelineId/stages/:stageId
  fastify.patch('/pipelines/:pipelineId/stages/:stageId', async (request) => {
    const { pipelineId, stageId } = request.params as {
      pipelineId: string;
      stageId: string;
    };
    const body = patchStageSchema.parse(request.body);

    if (body.order !== undefined) {
      // Reorder: shift other stages
      const current = await prisma.stage.findUniqueOrThrow({
        where: { id: stageId },
      });
      const oldOrder = current.order;
      const newOrder = body.order;

      if (newOrder > oldOrder) {
        // Moving down: shift stages in between up
        await prisma.stage.updateMany({
          where: {
            pipelineId,
            order: { gt: oldOrder, lte: newOrder },
          },
          data: { order: { decrement: 1 } },
        });
      } else if (newOrder < oldOrder) {
        // Moving up: shift stages in between down
        await prisma.stage.updateMany({
          where: {
            pipelineId,
            order: { gte: newOrder, lt: oldOrder },
          },
          data: { order: { increment: 1 } },
        });
      }
    }

    const updated = await prisma.stage.update({
      where: { id: stageId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    });

    fastify.io.emit('stage:updated', updated);
    return updated;
  });

  // DELETE /pipelines/:pipelineId/stages/:stageId
  fastify.delete('/pipelines/:pipelineId/stages/:stageId', async (request) => {
    const { stageId } = request.params as {
      pipelineId: string;
      stageId: string;
    };

    // Reassign leads to null stageId
    await prisma.lead.updateMany({
      where: { stageId },
      data: { stageId: null },
    });

    await prisma.stage.delete({ where: { id: stageId } });

    fastify.io.emit('stage:deleted', { stageId });
    return { success: true };
  });

  // GET /pipelines/:id/rules
  fastify.get('/pipelines/:id/rules', async (request) => {
    const { id } = request.params as { id: string };
    return listRules(id);
  });

  // POST /pipelines/:id/rules
  fastify.post('/pipelines/:id/rules', async (request) => {
    const { id } = request.params as { id: string };
    const body = createRuleSchema.parse(request.body);

    const rule = await createRule({ pipelineId: id, ...body });
    fastify.io.emit('rule:created', rule);
    return rule;
  });

  // DELETE /pipelines/:pipelineId/rules/:ruleId
  fastify.delete('/pipelines/:pipelineId/rules/:ruleId', async (request) => {
    const { ruleId } = request.params as {
      pipelineId: string;
      ruleId: string;
    };

    await deleteRule(ruleId);
    fastify.io.emit('rule:deleted', { ruleId });
    return { success: true };
  });
}
