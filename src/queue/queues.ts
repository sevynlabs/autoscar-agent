import { Queue } from 'bullmq';
import type { MessageJobData } from './jobs/message.job.js';

let messageQueue: Queue | null = null;

export function getMessageQueue(): Queue {
  if (!messageQueue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL must be set');
    }

    messageQueue = new Queue('messages', {
      connection: { url: redisUrl },
    });
  }

  return messageQueue!;
}

let followupQueue: Queue | null = null;

export function getFollowupQueue(): Queue {
  if (!followupQueue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL must be set');
    }

    followupQueue = new Queue('followups', {
      connection: { url: redisUrl },
    });
  }

  return followupQueue!;
}
