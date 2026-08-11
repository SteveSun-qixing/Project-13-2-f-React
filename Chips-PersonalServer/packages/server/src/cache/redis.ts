import Redis from 'ioredis';
import { env } from '../config/env';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    redisInstance.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redisInstance.on('connect', () => {
      console.info('Redis connected.');
    });
  }
  return redisInstance;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  await redis.connect();
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
