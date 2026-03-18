import 'dotenv/config';
import { buildServer } from './api/server.js';
import { startMessageWorker, getMessageWorker } from './queue/workers/message.worker.js';

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

  // Start BullMQ message worker
  const worker = startMessageWorker();
  server.log.info('Message worker started (concurrency: 5)');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);

    const messageWorker = getMessageWorker();
    if (messageWorker) {
      await messageWorker.close();
      server.log.info('Message worker closed');
    }

    await server.close();
    server.log.info('Server closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
