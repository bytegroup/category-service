import {logger} from "@/utils/logger";
import {toGraphQLError} from "@/utils/errors";
import {categoryService} from "@/services/category.service";


export const categoryResolvers = {
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
        await categoryService.deleteCategory(id);
        return { success: true, message: 'Category and all descendants deleted successfully' };
      } catch (err) {
        logger.error('Mutation.deleteCategory error', { id, error: (err as Error).message });
        throw toGraphQLError(err);
      }
    },
  },
};
