import { Worker, type Job } from 'bullmq';
import { runAgentTurn } from '../../agent/agent.service.js';
import { loadOrCreateConversation } from '../../conversation/conversation.service.js';
import { evolutionClient } from '../../whatsapp/evolution.client.js';
import prisma from '../../db/prisma.js';
import { getFollowupQueue } from '../queues.js';
import { emitNewMessage, emitConversationUpdated } from '../../realtime/emitter.js';
import type { MessageJobData } from '../jobs/message.job.js';

let worker: Worker | null = null;

export function startMessageWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL must be set');
  }

  worker = new Worker(
    'messages',
    async (job: Job) => {
      const { instance, phoneNumber, message } = job.data as MessageJobData;

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
        // 1. Cancel any pending follow-up (lead replied)
        try {
          const followupQueue = getFollowupQueue();
          await followupQueue.remove(`followup-${phoneNumber}`);
        } catch {
          /* followup queue may not exist yet — Plan 03 adds the worker */
        }

        // 2. Load or create conversation
        const conversation = await loadOrCreateConversation(phoneNumber);

        // 3. Check humanOverride — skip AI if operator has taken over
        const lead = await prisma.lead.findFirst({
          where: { phone: phoneNumber },
        });
        if (lead?.humanOverride === true) {
          console.log(
            JSON.stringify({
              level: 'info',
              msg: 'Human override active, skipping AI',
              phone: phoneNumber,
            }),
          );
          return;
        }

        // 4. Run agentic loop
        const reply = await runAgentTurn({
          instance,
          phoneNumber,
          userMessage: message,
          conversationId: conversation.id,
          history: conversation.recentMessages,
          lead: conversation.lead,
        });

        // 5. Send reply to lead + emit real-time events
        if (reply && reply.trim()) {
          await evolutionClient.sendText(instance, phoneNumber, reply);
          emitNewMessage({ conversationId: conversation.id });
          emitConversationUpdated({ id: conversation.id });
        }

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

        // Send fallback message to lead
        try {
          await evolutionClient.sendText(
            instance,
            phoneNumber,
            'Desculpe, ocorreu um erro. Um vendedor vai entrar em contato.',
          );
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
