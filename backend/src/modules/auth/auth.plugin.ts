import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';

export interface JWTPayload {
  id: string;
  email?: string;
  role: string;
  provider: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

async function authPlugin(server: FastifyInstance) {
  server.decorate('authenticate', async function (
    this: FastifyInstance,
    request: FastifyRequest,
    _reply: FastifyReply
  ) {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });

  server.decorate('authenticateOptional', async function (
    this: FastifyInstance,
    request: FastifyRequest,
    _reply: FastifyReply
  ) {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Optional auth - don't throw error
      request.user = undefined as unknown as JWTPayload;
    }
  });

  server.decorate('requireRole', function (this: FastifyInstance, ...roles: string[]) {
    return async function (this: FastifyInstance, request: FastifyRequest, _reply: FastifyReply) {
      await server.authenticate.call(this, request, _reply);
      const user = request.user as JWTPayload;
      if (!roles.includes(user.role)) {
        throw new ForbiddenError('Insufficient permissions');
      }
    };
  });

  server.decorate('requireVolunteer', async function (
    this: FastifyInstance,
    request: FastifyRequest,
    _reply: FastifyReply
  ) {
    await server.authenticate.call(this, request, _reply);
    const user = request.user as JWTPayload;
    if (!['VOLUNTEER', 'MODERATOR', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenError('Volunteer access required');
    }
  });

  server.decorate('requireModerator', async function (
    this: FastifyInstance,
    request: FastifyRequest,
    _reply: FastifyReply
  ) {
    await server.authenticate.call(this, request, _reply);
    const user = request.user as JWTPayload;
    if (!['MODERATOR', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenError('Moderator access required');
    }
  });

  server.decorate('requireAdmin', async function (
    this: FastifyInstance,
    request: FastifyRequest,
    _reply: FastifyReply
  ) {
    await server.authenticate.call(this, request, _reply);
    const user = request.user as JWTPayload;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required');
    }
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireVolunteer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireModerator: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['@fastify/jwt'],
});
