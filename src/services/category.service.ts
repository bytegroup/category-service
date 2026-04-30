import mongoose, {ClientSession, Types} from 'mongoose';
import {ICategoryDocument} from "@/models/category.model";
import {CacheKeys, getCache, invalidateCategoryCache, setCache} from "@/utils/cache";
import {logger} from "@/utils/logger";
import {categoryRepository} from "@/repositories/category.repository";
import {AppError, ErrorCode} from "@/utils/errors";
import {CreateCategoryInput, PaginationInput, UpdateCategoryInput} from "@/types";

const isTest = process.env.NODE_ENV === 'test';

async function withTransaction<T>(
  fn: (session: ClientSession | undefined) => Promise<T>
): Promise<T> {
  if (isTest) {
    return fn(undefined);
  }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}

export class CategoryService {
  // ─── Queries ──────────────────────────────────────────────────────────────

  async getCategoryById(id: string): Promise<ICategoryDocument> {
    const cacheKey = CacheKeys.category(id);
    const cached = await getCache<ICategoryDocument>(cacheKey);
    if (cached) {
      logger.debug('Cache HIT', { key: cacheKey });
      return cached;
    }

    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new AppError(ErrorCode.NOT_FOUND, `Category with id "${id}" not found`);
    }

    await setCache(cacheKey, category);
    return category;
  }

  async getCategoryByName(name: string): Promise<ICategoryDocument> {
    const cacheKey = CacheKeys.categoryByName(name.toLowerCase());
    const cached = await getCache<ICategoryDocument>(cacheKey);
    if (cached) {
      logger.debug('Cache HIT', { key: cacheKey });
      return cached;
    }

    const category = await categoryRepository.findByName(name);
    if (!category) {
      throw new AppError(ErrorCode.NOT_FOUND, `Category with name "${name}" not found`);
    }

    await setCache(cacheKey, category);
    return category;
  }

  async getAllCategories(
    pagination: PaginationInput = {}
  ): Promise<{ data: ICategoryDocument[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination.limit ?? 20));

    const cacheKey = `${CacheKeys.allCategories()}:${page}:${limit}`;
    const cached = await getCache<{ data: ICategoryDocument[]; total: number; page: number; limit: number }>(cacheKey);
    if (cached) {
      logger.debug('Cache HIT', { key: cacheKey });
      return cached;
    }

    const result = await categoryRepository.findAll(page, limit);
    const response = { ...result, page, limit };
    await setCache(cacheKey, response);
    return response;
  }

  async getChildren(parentId: string): Promise<ICategoryDocument[]> {
    const cacheKey = CacheKeys.categoryChildren(parentId);
    const cached = await getCache<ICategoryDocument[]>(cacheKey);
    if (cached) return cached;

    await this.getCategoryById(parentId);
    const children = await categoryRepository.findChildren(parentId);
    await setCache(cacheKey, children);
    return children;
  }

  // [NEW] Return soft-deleted categories for audit/restore
  async getDeletedCategories(
    pagination: PaginationInput = {}
  ): Promise<{ data: ICategoryDocument[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination.limit ?? 20));
    const result = await categoryRepository.findDeleted(page, limit);
    return { ...result, page, limit };
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async createCategory(input: CreateCategoryInput): Promise<ICategoryDocument> {
    const nameExists = await categoryRepository.existsByName(input.name);
    if (nameExists) {
      throw new AppError(ErrorCode.ALREADY_EXISTS, `Category with name "${input.name}" already exists`);
    }

    let ancestors: Types.ObjectId[] = [];

    if (input.parentId) {
      const parent = await categoryRepository.findById(input.parentId);
      if (!parent) {
        throw new AppError(ErrorCode.NOT_FOUND, `Parent category with id "${input.parentId}" not found`);
      }
      if (!parent.isActive) {
        throw new AppError(ErrorCode.CATEGORY_INACTIVE, 'Cannot add a child to an inactive parent category');
      }
      ancestors = [...parent.ancestors, parent._id];
    }

    return withTransaction(async (session) => {
      try {
        const category = await categoryRepository.create({ ...input, ancestors }, session);
        await invalidateCategoryCache();
        logger.info('Category created', { id: category._id.toString(), name: category.name });
        return category;
      } catch (err) {
        if ((err as { code?: number }).code === 11000) {
          throw new AppError(ErrorCode.ALREADY_EXISTS, `Category with name "${input.name}" already exists`);
        }
        throw err;
      }
    });
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<ICategoryDocument> {
    await this.getCategoryById(id);

    if (input.name) {
      const nameExists = await categoryRepository.existsByName(input.name, id);
      if (nameExists) {
        throw new AppError(ErrorCode.ALREADY_EXISTS, `Category with name "${input.name}" already exists`);
      }
    }

    const updated = await categoryRepository.update(id, input);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Category with id "${id}" not found`);
    }

    await invalidateCategoryCache();
    logger.info('Category updated', { id });
    return updated;
  }

  async deactivateCategory(id: string): Promise<ICategoryDocument> {
    const category = await this.getCategoryById(id);
    if (!category.isActive) {
      throw new AppError(ErrorCode.CATEGORY_INACTIVE, `Category "${category.name}" is already inactive`);
    }
    return withTransaction(async (session) => {
      const deactivated = await categoryRepository.deactivate(id, session);
      const descendantCount = await categoryRepository.deactivateDescendants(id, session);
      await invalidateCategoryCache();
      logger.info('Category deactivated', { id, descendantsDeactivated: descendantCount });
      return deactivated!;
    });
  }

  async reactivateCategory(id: string): Promise<ICategoryDocument> {
    await this.getCategoryById(id);
    const updated = await categoryRepository.update(id, { isActive: true } as UpdateCategoryInput & { isActive: boolean });
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Category with id "${id}" not found`);
    }
    await invalidateCategoryCache();
    logger.info('Category reactivated', { id });
    return updated;
  }

  async softDeleteCategory(id: string): Promise<boolean> {
    await this.getCategoryById(id);
    return withTransaction(async (session) => {
      await categoryRepository.softDelete(id, session);
      const count = await categoryRepository.softDeleteDescendants(id, session);
      await invalidateCategoryCache();
      logger.info('Category soft-deleted', { id, descendantsSoftDeleted: count });
      return true;
    });
  }

  async restoreCategory(id: string): Promise<ICategoryDocument> {
    const restored = await categoryRepository.restore(id);
    if (!restored) {
      throw new AppError(ErrorCode.NOT_FOUND, `No soft-deleted category found with id "${id}"`);
    }
    await invalidateCategoryCache();
    logger.info('Category restored', { id });
    return restored;
  }
}

export const categoryService = new CategoryService();
