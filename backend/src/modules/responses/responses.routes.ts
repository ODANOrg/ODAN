import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';
import { JWTPayload } from '../auth/auth.plugin.js';
import { addRecord, BlockchainRecordType } from '../blockchain/blockchain.service.js';

// Schemas
const createResponseSchema = z.object({
  ticketId: z.string(),
  content: z.string().min(20).max(10000),
  images: z.array(z.string()).max(10).optional(),
  whiteboardImg: z.string().optional(),
  timeSpent: z.number().min(0), // in seconds
  isPasted: z.boolean().optional(),
  hasSource: z.boolean().optional(),
  sourceUrl: z.string().url().optional(),
});

const responseIdParamSchema = z.object({
  id: z.string(),
});

export default async function responseRoutes(server: FastifyInstance) {
  // Create response
  server.post('/', {
    preHandler: [server.requireVolunteer],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const body = createResponseSchema.parse(request.body);

    // Validate pasted content source
    if (body.isPasted && !body.hasSource && !body.sourceUrl) {
      // Mark as pasted without source - this will show warning to users
    }

    // Check ticket exists and is in progress
    const ticket = await prisma.ticket.findUnique({
      where: { id: body.ticketId },
      select: { 
        status: true, 
        volunteerId: true, 
        creatorId: true 
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Ticket must be in progress or open
    if (!['OPEN', 'IN_PROGRESS'].includes(ticket.status)) {
      throw new BadRequestError('Cannot respond to a closed or resolved ticket');
    }

    // If ticket is open, auto-accept it
    if (ticket.status === 'OPEN') {
      await prisma.ticket.update({
        where: { id: body.ticketId },
        data: {
          status: 'IN_PROGRESS',
          volunteerId: payload.id,
        },
      });
    } else if (ticket.volunteerId && ticket.volunteerId !== payload.id) {
      // Check if user is the assigned volunteer
      throw new ForbiddenError('This ticket is being handled by another volunteer');
    }

    // Create response
    const response = await prisma.response.create({
      data: {
        ticketId: body.ticketId,
        authorId: payload.id,
        content: body.content,
        images: body.images || [],
        whiteboardImg: body.whiteboardImg,
        timeSpent: body.timeSpent,
        isPasted: body.isPasted || false,
        hasSource: body.hasSource || false,
        sourceUrl: body.sourceUrl,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Add to blockchain
    await addRecord(BlockchainRecordType.RESPONSE_SUBMITTED, {
      responseId: response.id,
      ticketId: body.ticketId,
      userId: payload.id,
      timeSpent: body.timeSpent,
    });

    return { success: true, data: response };
  });

  // Get response by ID
  server.get('/:id', {
    preHandler: [server.authenticateOptional],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = responseIdParamSchema.parse(request.params);

    const response = await prisma.response.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        ticket: {
          select: {
            id: true,
            title: true,
            creatorId: true,
          },
        },
      },
    });

    if (!response) {
      throw new NotFoundError('Response not found');
    }

    return { success: true, data: response };
  });

  // Update response
  server.patch('/:id', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = responseIdParamSchema.parse(request.params);
    const body = z.object({
      content: z.string().min(20).max(10000).optional(),
      images: z.array(z.string()).max(10).optional(),
      whiteboardImg: z.string().optional(),
      additionalTime: z.number().min(0).optional(), // additional seconds
      sourceUrl: z.string().url().optional(),
    }).parse(request.body);

    const response = await prisma.response.findUnique({
      where: { id },
      select: { 
        authorId: true, 
        timeSpent: true,
        ticket: { select: { status: true } }
      },
    });

    if (!response) {
      throw new NotFoundError('Response not found');
    }

    // Only author can update
    if (response.authorId !== payload.id) {
      throw new ForbiddenError('Not authorized to update this response');
    }

    // Can't update if ticket is resolved/closed
    if (['RESOLVED', 'CLOSED'].includes(response.ticket.status)) {
      throw new BadRequestError('Cannot update response on a resolved or closed ticket');
    }

    const updatedResponse = await prisma.response.update({
      where: { id },
      data: {
        content: body.content,
        images: body.images,
        whiteboardImg: body.whiteboardImg,
        sourceUrl: body.sourceUrl,
        hasSource: body.sourceUrl ? true : undefined,
        timeSpent: body.additionalTime 
          ? response.timeSpent + body.additionalTime 
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return { success: true, data: updatedResponse };
  });

  // Delete response
  server.delete('/:id', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = responseIdParamSchema.parse(request.params);

    const response = await prisma.response.findUnique({
      where: { id },
      select: { 
        authorId: true,
        isAccepted: true,
        ticket: { select: { status: true } }
      },
    });

    if (!response) {
      throw new NotFoundError('Response not found');
    }

    // Only author or admin can delete
    if (response.authorId !== payload.id && payload.role !== 'ADMIN') {
      throw new ForbiddenError('Not authorized to delete this response');
    }

    // Can't delete accepted responses
    if (response.isAccepted) {
      throw new BadRequestError('Cannot delete an accepted response');
    }

    // Can't delete if ticket is resolved
    if (response.ticket.status === 'RESOLVED') {
      throw new BadRequestError('Cannot delete response on a resolved ticket');
    }

    await prisma.response.delete({ where: { id } });

    return { success: true, message: 'Response deleted successfully' };
  });

  // Accept response (ticket creator only)
  server.post('/:id/accept', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = responseIdParamSchema.parse(request.params);

    const response = await prisma.response.findUnique({
      where: { id },
      include: {
        ticket: {
          select: { id: true, creatorId: true, status: true },
        },
      },
    });

    if (!response) {
      throw new NotFoundError('Response not found');
    }

    // Only ticket creator can accept
    if (response.ticket.creatorId !== payload.id) {
      throw new ForbiddenError('Only the ticket creator can accept responses');
    }

    // Can't accept on resolved/closed tickets
    if (['RESOLVED', 'CLOSED'].includes(response.ticket.status)) {
      throw new BadRequestError('Ticket is already resolved or closed');
    }

    // Unaccept other responses first
    await prisma.response.updateMany({
      where: { 
        ticketId: response.ticket.id,
        isAccepted: true,
      },
      data: { isAccepted: false },
    });

    // Accept this response
    const updatedResponse = await prisma.response.update({
      where: { id },
      data: { isAccepted: true },
    });

    return { success: true, data: updatedResponse };
  });

  // Log additional time (for editing without content change)
  server.post('/:id/log-time', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const { id } = responseIdParamSchema.parse(request.params);
    const body = z.object({
      seconds: z.number().min(1).max(3600), // max 1 hour per log
    }).parse(request.body);

    const response = await prisma.response.findUnique({
      where: { id },
      select: { authorId: true, timeSpent: true },
    });

    if (!response) {
      throw new NotFoundError('Response not found');
    }

    if (response.authorId !== payload.id) {
      throw new ForbiddenError('Not authorized');
    }

    const updatedResponse = await prisma.response.update({
      where: { id },
      data: {
        timeSpent: response.timeSpent + body.seconds,
      },
    });

    // Add to blockchain
    await addRecord(BlockchainRecordType.TIME_LOGGED, {
      responseId: id,
      userId: payload.id,
      timeSpent: body.seconds,
    });

    return { success: true, data: updatedResponse };
  });
}
