import {getRedisClient} from "@/config/redis";
import {logger} from "@/utils/logger";
import {config} from "@/config";

const isTest = process.env.NODE_ENV === 'test';

// Lazy import Redis only in non-test environments
async function getRedis() {
  if (isTest) return null;
  const { getRedisClient } = await import('../config/redis.js');
  return getRedisClient();
}

export const CacheKeys = {
  category: (id: string) => `category:${id}`,
  categoryByName: (name: string) => `category:name:${name}`,
  allCategories: () => 'categories:all',
  categoryChildren: (id: string) => `category:${id}:children`,
  categoryPattern: () => 'category*',
} as const;

export async function getCache<T>(key: string): Promise<T | null> {
  if (isTest) return null;
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    logger.warn('Cache GET failed', { key, error: (err as Error).message });
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = config.redis.ttl
): Promise<void> {
  if (isTest) return;
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.warn('Cache SET failed', { key, error: (err as Error).message });
  }
}

export async function deleteCache(key: string): Promise<void> {
  if (isTest) return;
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.del(key);
  } catch (err) {
    logger.warn('Cache DEL failed', { key, error: (err as Error).message });
  }
}

export async function invalidateCategoryCache(): Promise<void> {
  if (isTest) return;
  try {
    const redis = await getRedis();
    if (!redis) return;
    const keys = await redis.keys(CacheKeys.categoryPattern());
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug('Category cache invalidated', { count: keys.length });
    }
  } catch (err) {
    logger.warn('Cache invalidation failed', { error: (err as Error).message });
  }
}
