import { createClient } from 'redis';
import { logger } from '../lib/logger';

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

export async function connectRedis(): Promise<RedisClient> {
  if (client && client.isOpen) {
    return client;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('REDIS_MAX_RETRIES', new Error('Max reconnection attempts reached'));
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    client.on('error', (err) => {
      logger.error('REDIS_ERROR', err);
    });

    client.on('connect', () => {
      logger.info('REDIS_CONNECTED', { url: redisUrl });
    });

    await client.connect();
    
    // Test connection
    await client.ping();
    
    return client;
  } catch (error) {
    logger.error('REDIS_CONNECTION_FAILED', error as Error);
    throw error;
  }
}

export async function getRedis(): Promise<RedisClient> {
  if (!client || !client.isOpen) {
    return connectRedis();
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

// Cache helpers
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedis();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('REDIS_GET_ERROR', error as Error, { key });
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttl?: number): Promise<void> {
  try {
    const redis = await getRedis();
    const serialized = JSON.stringify(value);
    
    if (ttl) {
      await redis.setEx(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (error) {
    logger.error('REDIS_SET_ERROR', error as Error, { key });
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.del(key);
  } catch (error) {
    logger.error('REDIS_DELETE_ERROR', error as Error, { key });
  }
}