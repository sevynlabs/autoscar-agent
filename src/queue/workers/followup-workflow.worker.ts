import { Worker, type Job } from 'bullmq';
import prisma from '../../db/prisma.js';
import { getActiveAgent } from '../../agent/agent.prompts.js';
import { runAgentTurn } from '../../agent/agent.service.js';
import { loadOrCreateConversation } from '../../conversation/conversation.service.js';
import { getChannel } from '../../channels/channel.manager.js';
import { emitNewMessage, emitLeadMoved } from '../../realtime/emitter.js';
import { fireWebhooks } from '../../webhooks/webhook.service.js';
import { getFollowupWorkflowQueue } from '../queues.js';

const FOLLOWUP_STAGE_NAME = 'Follow-up';
const MAX_ATTEMPTS = 3; // after 3 attempts with no response, move to Desqualificado
const SCAN_INTERVAL = '0 9 * * *'; // every day at 9am

let worker: Worker | null = null;

/**
 * Scan all leads in "Follow-up" stage and trigger agent follow-up
 */
async function scanFollowupLeads() {
  console.log(JSON.stringify({ level: 'info', msg: 'Follow-up workflow: scanning leads...' }));

  // Find the "Follow-up" stage across all pipelines
  const followupStages = await prisma.stage.findMany({
    where: { name: { contains: 'follow', mode: 'insensitive' } },
  });

  if (followupStages.length === 0) {
    console.log(JSON.stringify({ level: 'info', msg: 'No Follow-up stage found in any pipeline. Create a stage named "Follow-up" to activate.' }));
    return;
  }

  const stageIds = followupStages.map(s => s.id);

  // Get all leads in follow-up stages
  const leads = await prisma.lead.findMany({
    where: {
      stageId: { in: stageIds },
      humanOverride: false, // skip leads under human control
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
    // Skip if already followed up today
    if (lead.lastFollowupAt) {
      const hoursSince = (now.getTime() - lead.lastFollowupAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 20) { // less than 20 hours = already done today
        console.log(JSON.stringify({ level: 'info', msg: 'Skipping lead (already followed up today)', leadId: lead.id, hoursSince: Math.round(hoursSince) }));
        continue;
      }
    }

    // Check max attempts
    if (lead.followupAttempts >= MAX_ATTEMPTS) {
      console.log(JSON.stringify({ level: 'info', msg: 'Max follow-up attempts reached, moving to Desqualificado', leadId: lead.id, attempts: lead.followupAttempts }));

      // Find "Desqualificado" stage
      const desqStage = await prisma.stage.findFirst({
        where: { pipelineId: lead.pipelineId!, name: { contains: 'desqualificad', mode: 'insensitive' } },
      });

      if (desqStage) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { stageId: desqStage.id },
        });
        emitLeadMoved({ id: lead.id, stageId: desqStage.id });

        // Add note
        await prisma.leadNote.create({
          data: { leadId: lead.id, content: `Lead movido para Desqualificado após ${lead.followupAttempts} tentativas de follow-up sem resposta.`, type: 'ai' },
        });

        fireWebhooks('lead.followup_exhausted', { leadId: lead.id, phone: lead.phone, attempts: lead.followupAttempts }).catch(() => {});
      }
      continue;
    }

    // Check if lead responded since last follow-up (last message is from lead)
    const lastMsg = lead.conversation?.messages[0];
    if (lastMsg && lastMsg.role === 'lead' && lead.lastFollowupAt && lastMsg.createdAt > lead.lastFollowupAt) {
      console.log(JSON.stringify({ level: 'info', msg: 'Lead responded since last follow-up, skipping', leadId: lead.id }));
      continue;
    }

    // === SEND FOLLOW-UP via AGENT ===
    try {
      await sendAgentFollowup(lead);
    } catch (err) {
      console.log(JSON.stringify({ level: 'error', msg: 'Follow-up failed for lead', leadId: lead.id, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  console.log(JSON.stringify({ level: 'info', msg: 'Follow-up workflow scan complete' }));
}

/**
 * Send a follow-up message using the AI agent (personalized based on lead context)
 */
async function sendAgentFollowup(lead: any) {
  const attemptNumber = lead.followupAttempts + 1;

  console.log(JSON.stringify({ level: 'info', msg: 'Sending agent follow-up', leadId: lead.id, phone: lead.phone, attempt: attemptNumber }));

  // Find the WhatsApp instance connected to this lead's conversation
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { status: 'connected' },
    orderBy: { createdAt: 'asc' },
  });

  if (!instance) {
    console.log(JSON.stringify({ level: 'warn', msg: 'No connected WhatsApp instance for follow-up', leadId: lead.id }));
    return;
  }

  // Load conversation context
  const conversation = await loadOrCreateConversation(lead.phone, 'whatsapp');

  // Build a follow-up prompt for the agent
  const followupPrompt = `CONTEXTO: Este é um follow-up automático (tentativa ${attemptNumber} de ${MAX_ATTEMPTS}).
O lead ${lead.name ?? lead.phone} está no estágio "Follow-up" do CRM.
${lead.vehicleUrl ? `Veículo de interesse: ${lead.vehicleUrl}` : ''}
${lead.city ? `Cidade: ${lead.city}` : ''}
${lead.creditStatus ? `Crédito: ${lead.creditStatus}` : ''}

INSTRUÇÃO: Envie UMA mensagem curta e amigável de follow-up para este lead.
- Se é a 1ª tentativa: pergunte se ainda tem interesse no veículo
- Se é a 2ª tentativa: ofereça ajuda ou condição especial
- Se é a 3ª tentativa: última tentativa, seja direto mas educado
- NÃO use ferramentas do CRM neste momento, apenas envie a mensagem
- Responda APENAS com o texto da mensagem, nada mais`;

  // Run agent to generate personalized follow-up
  const reply = await runAgentTurn({
    instance: instance.name,
    phoneNumber: lead.phone,
    userMessage: followupPrompt,
    conversationId: conversation.id,
    history: conversation.recentMessages.slice(-10), // last 10 messages for context
    lead: conversation.lead,
  });

  // Send via WhatsApp
  if (reply && reply.trim()) {
    const channel = getChannel('whatsapp');
    await channel.sendText(lead.phone, instance.name, reply);

    emitNewMessage({ conversationId: conversation.id });

    console.log(JSON.stringify({ level: 'info', msg: 'Follow-up sent', leadId: lead.id, attempt: attemptNumber, preview: reply.substring(0, 60) }));
  }

  // Update lead follow-up tracking
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      followupAttempts: attemptNumber,
      lastFollowupAt: new Date(),
    },
  });

  // Add note
  await prisma.leadNote.create({
    data: { leadId: lead.id, content: `[Follow-up ${attemptNumber}/${MAX_ATTEMPTS}] ${reply?.substring(0, 100) ?? 'Enviado'}`, type: 'ai' },
  });
}

/**
 * Start the follow-up workflow worker + schedule daily cron
 */
export function startFollowupWorkflowWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL must be set');

  worker = new Worker(
    'followup-workflow',
    async (job: Job) => {
      if (job.name === 'scan' || job.data?.type === 'scan') {
        await scanFollowupLeads();
      }
    },
    { connection: { url: redisUrl }, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.log(JSON.stringify({ level: 'error', msg: 'Follow-up workflow job failed', jobId: job?.id, error: err.message }));
  });

  // Schedule daily scan at 9am (BullMQ repeatable job)
  const queue = getFollowupWorkflowQueue();
  queue.add('scan', { type: 'scan' }, {
    repeat: { pattern: SCAN_INTERVAL },
    jobId: 'daily-followup-scan',
  }).then(() => {
    console.log(JSON.stringify({ level: 'info', msg: 'Follow-up workflow scheduled: daily at 9am' }));
  }).catch(err => {
    console.log(JSON.stringify({ level: 'error', msg: 'Failed to schedule follow-up workflow', error: err.message }));
  });

  return worker;
}

/**
 * Manually trigger a follow-up scan (for testing or admin action)
 */
export async function triggerFollowupScan() {
  const queue = getFollowupWorkflowQueue();
  await queue.add('scan-manual', { type: 'scan' });
  return { triggered: true };
}

export function getFollowupWorkflowWorker(): Worker | null {
  return worker;
}
