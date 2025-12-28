import Redis from 'ioredis';
import { CONFIG } from '../config/index.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(CONFIG.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (error) => {
      console.error('❌ Redis error:', error.message);
    });
  }

  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('📴 Redis disconnected');
  }
}

// Cache utilities
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await getRedis().get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await getRedis().setex(key, ttlSeconds, data);
    } else {
      await getRedis().set(key, data);
    }
  },

  async del(key: string): Promise<void> {
    await getRedis().del(key);
  },

  async exists(key: string): Promise<boolean> {
    const result = await getRedis().exists(key);
    return result === 1;
  },

  async ttl(key: string): Promise<number> {
    return getRedis().ttl(key);
  },

  async incr(key: string): Promise<number> {
    return getRedis().incr(key);
  },

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await getRedis().expire(key, ttlSeconds);
  },
};

// Session utilities
export const sessionStore = {
  async set(userId: string, sessionId: string, data: unknown, ttlSeconds: number = 604800): Promise<void> {
    const key = `session:${userId}:${sessionId}`;
    await cache.set(key, data, ttlSeconds);
  },

  async get<T>(userId: string, sessionId: string): Promise<T | null> {
    const key = `session:${userId}:${sessionId}`;
    return cache.get<T>(key);
  },

  async delete(userId: string, sessionId: string): Promise<void> {
    const key = `session:${userId}:${sessionId}`;
    await cache.del(key);
  },

  async deleteAllForUser(userId: string): Promise<void> {
    const redis = getRedis();
    const keys = await redis.keys(`session:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};
