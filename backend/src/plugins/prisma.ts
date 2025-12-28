import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/index.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma || new PrismaClient({
  log: CONFIG.server.isDev ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (CONFIG.server.isDev) {
  globalThis.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('📴 Database disconnected');
}
