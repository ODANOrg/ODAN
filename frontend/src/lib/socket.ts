'use client';

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;
const RESOLVED_SOCKET_URL = SOCKET_URL && SOCKET_URL.length > 0 ? SOCKET_URL : undefined;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;
    
    socket = io(RESOLVED_SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
      path: '/socket.io',
    });
  }
  
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Chat-specific functions
export function joinTicketChat(ticketId: string): void {
  const s = getSocket();
  s.emit('join:ticket', ticketId);
  s.emit('messages:get', ticketId);
}

export function leaveTicketChat(ticketId: string): void {
  const s = getSocket();
  s.emit('leave:ticket', ticketId);
}

export function sendMessage(ticketId: string, content: string): void {
  const s = getSocket();
  s.emit('message:send', { ticketId, content });
}

export function sendTyping(ticketId: string): void {
  const s = getSocket();
  s.emit('typing:start', ticketId);
}

export function stopTyping(ticketId: string): void {
  const s = getSocket();
  s.emit('typing:stop', ticketId);
}

// Whiteboard functions
export function sendWhiteboardAction(ticketId: string, action: any): void {
  const s = getSocket();
  s.emit('whiteboard:action', { ticketId, action });
}
