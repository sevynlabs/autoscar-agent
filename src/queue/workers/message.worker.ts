import { Worker, type Job } from 'bullmq';
import { evolutionClient } from '../../whatsapp/evolution.client.js';
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
          msg: 'Processing message job',
          jobId: job.id,
          phone: phoneNumber,
          preview: message.substring(0, 50),
        }),
      );

      // Phase 1: Echo reply
      await evolutionClient.sendText(instance, phoneNumber, `[Echo] ${message}`);

      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'Echo reply sent',
          jobId: job.id,
          phone: phoneNumber,
        }),
      );
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
