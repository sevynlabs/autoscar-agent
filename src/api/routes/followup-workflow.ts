import { FastifyInstance } from 'fastify';
import prisma from '../../db/prisma.js';
import { triggerFollowupScan } from '../../queue/workers/followup-workflow.worker.js';
import { getFollowupConfig, buildScanCron } from '../../crm/followup-config.service.js';

export default async function followupWorkflowRoutes(fastify: FastifyInstance) {
  fastify.post('/followup-workflow/trigger', async () => {
    const config = await getFollowupConfig();
    if (!config.enabled) {
      return { triggered: false, reason: 'Follow-up desativado na configuração' };
    }
    return triggerFollowupScan();
  });

  fastify.get('/followup-workflow/status', async () => {
    const config = await getFollowupConfig();

    const followupStages = await prisma.stage.findMany({
      where: { name: { contains: 'follow', mode: 'insensitive' } },
    });

    if (followupStages.length === 0) {
      return {
        active: false,
        enabled: config.enabled,
        message: 'Nenhum estágio "Follow-up" encontrado. Crie um estágio chamado "Follow-up" para ativar.',
      };
    }

    const stageIds = followupStages.map((s) => s.id);

    const totalLeads = await prisma.lead.count({ where: { stageId: { in: stageIds } } });
    const pendingFollowup = await prisma.lead.count({
      where: {
        stageId: { in: stageIds },
        humanOverride: false,
        followupAttempts: { lt: config.maxAttempts },
      },
    });
    const exhausted = await prisma.lead.count({
      where: { stageId: { in: stageIds }, followupAttempts: { gte: config.maxAttempts } },
    });

    const scheduleLabel = config.enabled
      ? `${String(config.scanHour).padStart(2, '0')}:${String(config.scanMinute).padStart(2, '0')}${config.skipWeekends ? ' (seg–sex)' : ' (todos os dias)'}`
      : 'Desativado';

    return {
      active: true,
      enabled: config.enabled,
      stages: followupStages.map((s) => ({ id: s.id, name: s.name, pipelineId: s.pipelineId })),
      totalLeads,
      pendingFollowup,
      exhausted,
      maxAttempts: config.maxAttempts,
      schedule: scheduleLabel,
      cron: buildScanCron(config.scanHour, config.scanMinute, config.skipWeekends),
    };
  });

  fastify.post('/followup-workflow/reset/:leadId', async (request) => {
    const { leadId } = request.params as { leadId: string };
    await prisma.lead.update({
      where: { id: leadId },
      data: { followupAttempts: 0, lastFollowupAt: null },
    });
    return { reset: true, leadId };
  });
}
