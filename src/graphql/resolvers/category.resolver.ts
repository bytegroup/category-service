import {logger} from "@/utils/logger";
import {toGraphQLError} from "@/utils/errors";
import {categoryService} from "@/services/category.service";
import {ICategoryDocument} from "@/models/category.model";
import {Types} from "mongoose";
import {CategoryLoader} from "@/loaders/category.loader";

export interface GraphQLContext {
  requestId: string;
  categoryLoader: CategoryLoader;
}

function toId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  // Already-populated subdocument — has _id or id
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj._id) return obj._id instanceof Types.ObjectId ? obj._id.toString() : String(obj._id);
    if (obj.id) return String(obj.id);
  }
  return null;
}

export const categoryResolvers = {
  Category: {
    parent: async (
      category: ICategoryDocument,
      _: unknown,
      { categoryLoader }: GraphQLContext
    ) => {
      if (!category.parent) return null;
      const id = toId(category.parent);
      if (!id) return null;
      return categoryLoader.load(id);
    },

    ancestors: async (
      category: ICategoryDocument,
      _: unknown,
      { categoryLoader }: GraphQLContext
    ) => {
      if (!category.ancestors?.length) return [];
      const ids = category.ancestors
        .map(toId)
        .filter((id): id is string => id !== null);
      if (!ids.length) return [];
      const results = await categoryLoader.loadMany(ids);
      // Filter out errors — DataLoader.loadMany returns Error objects on misses
      return results.filter((r) => r !== null && !(r instanceof Error));
    },
  },

  Query: {
    category: async (_: unknown, { id }: { id: string }) => {
      try {
        return await categoryService.getCategoryById(id);
      } catch (err) {
        logger.error('Query.category error', { id, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    categoryByName: async (_: unknown, { name }: { name: string }) => {
      try {
        return await categoryService.getCategoryByName(name);
      } catch (err) {
        logger.error('Query.categoryByName error', { name, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    categories: async (
      _: unknown,
      { pagination }: { pagination?: { page?: number; limit?: number } }
    ) => {
      try {
        const result = await categoryService.getAllCategories(pagination);
        const totalPages = Math.ceil(result.total / result.limit);
        return {
          ...result,
          totalPages,
          hasNextPage: result.page < totalPages,
          hasPrevPage: result.page > 1,
        };
      } catch (err) {
        logger.error('Query.categories error', { error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    categoryChildren: async (_: unknown, { parentId }: { parentId: string }) => {
      try {
        return await categoryService.getChildren(parentId);
      } catch (err) {
        logger.error('Query.categoryChildren error', { parentId, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    deletedCategories: async (
      _: unknown,
      { pagination }: { pagination?: { page?: number; limit?: number } }
    ) => {
      try {
        return await categoryService.getDeletedCategories(pagination);
      } catch (err) {
        logger.error('Query.deletedCategories error', { error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },
  },

  Mutation: {
    createCategory: async (
      _: unknown,
      { input }: { input: { name: string; parentId?: string } }
    ) => {
      try {
        return await categoryService.createCategory(input);
      } catch (err) {
        logger.error('Mutation.createCategory error', { input, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    updateCategory: async (
      _: unknown,
      { id, input }: { id: string; input: { name: string } }
    ) => {
      try {
        return await categoryService.updateCategory(id, input);
      } catch (err) {
        logger.error('Mutation.updateCategory error', { id, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    deactivateCategory: async (_: unknown, { id }: { id: string }) => {
      try {
        return await categoryService.deactivateCategory(id);
      } catch (err) {
        logger.error('Mutation.deactivateCategory error', { id, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    reactivateCategory: async (_: unknown, { id }: { id: string }) => {
      try {
        return await categoryService.reactivateCategory(id);
      } catch (err) {
        logger.error('Mutation.reactivateCategory error', { id, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    deleteCategory: async (_: unknown, { id }: { id: string }) => {
      try {
        await categoryService.softDeleteCategory(id);
        return { success: true, message: 'Category soft-deleted successfully. Data is retained and restorable.' };
      } catch (err) {
        logger.error('Mutation.deleteCategory error', { id, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },

    restoreCategory: async (_: unknown, { id }: { id: string }) => {
      try {
        return await categoryService.restoreCategory(id);
      } catch (err) {
        logger.error('Mutation.restoreCategory error', { id, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },
  },
};
