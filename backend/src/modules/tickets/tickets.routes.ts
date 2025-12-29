import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { JWTPayload } from '../auth/auth.plugin.js';
import { 
  indexTicket, 
  updateTicketIndex, 
  searchSimilarTickets, 
  checkForDuplicate 
} from '../../plugins/elasticsearch.js';
import { addRecord, BlockchainRecordType } from '../blockchain/blockchain.service.js';

// Schemas
const createTicketSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(30).max(5000),
  category: z.string().min(1),
  images: z.array(z.string()).max(5).optional(),
});

const updateTicketSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  description: z.string().min(30).max(5000).optional(),
  category: z.string().min(1).optional(),
});

const ticketIdParamSchema = z.object({
  id: z.string(),
});

const listQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
});

export default async function ticketRoutes(server: FastifyInstance) {
  // Check for similar tickets before creating
  server.post('/check-similar', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest) => {
    const body = z.object({
      title: z.string().min(5),
      description: z.string().min(10),
    }).parse(request.body);

    // Check for exact duplicate
    const duplicate = await checkForDuplicate(body.title, body.description);
    
    if (duplicate.isDuplicate) {
      return {
        success: true,
        data: {
          isDuplicate: true,
          duplicate: {
            id: duplicate.duplicateId,
            title: duplicate.duplicateTitle,
            similarity: duplicate.similarity,
          },
        },
      };
    }

    // Search for similar tickets
    const similar = await searchSimilarTickets(
      `${body.title} ${body.description}`,
      { limit: 5, minScore: 0.3 }
    );

    // Get additional info for similar tickets
    const similarWithInfo = await Promise.all(
      similar.map(async (ticket) => {
        const fullTicket = await prisma.ticket.findUnique({
          where: { id: ticket.id },
          select: {
            status: true,
            _count: {
              select: { responses: true },
            },
            responses: {
              where: { isAccepted: true },
              select: { id: true },
              take: 1,
            },
          },
        });

        return {
          ...ticket,
          status: fullTicket?.status,
          hasAcceptedResponse: (fullTicket?.responses?.length || 0) > 0,
          responseCount: fullTicket?._count?.responses || 0,
        };
      })
    );

    return {
      success: true,
      data: {
        isDuplicate: false,
        similar: similarWithInfo,
      },
    };
  });

  // Create ticket
  server.post('/', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const body = createTicketSchema.parse(request.body);

    // Check for duplicate one more time
    const duplicate = await checkForDuplicate(body.title, body.description);
    
    if (duplicate.isDuplicate && duplicate.similarity && duplicate.similarity > 0.95) {
      throw new ConflictError(
        `A very similar ticket already exists: "${duplicate.duplicateTitle}"`
      );
    }

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        images: body.images || [],
        creatorId: payload.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: payload.id },
      data: { ticketsCreated: { increment: 1 } },
    });

    // Index in ElasticSearch
    await indexTicket({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt,
    });

    // Add to blockchain
    await addRecord(BlockchainRecordType.TICKET_CREATED, {
      ticketId: ticket.id,
      userId: payload.id,
    });

    return { success: true, data: ticket };
  });

  // List tickets
  server.get('/', {
    preHandler: [server.authenticateOptional],
  }, async (request: FastifyRequest) => {
    const query = listQuerySchema.parse(request.query);
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);

    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    } else {
      // By default, show only open and in_progress tickets
      where.status = { in: ['OPEN', 'IN_PROGRESS'] };
    }

    if (query.category) {
      where.category = query.category;
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          images: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          volunteer: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              responses: true,
            },
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

  // Get single ticket
  server.get('/:id', {
    preHandler: [server.authenticateOptional],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = ticketIdParamSchema.parse(request.params);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        volunteer: {
          select: {
            id: true,
            name: true,
            avatar: true,
            totalTimeSpent: true,
            ticketsResolved: true,
          },
        },
        responses: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    return { success: true, data: ticket };
  });

  // Update ticket
  server.patch('/:id', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);
    const updates = updateTicketSchema.parse(request.body);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { creatorId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only creator or admin can update
    if (ticket.creatorId !== payload.id && payload.role !== 'ADMIN') {
      throw new ForbiddenError('Not authorized to update this ticket');
    }

    // Can't update resolved/closed tickets
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new BadRequestError('Cannot update a resolved or closed ticket');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: updates,
    });

    // Update ElasticSearch index
    if (updates.title || updates.description || updates.category) {
      await updateTicketIndex(id, updates);
    }

    return { success: true, data: updatedTicket };
  });

  // Accept ticket (volunteer)
  server.post('/:id/accept', {
    preHandler: [server.requireVolunteer],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { status: true, volunteerId: true, creatorId: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Can't accept own ticket
    if (ticket.creatorId === payload.id) {
      throw new ForbiddenError('Cannot accept your own ticket');
    }

    if (ticket.status !== 'OPEN') {
      throw new BadRequestError('Ticket is not available for acceptance');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        volunteerId: payload.id,
      },
      include: {
        creator: {
          select: { id: true, name: true, avatar: true },
        },
        volunteer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Update index
    await updateTicketIndex(id, { status: 'IN_PROGRESS' });

    return { success: true, data: updatedTicket };
  });

  // Release ticket (volunteer)
  server.post('/:id/release', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { status: true, volunteerId: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only assigned volunteer or admin can release
    if (ticket.volunteerId !== payload.id && payload.role !== 'ADMIN') {
      throw new ForbiddenError('Not authorized to release this ticket');
    }

    if (ticket.status !== 'IN_PROGRESS') {
      throw new BadRequestError('Ticket is not in progress');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'OPEN',
        volunteerId: null,
      },
    });

    // Update index
    await updateTicketIndex(id, { status: 'OPEN' });

    return { success: true, data: updatedTicket };
  });

  // Resolve ticket
  server.post('/:id/resolve', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);
    const body = z.object({
      acceptedResponseId: z.string().optional(),
    }).parse(request.body);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { 
        status: true, 
        creatorId: true, 
        volunteerId: true,
        responses: {
          select: { id: true, authorId: true, timeSpent: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only creator can resolve
    if (ticket.creatorId !== payload.id) {
      throw new ForbiddenError('Only the ticket creator can resolve it');
    }

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      throw new BadRequestError('Ticket is already resolved or closed');
    }

    // Calculate total time spent
    const totalTime = ticket.responses.reduce((acc: number, r: { timeSpent: number }) => acc + r.timeSpent, 0);

    // Mark accepted response if provided
    if (body.acceptedResponseId) {
      await prisma.response.update({
        where: { id: body.acceptedResponseId },
        data: { isAccepted: true },
      });
    }

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Update volunteer stats
    if (ticket.volunteerId) {
      await prisma.user.update({
        where: { id: ticket.volunteerId },
        data: {
          totalTimeSpent: { increment: totalTime },
          ticketsResolved: { increment: 1 },
          peopleHelped: { increment: 1 },
        },
      });
    }

    // Update index
    await updateTicketIndex(id, { status: 'RESOLVED' });

    // Add to blockchain
    await addRecord(BlockchainRecordType.TICKET_RESOLVED, {
      ticketId: id,
      volunteerId: ticket.volunteerId,
      timeSpent: totalTime,
    });

    return { success: true, data: updatedTicket };
  });

  // Close ticket without resolution
  server.post('/:id/close', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);
    // const _body = z.object({
    //   reason: z.string().optional(),
    // }).parse(request.body);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { creatorId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only creator or admin can close
    if (ticket.creatorId !== payload.id && payload.role !== 'ADMIN') {
      throw new ForbiddenError('Not authorized to close this ticket');
    }

    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
      throw new BadRequestError('Ticket is already closed or resolved');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    // Update index
    await updateTicketIndex(id, { status: 'CLOSED' });

    return { success: true, data: updatedTicket };
  });

  // Get categories
  server.get('/meta/categories', async (_request: FastifyRequest) => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    // If no categories exist, return default ones
    if (categories.length === 0) {
      return {
        success: true,
        data: [
          { id: 'os', name: 'Sistema Operacional', nameEn: 'Operating System', namePt: 'Sistema Operacional', nameEs: 'Sistema Operativo' },
          { id: 'software', name: 'Software', nameEn: 'Software', namePt: 'Software', nameEs: 'Software' },
          { id: 'hardware', name: 'Hardware', nameEn: 'Hardware', namePt: 'Hardware', nameEs: 'Hardware' },
          { id: 'network', name: 'Rede e Internet', nameEn: 'Network & Internet', namePt: 'Rede e Internet', nameEs: 'Red e Internet' },
          { id: 'security', name: 'Segurança', nameEn: 'Security', namePt: 'Segurança', nameEs: 'Seguridad' },
          { id: 'mobile', name: 'Dispositivos Móveis', nameEn: 'Mobile Devices', namePt: 'Dispositivos Móveis', nameEs: 'Dispositivos Móviles' },
          { id: 'other', name: 'Outros', nameEn: 'Other', namePt: 'Outros', nameEs: 'Otros' },
        ],
      };
    }

    return { success: true, data: categories };
  });
  server.post('/', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const body = createTicketSchema.parse(request.body);

    // Check for duplicate one more time
    const duplicate = await checkForDuplicate(body.title, body.description);
    
    if (duplicate.isDuplicate && duplicate.similarity && duplicate.similarity > 0.95) {
      throw new ConflictError(
        `A very similar ticket already exists: "${duplicate.duplicateTitle}"`
      );
    }

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        images: body.images || [],
        creatorId: payload.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: payload.id },
      data: { ticketsCreated: { increment: 1 } },
    });

    // Index in ElasticSearch
    await indexTicket({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt,
    });

    // Add to blockchain
    await addRecord(BlockchainRecordType.TICKET_CREATED, {
      ticketId: ticket.id,
      userId: payload.id,
    });

    return { success: true, data: ticket };
  });

  // List tickets
  server.get('/', {
    preHandler: [server.authenticateOptional],
  }, async (request: FastifyRequest) => {
    const query = listQuerySchema.parse(request.query);
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);

    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    } else {
      // By default, show only open and in_progress tickets
      where.status = { in: ['OPEN', 'IN_PROGRESS'] };
    }

    if (query.category) {
      where.category = query.category;
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          images: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          volunteer: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              responses: true,
            },
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

  // Get single ticket
  server.get('/:id', {
    preHandler: [server.authenticateOptional],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = ticketIdParamSchema.parse(request.params);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        volunteer: {
          select: {
            id: true,
            name: true,
            avatar: true,
            totalTimeSpent: true,
            ticketsResolved: true,
          },
        },
        responses: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    return { success: true, data: ticket };
  });

  // Update ticket
  server.patch('/:id', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);
    const updates = updateTicketSchema.parse(request.body);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { creatorId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only creator or admin can update
    if (ticket.creatorId !== payload.id && payload.role !== 'ADMIN') {
      throw new ForbiddenError('Not authorized to update this ticket');
    }

    // Can't update resolved/closed tickets
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new BadRequestError('Cannot update a resolved or closed ticket');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: updates,
    });

    // Update ElasticSearch index
    if (updates.title || updates.description || updates.category) {
      await updateTicketIndex(id, updates);
    }

    return { success: true, data: updatedTicket };
  });

  // Accept ticket (volunteer)
  server.post('/:id/accept', {
    preHandler: [server.requireVolunteer],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { status: true, volunteerId: true, creatorId: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Can't accept own ticket
    if (ticket.creatorId === payload.id) {
      throw new ForbiddenError('Cannot accept your own ticket');
    }

    if (ticket.status !== 'OPEN') {
      throw new BadRequestError('Ticket is not available for acceptance');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        volunteerId: payload.id,
      },
      include: {
        creator: {
          select: { id: true, name: true, avatar: true },
        },
        volunteer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Update index
    await updateTicketIndex(id, { status: 'IN_PROGRESS' });

    return { success: true, data: updatedTicket };
  });

  // Release ticket (volunteer)
  server.post('/:id/release', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { status: true, volunteerId: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only assigned volunteer or admin can release
    if (ticket.volunteerId !== payload.id && payload.role !== 'ADMIN') {
      throw new ForbiddenError('Not authorized to release this ticket');
    }

    if (ticket.status !== 'IN_PROGRESS') {
      throw new BadRequestError('Ticket is not in progress');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'OPEN',
        volunteerId: null,
      },
    });

    // Update index
    await updateTicketIndex(id, { status: 'OPEN' });

    return { success: true, data: updatedTicket };
  });

  // Resolve ticket
  server.post('/:id/resolve', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);
    // const _body = z.object({
    //   acceptedResponseId: z.string().optional(),
    // }).parse(request.body);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { 
        status: true, 
        creatorId: true, 
        volunteerId: true,
        responses: {
          select: { id: true, authorId: true, timeSpent: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only creator can resolve
    if (ticket.creatorId !== payload.id) {
      throw new ForbiddenError('Only the ticket creator can resolve it');
    }

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      throw new BadRequestError('Ticket is already resolved or closed');
    }

    // Calculate total time spent
    const totalTime = ticket.responses.reduce((acc: number, r: { timeSpent: number }) => acc + r.timeSpent, 0);

    // Mark accepted response if provided
    if (body.acceptedResponseId) {
      await prisma.response.update({
        where: { id: body.acceptedResponseId },
        data: { isAccepted: true },
      });
    }

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Update volunteer stats
    if (ticket.volunteerId) {
      await prisma.user.update({
        where: { id: ticket.volunteerId },
        data: {
          totalTimeSpent: { increment: totalTime },
          ticketsResolved: { increment: 1 },
          peopleHelped: { increment: 1 },
        },
      });
    }

    // Update index
    await updateTicketIndex(id, { status: 'RESOLVED' });

    // Add to blockchain
    await addRecord(BlockchainRecordType.TICKET_RESOLVED, {
      ticketId: id,
      volunteerId: ticket.volunteerId,
      timeSpent: totalTime,
    });

    return { success: true, data: updatedTicket };
  });

  // Close ticket without resolution
  server.post('/:id/close', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = ticketIdParamSchema.parse(request.params);
    // const body = z.object({
    //   reason: z.string().optional(),
    // }).parse(request.body);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { creatorId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Only creator or admin can close
    if (ticket.creatorId !== payload.id && ticket.role !== 'ADMIN') {
      throw new ForbiddenError('Not authorized to close this ticket');
    }

    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
      throw new BadRequestError('Ticket is already closed or resolved');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    // Update index
    await updateTicketIndex(id, { status: 'CLOSED' });

    return { success: true, data: updatedTicket };
  });
}
