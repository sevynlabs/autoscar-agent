import fp from 'fastify-plugin';
import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { setSocketIO } from '../../realtime/emitter.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

export const socketPlugin = fp(
  async (fastify: FastifyInstance) => {
    const io = new SocketIOServer(fastify.server, {
      cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      fastify.log.info({ socketId: socket.id }, 'Socket.IO client connected');

      socket.on('disconnect', (reason) => {
        fastify.log.info(
          { socketId: socket.id, reason },
          'Socket.IO client disconnected',
        );
      });
    });

    fastify.decorate('io', io);
    setSocketIO(io);

    fastify.addHook('onClose', async () => {
      io.close();
    });
  },
  { name: 'socket-io' },
);
