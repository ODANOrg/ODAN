import { Server, Socket } from 'socket.io';
import { prisma } from '../../plugins/prisma.js';
import { cache } from '../../plugins/redis.js';
import { createContextLogger } from '../../utils/logger.js';
import { ChatMessage, TypingEvent } from '../../types/index.js';
import { CONFIG } from '../../config/index.js';

const logger = createContextLogger('Socket.IO');

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
  userAvatar?: string;
}

// Store for active chat rooms and whether they're being recorded
const recordingRooms = new Set<string>();

export function setupSocketIO(io: Server): void {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT token manually (since we're outside Fastify context)
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, CONFIG.jwt.secret) as { id: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, avatar: true, isBanned: true },
      });

      if (!user || user.isBanned) {
        return next(new Error('User not found or banned'));
      }

      socket.userId = user.id;
      socket.userName = user.name;
      socket.userAvatar = user.avatar || undefined;

      next();
    } catch (error) {
      logger.error('Socket authentication failed', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`User connected: ${socket.userId}`);

    // Join ticket room
    socket.on('join:ticket', async (ticketId: string) => {
      try {
        // Verify user has access to ticket
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { creatorId: true, volunteerId: true },
        });

        if (!ticket) {
          socket.emit('error', { message: 'Ticket not found' });
          return;
        }

        // Only creator, volunteer, or moderators can join
        const user = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { role: true },
        });

        const canJoin = 
          ticket.creatorId === socket.userId ||
          ticket.volunteerId === socket.userId ||
          ['MODERATOR', 'ADMIN'].includes(user?.role || '');

        if (!canJoin) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`ticket:${ticketId}`);
        logger.debug(`User ${socket.userId} joined ticket ${ticketId}`);

        // Notify room
        socket.to(`ticket:${ticketId}`).emit('user:joined', {
          userId: socket.userId,
          userName: socket.userName,
        });

        // Get online users in room
        const room = io.sockets.adapter.rooms.get(`ticket:${ticketId}`);
        const onlineCount = room ? room.size : 1;
        socket.emit('room:info', { 
          ticketId, 
          onlineCount,
          isRecording: recordingRooms.has(ticketId),
        });
      } catch (error) {
        logger.error('Error joining ticket room', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave ticket room
    socket.on('leave:ticket', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
      socket.to(`ticket:${ticketId}`).emit('user:left', {
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    // Send message
    socket.on('message:send', async (data: { ticketId: string; content: string; type?: 'TEXT' | 'IMAGE' }) => {
      try {
        const { ticketId, content, type = 'TEXT' } = data;

        if (!content || content.trim().length === 0) {
          return;
        }

        // Moderate content before sending
        try {
          const moderationResponse = await fetch(`${CONFIG.urls.aiService}/moderate/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content }),
          });

          const moderation = await moderationResponse.json() as { isSafe: boolean; reason?: string };

          if (!moderation.isSafe) {
            socket.emit('message:blocked', { 
              reason: moderation.reason || 'Content flagged as inappropriate' 
            });
            return;
          }
        } catch (error) {
          // If moderation service is down, allow message but log warning
          logger.warn('Moderation service unavailable, allowing message');
        }

        const message: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content,
          type,
          senderId: socket.userId!,
          senderName: socket.userName!,
          senderAvatar: socket.userAvatar,
          ticketId,
          timestamp: new Date(),
        };

        // Broadcast to room
        io.to(`ticket:${ticketId}`).emit('message:new', message);

        // If room is being recorded (due to report), save message
        if (recordingRooms.has(ticketId)) {
          await prisma.message.create({
            data: {
              id: message.id,
              content: message.content,
              type: message.type,
              senderId: message.senderId,
              ticketId: message.ticketId,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          });
        }

        // Cache recent messages temporarily for reconnection
        const cacheKey = `chat:${ticketId}:recent`;
        const recentMessages = await cache.get<ChatMessage[]>(cacheKey) || [];
        recentMessages.push(message);
        
        // Keep only last 50 messages in cache
        const trimmedMessages = recentMessages.slice(-50);
        await cache.set(cacheKey, trimmedMessages, 3600); // 1 hour

      } catch (error) {
        logger.error('Error sending message', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (ticketId: string) => {
      socket.to(`ticket:${ticketId}`).emit('typing:update', {
        ticketId,
        userId: socket.userId,
        userName: socket.userName,
        isTyping: true,
      } as TypingEvent);
    });

    socket.on('typing:stop', (ticketId: string) => {
      socket.to(`ticket:${ticketId}`).emit('typing:update', {
        ticketId,
        userId: socket.userId,
        userName: socket.userName,
        isTyping: false,
      } as TypingEvent);
    });

    // Get recent messages (on join)
    socket.on('messages:get', async (ticketId: string) => {
      const cacheKey = `chat:${ticketId}:recent`;
      const messages = await cache.get<ChatMessage[]>(cacheKey) || [];
      socket.emit('messages:history', messages);
    });

    // Report - starts recording
    socket.on('report:start', async (data: { ticketId: string; reason: string }) => {
      try {
        const { ticketId, reason } = data;

        // Create report
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { creatorId: true, volunteerId: true },
        });

        if (!ticket) return;

        const reportedId = socket.userId === ticket.creatorId 
          ? ticket.volunteerId 
          : ticket.creatorId;

        if (!reportedId) return;

        await prisma.report.create({
          data: {
            reporterId: socket.userId!,
            reportedId,
            ticketId,
            reason: 'OTHER',
            description: reason,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        });

        // Start recording
        recordingRooms.add(ticketId);

        // Save cached messages to database
        const cacheKey = `chat:${ticketId}:recent`;
        const messages = await cache.get<ChatMessage[]>(cacheKey) || [];
        
        for (const msg of messages) {
          await prisma.message.create({
            data: {
              id: msg.id,
              content: msg.content,
              type: msg.type,
              senderId: msg.senderId,
              ticketId: msg.ticketId,
              createdAt: new Date(msg.timestamp),
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          }).catch(() => {}); // Ignore duplicates
        }

        // Notify room that recording has started
        io.to(`ticket:${ticketId}`).emit('recording:started', {
          message: 'This conversation is now being recorded due to a report',
        });

        socket.emit('report:submitted', { success: true });

      } catch (error) {
        logger.error('Error creating report', error);
        socket.emit('error', { message: 'Failed to submit report' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });

  // Periodic cleanup of expired messages
  setInterval(async () => {
    try {
      const deleted = await prisma.message.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      if (deleted.count > 0) {
        logger.debug(`Cleaned up ${deleted.count} expired messages`);
      }
    } catch (error) {
      logger.error('Error cleaning up messages', error);
    }
  }, 60 * 60 * 1000); // Every hour
}
