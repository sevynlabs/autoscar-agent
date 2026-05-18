import { Worker, type Job } from 'bullmq';
import prisma from '../../db/prisma.js';
import { runAgentTurn } from '../../agent/agent.service.js';
import { loadOrCreateConversation } from '../../conversation/conversation.service.js';
import { getChannel } from '../../channels/channel.manager.js';
import { emitNewMessage, emitLeadMoved } from '../../realtime/emitter.js';
import { getReengagementQueue } from '../queues.js';
import { evolutionClient } from '../../whatsapp/evolution.client.js';
import { notifySellersGroupForLead } from '../../crm/seller-notification.service.js';

const SCAN_JOB_ID = 'reengagement-scan';
const SCAN_CRON = '* * * * *'; // every minute

// Defaults — can be moved to FollowupConfig later if tuning is needed
const SILENCE_MINUTES = 5;
const MAX_ATTEMPTS = 2;
const MIN_HOURS_BETWEEN = 1;
const EXHAUSTED_STAGE_NAME = 'Follow-up';
const FORCE_QUALIFY_MINUTES = 5; // total conversation age — bail out and hand to sellers
const NOVO_STAGE_NAMES = ['novo', 'new'];

let worker: Worker | null = null;

async function scanForSilentLeads() {
  // Include both "Novo" and "Em Qualificacao" — the agent moves leads to the
  // latter on first reply, and we still need to force-qualify them at 5 min.
  const stages = await prisma.stage.findMany({
    where: {
      OR: [
        { name: { in: ['Novo', 'New'], mode: 'insensitive' } },
        { name: { contains: 'em qualifica', mode: 'insensitive' } },
      ],
    },
  });
  if (stages.length === 0) return;
  const stageIds = stages.map((s) => s.id);

  const leads = await prisma.lead.findMany({
    where: {
      stageId: { in: stageIds },
      humanOverride: false,
      conversation: { isNot: null },
    },
    include: {
      stage: true,
      conversation: {
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
    },
  });

  const now = new Date();

  for (const lead of leads) {
    const lastMsg = lead.conversation?.messages[0];
    if (!lastMsg) continue;

    // Conversation age: if >= FORCE_QUALIFY_MINUTES, skip normal re-engage and
    // hand to sellers with whatever data we have.
    const convAgeMin = (now.getTime() - lead.conversation!.createdAt.getTime()) / 60_000;
    if (convAgeMin >= FORCE_QUALIFY_MINUTES) {
      try {
        await forceQualify(lead);
      } catch (err) {
        console.log(JSON.stringify({
          level: 'error',
          msg: '[reengagement] force-qualify failed',
          leadId: lead.id,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
      continue;
    }

    // Only act when the last message is from the agent (lead went silent)
    if (lastMsg.role !== 'agent') continue;

    const minutesSilent = (now.getTime() - lastMsg.createdAt.getTime()) / 60_000;
    if (minutesSilent < SILENCE_MINUTES) continue;

    // Respect min interval between attempts
    if (lead.lastReengagementAt) {
      const hoursSince = (now.getTime() - lead.lastReengagementAt.getTime()) / 3_600_000;
      if (hoursSince < MIN_HOURS_BETWEEN) continue;
    }

    // Exhausted attempts: move to Follow-up stage and stop here
    if (lead.reengagementAttempts >= MAX_ATTEMPTS) {
      await moveToFollowupStage(lead);
      continue;
    }

    try {
      await sendReengagement(lead);
    } catch (err) {
      console.log(JSON.stringify({
        level: 'error',
        msg: '[reengagement] failed for lead',
        leadId: lead.id,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }
}

/**
 * Force-qualify an unqualified lead: fetch missing name from WhatsApp profile,
 * move to Qualificado stage, add note, notify sellers group with whatever data
 * we have. Used when the lead didn't finish qualifying within 10 min.
 */
export async function forceQualify(lead: LeadWithRelations): Promise<void> {
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { status: 'connected' },
    orderBy: { createdAt: 'asc' },
  });

  // 1. Fetch WhatsApp profile name if missing
  if (!lead.name?.trim() && instance) {
    const profile = await evolutionClient.fetchProfile(instance.name, lead.phone).catch(() => null);
    const fetched = profile?.name?.trim();
    if (fetched) {
      await prisma.lead.update({ where: { id: lead.id }, data: { name: fetched } });
      lead.name = fetched;
    }
  }

  // HARD RULE: auto-qualification by time is DISABLED. Only qualify + forward
  // when we have BOTH name AND a usable phone. Otherwise do nothing — the lead
  // is not moved, not noted, not sent to the seller.
  const hasUsablePhone = !!(
    lead.contactPhone?.trim() ||
    (lead.phone && !lead.phone.startsWith('web:'))
  );
  if (!lead.name?.trim() || !hasUsablePhone) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[reengagement] skip force-qualify — missing name or phone',
      leadId: lead.id,
      hasName: Boolean(lead.name?.trim()),
      hasPhone: hasUsablePhone,
    }));
    return;
  }

  // 2. Move to Qualificado stage
  let qualifiedStage: { id: string; name: string } | null = null;
  if (lead.pipelineId) {
    qualifiedStage = await prisma.stage.findFirst({
      where: {
        pipelineId: lead.pipelineId,
        name: { contains: 'qualificado', mode: 'insensitive' },
      },
    });
    if (qualifiedStage && lead.stageId !== qualifiedStage.id) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stageId: qualifiedStage.id } });
      emitLeadMoved({ id: lead.id, stageId: qualifiedStage.id });
    }
  }

  // 3. Internal audit trail — system note (hidden from sellers group summary)
  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      content: 'Auto-qualificado pelo sistema',
      type: 'system',
    },
  });

  // 4. Notify sellers group with the full summary (vehicle + conversation link)
  await notifySellersGroupForLead(lead.id, {
    reason: 'Auto-enviado após 10min sem qualificação completa',
  }).catch(() => {});

  console.log(JSON.stringify({
    level: 'info',
    msg: '[reengagement] force-qualified lead after 10min',
    leadId: lead.id,
    hasName: Boolean(lead.name?.trim()),
    hasCity: Boolean(lead.city?.trim()),
  }));
}

/**
 * One-shot: force-qualify every lead currently in "Novo" regardless of
 * conversation age. Called via POST /reengagement/force-qualify-all.
 */
export async function forceQualifyAllNovo(): Promise<{ processed: number }> {
  const stages = await prisma.stage.findMany({
    where: {
      OR: [
        { name: { in: ['Novo', 'New'], mode: 'insensitive' } },
        { name: { contains: 'em qualifica', mode: 'insensitive' } },
      ],
    },
  });
  const stageIds = stages.map((s) => s.id);
  if (stageIds.length === 0) return { processed: 0 };

  const leads = await prisma.lead.findMany({
    where: { stageId: { in: stageIds }, humanOverride: false },
    include: {
      stage: true,
      conversation: {
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
    },
  });

  let processed = 0;
  for (const lead of leads) {
    try {
      await forceQualify(lead);
      processed++;
    } catch (err) {
      console.log(JSON.stringify({
        level: 'error',
        msg: '[reengagement] batch force-qualify failed',
        leadId: lead.id,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }
  return { processed };
}

type LeadWithRelations = Awaited<ReturnType<typeof prisma.lead.findMany>>[number] & {
  stage: { name: string } | null;
};

async function sendReengagement(lead: LeadWithRelations) {
  const attemptNumber = lead.reengagementAttempts + 1;

  const instance = await prisma.whatsAppInstance.findFirst({
    where: { status: 'connected' },
    orderBy: { createdAt: 'asc' },
  });
  if (!instance) {
    console.log(JSON.stringify({ level: 'warn', msg: '[reengagement] no connected instance', leadId: lead.id }));
    return;
  }

  const conversation = await loadOrCreateConversation(lead.phone, 'whatsapp');

  const missing: string[] = [];
  if (!lead.name?.trim()) missing.push('nome');
  if (!lead.city?.trim()) missing.push('cidade');

  const instruction = `CONTEXTO: Este e um re-engajamento automatico (tentativa ${attemptNumber} de ${MAX_ATTEMPTS}).
O lead parou de responder a mais de ${SILENCE_MINUTES} minutos e ainda esta no estagio "Novo".
${missing.length > 0 ? `Dados que faltam: ${missing.join(' e ')}.` : 'Nome e cidade ja estao preenchidos.'}
${lead.vehicleUrl ? `Veiculo de interesse: ${lead.vehicleUrl}` : ''}

INSTRUCAO: Envie UMA mensagem curta, humanizada e calorosa pra retomar a conversa.
${missing.length > 0
  ? `- Pergunte novamente ${missing.join(' e ')} do lead, EXPLICANDO que precisa desses dados pra passar pro consultor que vai fazer um atendimento personalizado.`
  : '- Reengaje perguntando se o lead ainda tem interesse no veiculo.'}
- Nao pareca robotico. Seja natural, como um vendedor real que percebeu que a conversa esfriou.
- NAO use ferramentas do CRM (update_lead, move_lead_stage, etc) — so envie o texto.
- Responda APENAS com o texto da mensagem, nada mais.`;

  const messageToSend = await runAgentTurn({
    instance: instance.name,
    phoneNumber: lead.phone,
    userMessage: instruction,
    conversationId: conversation.id,
    history: conversation.recentMessages.slice(-10),
    lead: conversation.lead,
  });

  if (messageToSend && messageToSend.trim()) {
    const channel = getChannel('whatsapp');
    await channel.sendText(lead.phone, instance.name, messageToSend);
    emitNewMessage({ conversationId: conversation.id });
    console.log(JSON.stringify({
      level: 'info',
      msg: '[reengagement] sent',
      leadId: lead.id,
      attempt: attemptNumber,
      preview: messageToSend.substring(0, 80),
    }));
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      reengagementAttempts: attemptNumber,
      lastReengagementAt: new Date(),
    },
  });

  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      content: `[Re-engajamento ${attemptNumber}/${MAX_ATTEMPTS}] ${messageToSend?.substring(0, 100) ?? 'Enviado'}`,
      type: 'system',
    },
  });
}

async function moveToFollowupStage(lead: LeadWithRelations) {
  if (!lead.pipelineId) return;

  const followupStage = await prisma.stage.findFirst({
    where: {
      pipelineId: lead.pipelineId,
      name: { contains: EXHAUSTED_STAGE_NAME, mode: 'insensitive' },
    },
  });
  if (!followupStage) {
    console.log(JSON.stringify({
      level: 'warn',
      msg: `[reengagement] no "${EXHAUSTED_STAGE_NAME}" stage found, leaving lead in place`,
      leadId: lead.id,
    }));
    return;
  }

  await prisma.lead.update({ where: { id: lead.id }, data: { stageId: followupStage.id } });
  emitLeadMoved({ id: lead.id, stageId: followupStage.id });

  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      content: `Lead movido para ${followupStage.name} apos ${lead.reengagementAttempts} tentativas de re-engajamento sem resposta.`,
      type: 'system',
    },
  });

  console.log(JSON.stringify({
    level: 'info',
    msg: '[reengagement] moved to follow-up stage after exhausted attempts',
    leadId: lead.id,
  }));
}

async function scheduleScan() {
  const queue = getReengagementQueue();

  const repeatables = await queue.getRepeatableJobs();
  for (const r of repeatables) {
    if (r.id === SCAN_JOB_ID || r.name === 'scan') {
      await queue.removeRepeatableByKey(r.key).catch(() => {});
    }
  }

  await queue.add(
    'scan',
    { type: 'scan' },
    { repeat: { pattern: SCAN_CRON }, jobId: SCAN_JOB_ID },
  );
  console.log(JSON.stringify({ level: 'info', msg: `[reengagement] scheduled every minute (${SCAN_CRON})` }));
}

export function startReengagementWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL must be set');

  worker = new Worker(
    'reengagement',
    async (job: Job) => {
      if (job.name === 'scan' || job.data?.type === 'scan') {
        await scanForSilentLeads();
      }
    },
    { connection: { url: redisUrl }, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.log(JSON.stringify({
      level: 'error',
      msg: '[reengagement] job failed',
      jobId: job?.id,
      error: err.message,
    }));
  });

  scheduleScan().catch((err) => {
    console.log(JSON.stringify({
      level: 'error',
      msg: '[reengagement] failed to schedule scan',
      error: err instanceof Error ? err.message : String(err),
    }));
  });

  return worker;
}

export function getReengagementWorker(): Worker | null {
  return worker;
}
