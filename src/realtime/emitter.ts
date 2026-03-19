import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketIO(server: SocketIOServer) {
  io = server;
}

export function emit(event: string, data: unknown) {
  if (io) {
    io.emit(event, data);
  }
}

// Specific events matching frontend useSocket hook
export function emitLeadCreated(lead: unknown) { emit('lead:created', lead); }
export function emitLeadUpdated(lead: unknown) { emit('lead:updated', lead); }
export function emitLeadMoved(lead: unknown) { emit('lead:moved', lead); }
export function emitNewMessage(message: unknown) { emit('conversation:message', message); }
export function emitConversationUpdated(conversation: unknown) { emit('conversation:updated', conversation); }
