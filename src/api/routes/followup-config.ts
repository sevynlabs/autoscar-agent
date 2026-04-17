import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getFollowupConfig,
  updateFollowupConfig,
} from '../../crm/followup-config.service.js';
import { rescheduleFollowupScan } from '../../queue/workers/followup-workflow.worker.js';

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  minHoursBetween: z.number().int().min(1).max(720).optional(),
  scanHour: z.number().int().min(0).max(23).optional(),
  scanMinute: z.number().int().min(0).max(59).optional(),
  skipWeekends: z.boolean().optional(),
  skipIfLeadResponded: z.boolean().optional(),
  useAgentPrompt: z.boolean().optional(),
  customPromptTemplate: z.string().nullable().optional(),
  exhaustedStageName: z.string().min(1).max(100).optional(),
});

export default async function followupConfigRoutes(fastify: FastifyInstance) {
  fastify.get('/followup-config', async () => {
    return getFollowupConfig();
  });

  fastify.patch('/followup-config', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const updated = await updateFollowupConfig(parsed.data);

    const scheduleChanged =
      parsed.data.scanHour !== undefined ||
      parsed.data.scanMinute !== undefined ||
      parsed.data.skipWeekends !== undefined ||
      parsed.data.enabled !== undefined;

    if (scheduleChanged) {
      await rescheduleFollowupScan().catch((err) => {
        request.log.error({ err }, 'Failed to reschedule follow-up scan');
      });
    }

    return updated;
  });
}
