import { FastifyInstance, FastifyRequest } from 'fastify';
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
    request: FastifyRequest
  ) {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });

  server.decorate('authenticateOptional', async function (
    request: FastifyRequest
  ) {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Optional auth - don't throw error
      request.user = undefined as unknown as JWTPayload;
    }
  });

  server.decorate('requireRole', function (...roles: string[]) {
    return async function (request: FastifyRequest) {
      await server.authenticate(request);
      const user = request.user as JWTPayload;
      if (!roles.includes(user.role)) {
        throw new ForbiddenError('Insufficient permissions');
      }
    };
  });

  server.decorate('requireVolunteer', async function (
    request: FastifyRequest
  ) {
    await server.authenticate(request);
    const user = request.user as JWTPayload;
    if (!['VOLUNTEER', 'MODERATOR', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenError('Volunteer access required');
    }
  });

  server.decorate('requireModerator', async function (
    request: FastifyRequest
  ) {
    await server.authenticate(request);
    const user = request.user as JWTPayload;
    if (!['MODERATOR', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenError('Moderator access required');
    }
  });

  server.decorate('requireAdmin', async function (
    request: FastifyRequest
  ) {
    await server.authenticate(request);
    const user = request.user as JWTPayload;
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required');
    }
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    authenticateOptional: (request: FastifyRequest) => Promise<void>;
    requireRole: (...roles: string[]) => (request: FastifyRequest) => Promise<void>;
    requireVolunteer: (request: FastifyRequest) => Promise<void>;
    requireModerator: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['@fastify/jwt'],
});
