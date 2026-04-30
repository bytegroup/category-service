export const categoryTypeDefs = `#graphql
  type Category {
    id: ID!
    name: String!
    parent: Category
    ancestors: [Category!]!
    isActive: Boolean!
    isDeleted: Boolean!
    deletedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type PaginatedCategories {
    data: [Category!]!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  type DeleteResponse {
    success: Boolean!
    message: String!
  }

  input CreateCategoryInput {
    name: String!
    parentId: ID
  }

  input UpdateCategoryInput {
    name: String!
  }

  input PaginationInput {
    page: Int = 1
    limit: Int = 20
  }

  type Query {
    """Get a single category by ID with full ancestor chain"""
    category(id: ID!): Category!

    """Search a category by name with full ancestor chain"""
    categoryByName(name: String!): Category!

    """Get all categories with pagination"""
    categories(pagination: PaginationInput): PaginatedCategories!

    """Get direct children of a category"""
    categoryChildren(parentId: ID!): [Category!]!

    """[NEW] Get soft-deleted categories (audit/restore purposes)"""
    deletedCategories(pagination: PaginationInput): PaginatedCategories!
  }

  type Mutation {
    """Create a new category (optionally nested under a parent)"""
    createCategory(input: CreateCategoryInput!): Category!

    """Update category name"""
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!

    """Deactivate a category and all its descendants"""
    deactivateCategory(id: ID!): Category!

    """Reactivate a previously deactivated category"""
    reactivateCategory(id: ID!): Category!

    """[MODIFIED] Soft-delete a category and all its descendants (restorable)"""
    deleteCategory(id: ID!): DeleteResponse!

    """[NEW] Restore a soft-deleted category"""
    restoreCategory(id: ID!): Category!
  }
`;
