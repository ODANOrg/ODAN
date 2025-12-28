'use client';

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;
    
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
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
  s.emit('join-ticket', ticketId);
}

export function leaveTicketChat(ticketId: string): void {
  const s = getSocket();
  s.emit('leave-ticket', ticketId);
}

export function sendMessage(ticketId: string, content: string): void {
  const s = getSocket();
  s.emit('message', { ticketId, content });
}

export function sendTyping(ticketId: string): void {
  const s = getSocket();
  s.emit('typing', { ticketId });
}

export function stopTyping(ticketId: string): void {
  const s = getSocket();
  s.emit('stop-typing', { ticketId });
}

// Whiteboard functions
export function sendWhiteboardAction(ticketId: string, action: any): void {
  const s = getSocket();
  s.emit('whiteboard-action', { ticketId, action });
}
