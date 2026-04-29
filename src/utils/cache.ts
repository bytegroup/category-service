import {getRedisClient} from "@/config/redis";
import {logger} from "@/utils/logger";
import {config} from "@/config";


export const CacheKeys = {
  category: (id: string) => `category:${id}`,
  categoryByName: (name: string) => `category:name:${name}`,
  allCategories: () => 'categories:all',
  categoryChildren: (id: string) => `category:${id}:children`,
  categoryPattern: () => 'category*',
} as const;

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await getRedisClient().get(key);
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
  try {
    await getRedisClient().set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.warn('Cache SET failed', { key, error: (err as Error).message });
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await getRedisClient().del(key);
  } catch (err) {
    logger.warn('Cache DEL failed', { key, error: (err as Error).message });
  }
}

export async function invalidateCategoryCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(CacheKeys.categoryPattern());
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug('Category cache invalidated', { count: keys.length });
    }
  } catch (err) {
    logger.warn('Cache invalidation failed', { error: (err as Error).message });
  }
}
