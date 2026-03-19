import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';
import { triggerFollowupScan } from '../../queue/workers/followup-workflow.worker.js';

export default async function followupWorkflowRoutes(fastify: FastifyInstance) {
  // POST /followup-workflow/trigger — manually trigger follow-up scan
  fastify.post('/followup-workflow/trigger', async () => {
    return triggerFollowupScan();
  });

  // GET /followup-workflow/status — check follow-up stage status
  fastify.get('/followup-workflow/status', async () => {
    // Find follow-up stages
    const followupStages = await prisma.stage.findMany({
      where: { name: { contains: 'follow', mode: 'insensitive' } },
    });

    if (followupStages.length === 0) {
      return { active: false, message: 'No Follow-up stage found. Create a stage named "Follow-up" to activate.' };
    }

    const stageIds = followupStages.map(s => s.id);

    // Count leads
    const totalLeads = await prisma.lead.count({ where: { stageId: { in: stageIds } } });
    const pendingFollowup = await prisma.lead.count({
      where: {
        stageId: { in: stageIds },
        humanOverride: false,
        followupAttempts: { lt: 3 },
      },
    });
    const exhausted = await prisma.lead.count({
      where: { stageId: { in: stageIds }, followupAttempts: { gte: 3 } },
    });

    return {
      active: true,
      stages: followupStages.map(s => ({ id: s.id, name: s.name, pipelineId: s.pipelineId })),
      totalLeads,
      pendingFollowup,
      exhausted,
      maxAttempts: 3,
      schedule: 'Diariamente às 9h',
    };
  });

  // POST /followup-workflow/reset/:leadId — reset follow-up attempts for a lead
  fastify.post('/followup-workflow/reset/:leadId', async (request) => {
    const { leadId } = request.params as { leadId: string };
    await prisma.lead.update({
      where: { id: leadId },
      data: { followupAttempts: 0, lastFollowupAt: null },
    });
    return { reset: true, leadId };
  });
}
