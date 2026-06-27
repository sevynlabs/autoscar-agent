import { Queue } from 'bullmq';

let messageQueue: Queue | null = null;
let followupQueue: Queue | null = null;
let followupWorkflowQueue: Queue | null = null;
let reengagementQueue: Queue | null = null;
let sellerNotificationQueue: Queue | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL must be set');
  return url;
}

export function getMessageQueue(): Queue {
  if (!messageQueue) {
    messageQueue = new Queue('messages', { connection: { url: getRedisUrl() } });
  }
  return messageQueue!;
}

export function getFollowupQueue(): Queue {
  if (!followupQueue) {
    followupQueue = new Queue('followups', { connection: { url: getRedisUrl() } });
  }
  return followupQueue!;
}

export function getFollowupWorkflowQueue(): Queue {
  if (!followupWorkflowQueue) {
    followupWorkflowQueue = new Queue('followup-workflow', { connection: { url: getRedisUrl() } });
  }
  return followupWorkflowQueue!;
}

export function getReengagementQueue(): Queue {
  if (!reengagementQueue) {
    reengagementQueue = new Queue('reengagement', { connection: { url: getRedisUrl() } });
  }
  return reengagementQueue!;
}

export function getSellerNotificationQueue(): Queue {
  if (!sellerNotificationQueue) {
    sellerNotificationQueue = new Queue('seller-notification', { connection: { url: getRedisUrl() } });
  }
  return sellerNotificationQueue!;
}
