import { Worker, type Job } from 'bullmq';
import prisma from '../../db/prisma.js';
import { runAgentTurn } from '../../agent/agent.service.js';
import { loadOrCreateConversation } from '../../conversation/conversation.service.js';
import { getChannel } from '../../channels/channel.manager.js';
import { emitNewMessage, emitLeadMoved } from '../../realtime/emitter.js';
import { fireWebhooks } from '../../webhooks/webhook.service.js';
import { getFollowupWorkflowQueue } from '../queues.js';
import { getFollowupConfig, buildScanCron } from '../../crm/followup-config.service.js';

const FOLLOWUP_SCAN_JOB_ID = 'daily-followup-scan';

let worker: Worker | null = null;

function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === null || v === undefined ? '' : String(v);
  });
}

/**
 * Scan all leads in "Follow-up" stage and trigger agent follow-up
 */
async function scanFollowupLeads() {
  const config = await getFollowupConfig();

  if (!config.enabled) {
    console.log(JSON.stringify({ level: 'info', msg: 'Follow-up desativado pela configuração. Pulando scan.' }));
    return;
  }

  console.log(JSON.stringify({ level: 'info', msg: 'Follow-up workflow: scanning leads...', config: { maxAttempts: config.maxAttempts, minHoursBetween: config.minHoursBetween } }));

  const followupStages = await prisma.stage.findMany({
    where: { name: { contains: 'follow', mode: 'insensitive' } },
  });

  if (followupStages.length === 0) {
    console.log(JSON.stringify({ level: 'info', msg: 'No Follow-up stage found in any pipeline. Create a stage named "Follow-up" to activate.' }));
    return;
  }

  const stageIds = followupStages.map((s) => s.id);

  const leads = await prisma.lead.findMany({
    where: {
      stageId: { in: stageIds },
      humanOverride: false,
    },
    include: {
      stage: true,
      conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  console.log(JSON.stringify({ level: 'info', msg: `Found ${leads.length} leads in Follow-up stage` }));

  const now = new Date();

  for (const lead of leads) {
    if (lead.lastFollowupAt) {
      const hoursSince = (now.getTime() - lead.lastFollowupAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < config.minHoursBetween) {
        continue;
      }
    }

    if (lead.followupAttempts >= config.maxAttempts) {
      console.log(JSON.stringify({ level: 'info', msg: 'Max follow-up attempts reached', leadId: lead.id, attempts: lead.followupAttempts }));

      const exhaustedStage = await prisma.stage.findFirst({
        where: {
          pipelineId: lead.pipelineId!,
          name: { contains: config.exhaustedStageName, mode: 'insensitive' },
        },
      });

      if (exhaustedStage) {
        await prisma.lead.update({ where: { id: lead.id }, data: { stageId: exhaustedStage.id } });
        emitLeadMoved({ id: lead.id, stageId: exhaustedStage.id });

        await prisma.leadNote.create({
          data: {
            leadId: lead.id,
            content: `Lead movido para ${exhaustedStage.name} após ${lead.followupAttempts} tentativas de follow-up sem resposta.`,
            type: 'ai',
          },
        });

        fireWebhooks('lead.followup_exhausted', {
          leadId: lead.id,
          phone: lead.phone,
          attempts: lead.followupAttempts,
        }).catch(() => {});
      }
      continue;
    }

    if (config.skipIfLeadResponded) {
      const lastMsg = lead.conversation?.messages[0];
      if (lastMsg && lastMsg.role === 'lead' && lead.lastFollowupAt && lastMsg.createdAt > lead.lastFollowupAt) {
        continue;
      }
    }

    try {
      await sendFollowup(lead, config);
    } catch (err) {
      console.log(JSON.stringify({ level: 'error', msg: 'Follow-up failed for lead', leadId: lead.id, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  console.log(JSON.stringify({ level: 'info', msg: 'Follow-up workflow scan complete' }));
}

async function sendFollowup(lead: any, config: Awaited<ReturnType<typeof getFollowupConfig>>) {
  const attemptNumber = lead.followupAttempts + 1;

  const instance = await prisma.whatsAppInstance.findFirst({
    where: { status: 'connected' },
    orderBy: { createdAt: 'asc' },
  });

  if (!instance) {
    console.log(JSON.stringify({ level: 'warn', msg: 'No connected WhatsApp instance for follow-up', leadId: lead.id }));
    return;
  }

  const conversation = await loadOrCreateConversation(lead.phone, 'whatsapp');

  const templateVars = {
    name: lead.name ?? lead.phone,
    phone: lead.phone,
    attempt: attemptNumber,
    maxAttempts: config.maxAttempts,
    vehicle: lead.vehicleUrl ?? '',
    city: lead.city ?? '',
    creditStatus: lead.creditStatus ?? '',
  };

  let messageToSend: string | null = null;
  const customTemplate = config.customPromptTemplate?.trim();

  if (!config.useAgentPrompt && customTemplate) {
    // Send the template verbatim (no AI)
    messageToSend = renderTemplate(customTemplate, templateVars);
  } else {
    // Build prompt for agent (custom template overrides default)
    const promptBody = customTemplate
      ? renderTemplate(customTemplate, templateVars)
      : `CONTEXTO: Este é um follow-up automático (tentativa ${attemptNumber} de ${config.maxAttempts}).
O lead ${templateVars.name} está no estágio "Follow-up" do CRM.
${lead.vehicleUrl ? `Veículo de interesse: ${lead.vehicleUrl}` : ''}
${lead.city ? `Cidade: ${lead.city}` : ''}

INSTRUÇÃO: Envie UMA mensagem curta e amigável de follow-up para este lead.
- Se é a 1ª tentativa: pergunte se ainda tem interesse no veículo
- Se é a 2ª tentativa: ofereça ajuda ou condição especial
- Se for a última tentativa: seja direto mas educado
- NÃO use ferramentas do CRM neste momento, apenas envie a mensagem
- Responda APENAS com o texto da mensagem, nada mais`;

    messageToSend = await runAgentTurn({
      instance: instance.name,
      phoneNumber: lead.phone,
      userMessage: promptBody,
      conversationId: conversation.id,
      history: conversation.recentMessages.slice(-10),
      lead: conversation.lead,
    });
  }

  if (messageToSend && messageToSend.trim()) {
    const channel = getChannel('whatsapp');
    await channel.sendText(lead.phone, instance.name, messageToSend);
    emitNewMessage({ conversationId: conversation.id });

    console.log(JSON.stringify({ level: 'info', msg: 'Follow-up sent', leadId: lead.id, attempt: attemptNumber, preview: messageToSend.substring(0, 60) }));
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { followupAttempts: attemptNumber, lastFollowupAt: new Date() },
  });

  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      content: `[Follow-up ${attemptNumber}/${config.maxAttempts}] ${messageToSend?.substring(0, 100) ?? 'Enviado'}`,
      type: 'ai',
    },
  });
}

/**
 * Remove old repeatable scan job and re-schedule with current config
 */
export async function rescheduleFollowupScan() {
  const queue = getFollowupWorkflowQueue();
  const config = await getFollowupConfig();

  const repeatables = await queue.getRepeatableJobs();
  for (const r of repeatables) {
    if (r.id === FOLLOWUP_SCAN_JOB_ID || r.name === 'scan') {
      await queue.removeRepeatableByKey(r.key).catch(() => {});
    }
  }

  if (!config.enabled) {
    console.log(JSON.stringify({ level: 'info', msg: 'Follow-up workflow: desativado — nenhum scan agendado' }));
    return;
  }

  const cron = buildScanCron(config.scanHour, config.scanMinute, config.skipWeekends);
  await queue.add(
    'scan',
    { type: 'scan' },
    { repeat: { pattern: cron }, jobId: FOLLOWUP_SCAN_JOB_ID },
  );
  console.log(JSON.stringify({ level: 'info', msg: `Follow-up workflow scheduled: ${cron}` }));
}

export function startFollowupWorkflowWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL must be set');

  worker = new Worker(
    'followup-workflow',
    async (job: Job) => {
      if (job.name === 'scan' || job.data?.type === 'scan' || job.name === 'scan-manual') {
        await scanFollowupLeads();
      }
    },
    { connection: { url: redisUrl }, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.log(JSON.stringify({ level: 'error', msg: 'Follow-up workflow job failed', jobId: job?.id, error: err.message }));
  });

  rescheduleFollowupScan().catch((err) => {
    console.log(JSON.stringify({ level: 'error', msg: 'Failed to schedule follow-up workflow', error: err instanceof Error ? err.message : String(err) }));
  });

  return worker;
}

export async function triggerFollowupScan() {
  const queue = getFollowupWorkflowQueue();
  await queue.add('scan-manual', { type: 'scan' });
  return { triggered: true };
}

export function getFollowupWorkflowWorker(): Worker | null {
  return worker;
}
