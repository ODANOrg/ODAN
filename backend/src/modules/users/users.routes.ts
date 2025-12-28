import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { JWTPayload } from '../auth/auth.plugin.js';

// Schemas
const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  locale: z.enum(['en', 'pt-BR', 'es']).optional(),
});

const userIdParamSchema = z.object({
  id: z.string(),
});

export default async function userRoutes(server: FastifyInstance) {
  // Get user profile
  server.get('/:id', {
    preHandler: [server.authenticateOptional],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = userIdParamSchema.parse(request.params);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
        totalTimeSpent: true,
        ticketsCreated: true,
        ticketsResolved: true,
        peopleHelped: true,
        _count: {
          select: {
            certificates: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return { success: true, data: user };
  });

  // Update current user profile
  server.patch('/me', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const updates = updateUserSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: payload.id },
      data: updates,
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        locale: true,
      },
    });

    return { success: true, data: user };
  });

  // Get user statistics
  server.get('/me/stats', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        totalTimeSpent: true,
        ticketsCreated: true,
        ticketsResolved: true,
        peopleHelped: true,
        _count: {
          select: {
            certificates: true,
            ticketsAsVolunteer: {
              where: { status: 'RESOLVED' },
            },
            responses: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Format time spent
    const hours = Math.floor(user.totalTimeSpent / 3600);
    const minutes = Math.floor((user.totalTimeSpent % 3600) / 60);

    return {
      success: true,
      data: {
        totalTimeSpent: user.totalTimeSpent,
        formattedTimeSpent: `${hours}h ${minutes}m`,
        ticketsCreated: user.ticketsCreated,
        ticketsResolved: user.ticketsResolved,
        peopleHelped: user.peopleHelped,
        certificatesIssued: user._count.certificates,
        totalResponses: user._count.responses,
      },
    };
  });

  // Get user's tickets
  server.get('/me/tickets', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const query = request.query as { page?: string; limit?: string; type?: 'created' | 'helped' };
    
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const type = query.type || 'created';

    const where = type === 'created'
      ? { creatorId: payload.id }
      : { volunteerId: payload.id };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          _count: {
            select: { responses: true },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      success: true,
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // Get user's certificates
  server.get('/me/certificates', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;

    const certificates = await prisma.certificate.findMany({
      where: { userId: payload.id },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        code: true,
        periodStart: true,
        periodEnd: true,
        hoursSpent: true,
        ticketsHelped: true,
        peopleHelped: true,
        issuedAt: true,
        blockchainHash: true,
      },
    });

    return { success: true, data: certificates };
  });

  // Promote user to volunteer (admin only)
  server.post('/:id/promote', {
    preHandler: [server.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = userIdParamSchema.parse(request.params);
    const body = z.object({ role: z.enum(['VOLUNTEER', 'MODERATOR']) }).parse(request.body);

    const user = await prisma.user.update({
      where: { id },
      data: { role: body.role },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    return { success: true, data: user };
  });

  // Ban user (moderator/admin)
  server.post('/:id/ban', {
    preHandler: [server.requireModerator],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = userIdParamSchema.parse(request.params);
    const body = z.object({
      reason: z.string().min(10),
      duration: z.number().min(1).optional(), // hours, optional for permanent
    }).parse(request.body);

    const moderator = request.user as JWTPayload;

    // Can't ban yourself
    if (id === moderator.id) {
      throw new ForbiddenError('Cannot ban yourself');
    }

    // Check target user role
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    // Can't ban admins
    if (targetUser.role === 'ADMIN') {
      throw new ForbiddenError('Cannot ban administrators');
    }

    // Moderators can only ban users
    if (moderator.role === 'MODERATOR' && targetUser.role !== 'USER') {
      throw new ForbiddenError('Insufficient permissions to ban this user');
    }

    const bannedUntil = body.duration
      ? new Date(Date.now() + body.duration * 60 * 60 * 1000)
      : null;

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          isBanned: true,
          bannedUntil,
          banReason: body.reason,
        },
      }),
      prisma.moderationLog.create({
        data: {
          userId: id,
          moderatorId: moderator.id,
          action: body.duration ? 'TEMPORARY_BAN' : 'PERMANENT_BAN',
          reason: body.reason,
          duration: body.duration,
          expiresAt: bannedUntil,
        },
      }),
    ]);

    return { success: true, message: 'User banned successfully' };
  });

  // Unban user (moderator/admin)
  server.post('/:id/unban', {
    preHandler: [server.requireModerator],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = userIdParamSchema.parse(request.params);

    await prisma.user.update({
      where: { id },
      data: {
        isBanned: false,
        bannedUntil: null,
        banReason: null,
      },
    });

    return { success: true, message: 'User unbanned successfully' };
  });
}
