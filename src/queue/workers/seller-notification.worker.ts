import { Worker, Job } from 'bullmq';
import prisma from '../../db/prisma.js';
import { notifySellersGroupForLead } from '../../crm/seller-notification.service.js';
import type { SellerNotificationJobData } from '../jobs/seller-notification.job.js';

let worker: Worker | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL must be set');
  return url;
}

async function processSellerNotification(job: Job<SellerNotificationJobData>): Promise<void> {
  const { leadId, vehicleUrl, reason } = job.data;

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notification-worker] Processing delayed notification',
    leadId,
    vehicleUrl,
    reason,
  }));

  // Re-fetch the lead to check current state
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      vehicleUrl: true,
      sellerNotifiedAt: true,
      name: true,
      phone: true,
      contactPhone: true,
    },
  });

  if (!lead) {
    console.log(JSON.stringify({
      level: 'warn',
      msg: '[seller-notification-worker] Lead not found, skipping',
      leadId,
    }));
    return;
  }

  // Check if vehicle URL changed since job was scheduled
  if (lead.vehicleUrl !== vehicleUrl) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notification-worker] Vehicle URL changed, skipping (new job will be scheduled)',
      leadId,
      originalVehicleUrl: vehicleUrl,
      currentVehicleUrl: lead.vehicleUrl,
    }));
    return;
  }

  // Check if already notified for this vehicle
  if (lead.sellerNotifiedAt) {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notification-worker] Already notified for this vehicle, skipping',
      leadId,
      sellerNotifiedAt: lead.sellerNotifiedAt,
    }));
    return;
  }

  // Send the notification
  const result = await notifySellersGroupForLead(leadId, { reason });

  console.log(JSON.stringify({
    level: 'info',
    msg: '[seller-notification-worker] Notification result',
    leadId,
    result,
  }));
}

export function startSellerNotificationWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<SellerNotificationJobData>(
    'seller-notification',
    processSellerNotification,
    {
      connection: { url: getRedisUrl() },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(JSON.stringify({
      level: 'info',
      msg: '[seller-notification-worker] Job completed',
      jobId: job.id,
      leadId: job.data.leadId,
    }));
  });

  worker.on('failed', (job, err) => {
    console.log(JSON.stringify({
      level: 'error',
      msg: '[seller-notification-worker] Job failed',
      jobId: job?.id,
      leadId: job?.data.leadId,
      error: err.message,
    }));
  });

  console.log('[seller-notification-worker] Started');
  return worker;
}

export function stopSellerNotificationWorker(): Promise<void> {
  if (!worker) return Promise.resolve();
  return worker.close();
}
