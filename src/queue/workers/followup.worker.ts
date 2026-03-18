import { Worker, type Job } from 'bullmq';
import { evolutionClient } from '../../whatsapp/evolution.client.js';
import { getFollowupQueue } from '../queues.js';
import type { FollowupJobData } from '../jobs/followup.job.js';

const FOLLOWUP_MESSAGES = [
  'Oi! Vi que voce se interessou por um veiculo. Ainda esta interessado? Posso ajudar com mais informacoes!',
  'Ola! So passando para saber se ainda tem interesse no veiculo. Estou a disposicao para qualquer duvida!',
];

const MAX_FOLLOWUPS = 2;
const SECOND_FOLLOWUP_DELAY = 48 * 60 * 60 * 1000; // 48 hours

let followupWorker: Worker | null = null;

export function startFollowupWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL must be set');

  const worker = new Worker(
    'followups',
    async (job: Job) => {
      const { instance, phoneNumber, followupNumber, leadId } =
        job.data as FollowupJobData;

      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'Sending follow-up',
          jobId: job.id,
          phone: phoneNumber,
          followupNumber,
        }),
      );

      // Send the follow-up message (use template based on followup number)
      const messageIndex = Math.min(
        followupNumber - 1,
        FOLLOWUP_MESSAGES.length - 1,
      );
      await evolutionClient.sendText(
        instance,
        phoneNumber,
        FOLLOWUP_MESSAGES[messageIndex],
      );

      // Schedule next follow-up if under MAX_FOLLOWUPS
      if (followupNumber < MAX_FOLLOWUPS) {
        const followupQueue = getFollowupQueue();
        await followupQueue.add(
          'followup',
          {
            leadId,
            instance,
            phoneNumber,
            followupNumber: followupNumber + 1,
          } satisfies FollowupJobData,
          {
            delay: SECOND_FOLLOWUP_DELAY,
            jobId: `followup-${phoneNumber}`,
          },
        );
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'Next follow-up scheduled',
            phone: phoneNumber,
            followupNumber: followupNumber + 1,
            delayHours: 48,
          }),
        );
      } else {
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'Max follow-ups reached',
            phone: phoneNumber,
          }),
        );
      }
    },
    { connection: { url: redisUrl }, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.log(
      JSON.stringify({
        level: 'error',
        msg: 'Follow-up job failed',
        jobId: job?.id,
        error: err.message,
      }),
    );
  });

  followupWorker = worker;
  return worker;
}

export function getFollowupWorker(): Worker | null {
  return followupWorker;
}
