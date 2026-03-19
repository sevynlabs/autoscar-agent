import 'dotenv/config';
import { buildServer } from './api/server.js';
import { startMessageWorker, getMessageWorker } from './queue/workers/message.worker.js';
import { startFollowupWorker, getFollowupWorker } from './queue/workers/followup.worker.js';
import { startFollowupWorkflowWorker, getFollowupWorkflowWorker } from './queue/workers/followup-workflow.worker.js';

async function main() {
  const server = await buildServer();

  const port = server.config.APP_PORT || 3000;

  try {
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Start BullMQ workers
  startMessageWorker();
  server.log.info('Message worker started (concurrency: 5)');

  startFollowupWorker();
  server.log.info('Follow-up worker started (concurrency: 3)');

  startFollowupWorkflowWorker();
  server.log.info('Follow-up workflow started (daily at 9am)');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);

    const messageWorker = getMessageWorker();
    if (messageWorker) { await messageWorker.close(); server.log.info('Message worker closed'); }

    const followupWorker = getFollowupWorker();
    if (followupWorker) { await followupWorker.close(); server.log.info('Follow-up worker closed'); }

    const wfWorker = getFollowupWorkflowWorker();
    if (wfWorker) { await wfWorker.close(); server.log.info('Follow-up workflow worker closed'); }

    await server.close();
    server.log.info('Server closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
