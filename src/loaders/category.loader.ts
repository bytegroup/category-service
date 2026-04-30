import DataLoader from 'dataloader';
import { categoryRepository } from '@/repositories/category.repository';
import { ICategoryDocument } from '@/models/category.model';
import { logger } from '@/utils/logger';


export function createCategoryLoader(): DataLoader<string, ICategoryDocument | null> {
  return new DataLoader<string, ICategoryDocument | null>(
    async (ids: readonly string[]) => {
      logger.debug('DataLoader batch executing', { count: ids.length, ids });
      const results = await categoryRepository.findManyByIds(ids);
      return results;
    },
    {
      cache: true,
      batch: true,
      maxBatchSize: 100,
    }
  );
}

export type CategoryLoader = ReturnType<typeof createCategoryLoader>;
