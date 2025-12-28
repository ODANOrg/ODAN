import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Server } from 'socket.io';

import { CONFIG } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './plugins/prisma.js';
import { getRedis, disconnectRedis } from './plugins/redis.js';
import { checkElasticsearchConnection } from './plugins/elasticsearch.js';
import { ensureBucket } from './plugins/minio.js';
import { initBlockchain } from './modules/blockchain/blockchain.service.js';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import ticketRoutes from './modules/tickets/tickets.routes.js';
import responseRoutes from './modules/responses/responses.routes.js';
import uploadRoutes from './modules/uploads/uploads.routes.js';
import certificateRoutes from './modules/certificates/certificates.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';

// Import socket handler
import { setupSocketIO } from './modules/chat/chat.socket.js';

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: CONFIG.server.isDev,
    trustProxy: true,
  });

  // Register plugins
  await server.register(cors, {
    origin: [CONFIG.urls.frontend],
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  await server.register(jwt, {
    secret: CONFIG.jwt.secret,
    sign: {
      expiresIn: CONFIG.jwt.expiresIn,
    },
  });

  await server.register(cookie, {
    secret: CONFIG.jwt.secret,
    parseOptions: {},
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: getRedis(),
  });

  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  });

  await server.register(websocket);

  // Swagger documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'ODAN API',
        description: 'Open Digital Assistance Network API',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${CONFIG.server.port}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Register routes
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(userRoutes, { prefix: '/api/users' });
  await server.register(ticketRoutes, { prefix: '/api/tickets' });
  await server.register(responseRoutes, { prefix: '/api/responses' });
  await server.register(uploadRoutes, { prefix: '/api/uploads' });
  await server.register(certificateRoutes, { prefix: '/api/certificates' });
  await server.register(searchRoutes, { prefix: '/api/search' });
  await server.register(statsRoutes, { prefix: '/api/stats' });

  return server;
}

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting ODAN Backend...', 'Server');

    // Connect to database
    await connectDatabase();

    // Check ElasticSearch connection
    await checkElasticsearchConnection();

    // Ensure MinIO bucket exists
    await ensureBucket();

    // Initialize blockchain
    await initBlockchain();

    // Build and start server
    const server = await buildServer();

    // Setup Socket.IO
    const io = new Server(server.server, {
      cors: {
        origin: CONFIG.urls.frontend,
        credentials: true,
      },
    });

    setupSocketIO(io);

    // Start listening
    await server.listen({
      port: CONFIG.server.port,
      host: CONFIG.server.host,
    });

    logger.info(`✅ Server running at http://${CONFIG.server.host}:${CONFIG.server.port}`, 'Server');
    logger.info(`📚 API Docs available at http://${CONFIG.server.host}:${CONFIG.server.port}/docs`, 'Server');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down...', 'Server');
      await server.close();
      await disconnectDatabase();
      await disconnectRedis();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error('Failed to start server', 'Server', error);
    process.exit(1);
  }
}

main();
