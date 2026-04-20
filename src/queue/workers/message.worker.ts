import { Worker, type Job } from 'bullmq';
import { runAgentTurn } from '../../agent/agent.service.js';
import { getActiveAgent, isChannelEnabled, isInstanceEnabled } from '../../agent/agent.prompts.js';
import { loadOrCreateConversation } from '../../conversation/conversation.service.js';
import { getChannel } from '../../channels/channel.manager.js';
import prisma from '../../db/prisma.js';
import { getFollowupQueue } from '../queues.js';
import { emitNewMessage, emitConversationUpdated, emitLeadMoved } from '../../realtime/emitter.js';
import { fireWebhooks } from '../../webhooks/webhook.service.js';
import { notifySellersGroupForLead } from '../../crm/seller-notification.service.js';
import type { MessageJobData } from '../jobs/message.job.js';

let worker: Worker | null = null;

/**
 * Deterministic post-turn enforcement:
 *  - If the lead is fully filled (name + city + vehicle) and still in Novo/Em
 *    Qualificacao, auto-move to Qualificado so the LLM can't forget.
 *  - If the lead is in a terminal stage (Qualificado / Desqualificado) and has
 *    not been notified yet, fire the sellers-group notification with the full
 *    summary including vehicle link + conversation link.
 */
async function postTurnHook(leadId: string | undefined): Promise<void> {
  if (!leadId) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { stage: true },
  });
  if (!lead) return;

  const stageName = lead.stage?.name?.toLowerCase() ?? '';
  const inPreQualStage =
    stageName === 'novo' ||
    stageName === 'new' ||
    stageName.includes('em qualifica');
  const isQualified = stageName.includes('qualificado') && !stageName.includes('des');
  const isDisqualified = stageName.includes('desqualificado');
  const hasAllData = !!(lead.name?.trim() && lead.city?.trim() && lead.vehicleUrl?.trim());

  // Auto-qualify when all data is present but the LLM forgot to move the stage
  if (inPreQualStage && hasAllData && lead.pipelineId) {
    const qualifiedStage = await prisma.stage.findFirst({
      where: {
        pipelineId: lead.pipelineId,
        name: { contains: 'qualificado', mode: 'insensitive', not: { contains: 'des' } },
      },
    });
    if (qualifiedStage && qualifiedStage.id !== lead.stageId) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stageId: qualifiedStage.id } });
      emitLeadMoved({ id: lead.id, stageId: qualifiedStage.id });
      await prisma.leadNote.create({
        data: {
          leadId: lead.id,
          content: 'Auto-qualificado pelo sistema: nome, cidade e veículo presentes.',
          type: 'ai',
        },
      });
      await notifySellersGroupForLead(lead.id, { reason: 'Auto-qualificado (todos os dados coletados)' }).catch(() => {});
      return;
    }
  }

  // Notify on first entry into a terminal stage
  if ((isQualified || isDisqualified) && !lead.sellerNotifiedAt) {
    const reason = isQualified ? 'Lead qualificado' : 'Lead desqualificado pelo agente';
    await notifySellersGroupForLead(lead.id, { reason }).catch(() => {});
  }
}

export function startMessageWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL must be set');
  }

  worker = new Worker(
    'messages',
    async (job: Job) => {
      const { instance, phoneNumber, message, pushName, channel: msgChannel } = job.data as MessageJobData;
      const channelName = msgChannel ?? 'whatsapp';

      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'Processing message',
          jobId: job.id,
          phone: phoneNumber,
          preview: message.substring(0, 50),
        }),
      );

      try {
        // 1. Cancel any pending follow-up + reset attempts (lead replied)
        try {
          const followupQueue = getFollowupQueue();
          await followupQueue.remove(`followup-${phoneNumber}`);
        } catch { /* ok */ }

        // Reset follow-up attempts since lead responded
        await prisma.lead.updateMany({
          where: { phone: phoneNumber, followupAttempts: { gt: 0 } },
          data: { followupAttempts: 0 },
        });

        // 2. Load or create conversation (with channel)
        const conversation = await loadOrCreateConversation(phoneNumber, channelName);

        // 2.1 Save the WhatsApp pushName on the lead if we still don't have a name.
        // This is the name the contact set on their own WhatsApp account.
        if (pushName && conversation.lead && !conversation.lead.name?.trim()) {
          await prisma.lead.update({
            where: { id: conversation.lead.id },
            data: { name: pushName },
          }).catch(() => { /* non-critical */ });
          conversation.lead.name = pushName;
        }

        // 3. Check if agent responds on this channel + instance
        const activeAgent = await getActiveAgent();
        if (!isChannelEnabled(activeAgent, channelName)) {
          console.log(JSON.stringify({ level: 'info', msg: 'Agent disabled for this channel', channel: channelName, phone: phoneNumber }));
          return;
        }
        if (!isInstanceEnabled(activeAgent, instance)) {
          console.log(JSON.stringify({ level: 'info', msg: 'Agent not assigned to this instance', instance, phone: phoneNumber }));
          return;
        }

        // 4. Check humanOverride — skip AI if operator has taken over
        const lead = await prisma.lead.findFirst({
          where: { phone: phoneNumber },
        });
        if (lead?.humanOverride === true) {
          console.log(JSON.stringify({ level: 'info', msg: 'Human override active, skipping AI', phone: phoneNumber }));
          return;
        }

        // 5. Run agentic loop
        const reply = await runAgentTurn({
          instance,
          phoneNumber,
          userMessage: message,
          conversationId: conversation.id,
          history: conversation.recentMessages,
          lead: conversation.lead,
          sellersGroupJid: activeAgent?.sellersGroupJid,
        });

        // 6. Send reply via appropriate channel + emit real-time events
        if (reply && reply.trim()) {
          // Emit to frontend regardless of send success
          emitNewMessage({ conversationId: conversation.id });
          emitConversationUpdated({ id: conversation.id });

          try {
            const ch = getChannel(channelName);
            await ch.sendText(phoneNumber, instance, reply);
          } catch (sendErr) {
            console.log(JSON.stringify({ level: 'warn', msg: 'Failed to send reply (channel may be offline)', phone: phoneNumber, error: sendErr instanceof Error ? sendErr.message : String(sendErr) }));
          }
        }

        // 6.5. Deterministic post-turn hook — never trust the LLM to qualify or notify
        await postTurnHook(conversation.lead?.id).catch((err) => {
          console.log(JSON.stringify({
            level: 'error',
            msg: 'post-turn hook failed',
            leadId: conversation.lead?.id,
            error: err instanceof Error ? err.message : String(err),
          }));
        });

        // 6. Schedule follow-up (Plan 03 will implement the worker)
        try {
          const followupQueue = getFollowupQueue();
          await followupQueue.add(
            'followup',
            {
              leadId: conversation.lead?.id,
              instance,
              phoneNumber,
              followupNumber: 1,
            },
            {
              delay: 24 * 60 * 60 * 1000,
              jobId: `followup-${phoneNumber}`,
            },
          );
        } catch {
          /* follow-up queue not available yet */
        }

        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'Agent reply sent',
            jobId: job.id,
            phone: phoneNumber,
          }),
        );
      } catch (err) {
        console.log(
          JSON.stringify({
            level: 'error',
            msg: 'Unexpected error processing message',
            jobId: job.id,
            phone: phoneNumber,
            error: err instanceof Error ? err.message : String(err),
          }),
        );

        // Send fallback message to lead via appropriate channel
        try {
          const ch = getChannel(channelName);
          await ch.sendText(phoneNumber, instance, 'Desculpe, ocorreu um erro. Um vendedor vai entrar em contato.');
        } catch {
          /* if even fallback fails, let BullMQ retry handle it */
        }
      }
    },
    {
      connection: { url: redisUrl },
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.log(
      JSON.stringify({
        level: 'error',
        msg: 'Message job failed',
        jobId: job?.id,
        error: err.message,
      }),
    );
  });

  return worker;
}

export function getMessageWorker(): Worker | null {
  return worker;
}
