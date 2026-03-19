'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In production: connect through Nginx which proxies /socket.io/ to app:3001
    // In dev: connect directly to backend
    const url = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    socket = io(url, {
      autoConnect: false,
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
