import { Worker, type Job } from 'bullmq';
import { getChannel } from '../../channels/channel.manager.js';
import { appendMessages } from '../../conversation/conversation.service.js';
import { emitNewMessage } from '../../realtime/emitter.js';
import { fireWebhooks } from '../../webhooks/webhook.service.js';
import prisma from '../../db/prisma.js';
import { getFollowupQueue } from '../queues.js';
import type { FollowupJobData } from '../jobs/followup.job.js';

const WHATSAPP_MESSAGES = [
  'Oi! Vi que voce se interessou por um veiculo. Ainda esta interessado? Posso ajudar com mais informacoes!',
  'Ola! So passando para saber se ainda tem interesse no veiculo. Estou a disposicao para qualquer duvida!',
];

const SMS_MESSAGE = 'Oi! Sou da Autoscar. Vi seu interesse em um veiculo. Responda esta mensagem ou nos chame no WhatsApp para mais informacoes!';

const MAX_WHATSAPP_FOLLOWUPS = 2;
const FOLLOWUP_DELAY = 24 * 60 * 60 * 1000; // 24 hours

let followupWorker: Worker | null = null;

export function startFollowupWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL must be set');

  const worker = new Worker(
    'followups',
    async (job: Job) => {
      const { instance, phoneNumber, followupNumber, leadId } = job.data as FollowupJobData;

      console.log(JSON.stringify({ level: 'info', msg: 'Sending follow-up', phone: phoneNumber, followupNumber }));

      // Check if lead has responded (humanOverride or new messages since last follow-up)
      if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead?.humanOverride) {
          console.log(JSON.stringify({ level: 'info', msg: 'Lead under human control, skipping follow-up', phone: phoneNumber }));
          return;
        }
      }

      if (followupNumber <= MAX_WHATSAPP_FOLLOWUPS) {
        // WhatsApp follow-up
        const msgIndex = Math.min(followupNumber - 1, WHATSAPP_MESSAGES.length - 1);
        const waChannel = getChannel('whatsapp');
        await waChannel.sendText(phoneNumber, instance, WHATSAPP_MESSAGES[msgIndex]);

        // Save to conversation
        if (leadId) {
          const conversation = await prisma.conversation.findFirst({ where: { leadId } });
          if (conversation) {
            await appendMessages(conversation.id, [{ role: 'agent', content: `[Follow-up ${followupNumber}] ${WHATSAPP_MESSAGES[msgIndex]}` }]);
            emitNewMessage({ conversationId: conversation.id });
          }
        }

        // Schedule next
        const followupQueue = getFollowupQueue();
        await followupQueue.add('followup', {
          leadId, instance, phoneNumber,
          followupNumber: followupNumber + 1,
        } satisfies FollowupJobData, {
          delay: FOLLOWUP_DELAY,
          jobId: `followup-${phoneNumber}`,
        });

        console.log(JSON.stringify({ level: 'info', msg: 'Next follow-up scheduled', phone: phoneNumber, next: followupNumber + 1 }));
      } else if (followupNumber === MAX_WHATSAPP_FOLLOWUPS + 1) {
        // SMS escalation — final attempt
        console.log(JSON.stringify({ level: 'info', msg: 'Escalating to SMS', phone: phoneNumber }));

        try {
          const smsChannel = getChannel('sms');
          await smsChannel.sendText(phoneNumber, instance, SMS_MESSAGE);

          if (leadId) {
            const conversation = await prisma.conversation.findFirst({ where: { leadId } });
            if (conversation) {
              await appendMessages(conversation.id, [{ role: 'agent', content: `[SMS Follow-up] ${SMS_MESSAGE}` }]);
              emitNewMessage({ conversationId: conversation.id });
            }
          }

          console.log(JSON.stringify({ level: 'info', msg: 'SMS follow-up sent', phone: phoneNumber }));
        } catch (err) {
          console.log(JSON.stringify({ level: 'warn', msg: 'SMS follow-up failed (Twilio not configured?)', error: err instanceof Error ? err.message : String(err) }));
        }

        // Fire webhook — lead went cold
        if (leadId) {
          fireWebhooks('lead.followup_exhausted', { leadId, phone: phoneNumber, attempts: followupNumber }).catch(() => {});
        }
      }
    },
    { connection: { url: redisUrl }, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.log(JSON.stringify({ level: 'error', msg: 'Follow-up job failed', jobId: job?.id, error: err.message }));
  });

  followupWorker = worker;
  return worker;
}

export function getFollowupWorker(): Worker | null {
  return followupWorker;
}
