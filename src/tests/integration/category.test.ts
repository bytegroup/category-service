import { ApolloServer } from '@apollo/server';
import { connectTestDb, disconnectTestDb, clearCollections } from '../helpers/testDb';
import { createCategoryLoader } from '@/loaders/category.loader';
import { beforeAll, describe, it, expect } from '@jest/globals';
import {GraphQLContext} from "@/graphql/resolvers/category.resolver";
import {createApolloServer} from "@/graphql";

jest.setTimeout(30000);
let server: ApolloServer<GraphQLContext>;

async function gql(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<Record<string, any>> {
  const response = await server.executeOperation(
    { query, variables },
    { contextValue: { requestId: 'test', categoryLoader: createCategoryLoader() } }
  );
  if (response.body.kind !== 'single') throw new Error('Expected single response');
  return response.body.singleResult as Record<string, any>;
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────
beforeAll(async () => {
  await connectTestDb();
  server = createApolloServer();
  await server.start();
});

afterAll(async () => {
  await server.stop();
  await disconnectTestDb();
});

afterEach(async () => {
  await clearCollections();
});

// ─── Test Suites ─────────────────────────────────────────────────────────────

describe('createCategory', () => {
  it('creates a root category successfully', async () => {
    const res = await gql(`
      mutation { createCategory(input: { name: "Electronics" }) { id name isActive isDeleted } }
    `);
    expect(res.errors).toBeUndefined();
    expect(res.data?.createCategory.name).toBe('Electronics');
    expect(res.data?.createCategory.isActive).toBe(true);
    expect(res.data?.createCategory.isDeleted).toBe(false);
  });

  it('creates a nested category with correct ancestors', async () => {
    const root = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const rootId = root.data?.createCategory.id;

    const child = await gql(
      `mutation($parentId: ID!) { createCategory(input: { name: "Mobile", parentId: $parentId }) { id ancestors { name } } }`,
      { parentId: rootId }
    );
    expect(child.errors).toBeUndefined();
    expect(child.data?.createCategory.ancestors).toHaveLength(1);
    expect(child.data?.createCategory.ancestors[0].name).toBe('Electronics');
  });

  it('rejects duplicate category names', async () => {
    await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const res = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0].extensions?.code).toBe('ALREADY_EXISTS');
  });

  it('rejects adding child to an inactive parent', async () => {
    const root = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const rootId = root.data?.createCategory.id;
    await gql(`mutation($id: ID!) { deactivateCategory(id: $id) { id } }`, { id: rootId });

    const res = await gql(
      `mutation($parentId: ID!) { createCategory(input: { name: "Mobile", parentId: $parentId }) { id } }`,
      { parentId: rootId }
    );
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0].extensions?.code).toBe('CATEGORY_INACTIVE');
  });

  it('rejects non-existent parentId', async () => {
    const res = await gql(
      `mutation { createCategory(input: { name: "Mobile", parentId: "507f1f77bcf86cd799439011" }) { id } }`
    );
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0].extensions?.code).toBe('NOT_FOUND');
  });
});

describe('getCategoryByName (search with parent chain)', () => {
  it('returns full ancestor chain in a single response', async () => {
    // Build: Electronics > Accessories > Smart Watch
    const l0 = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const l1 = await gql(
      `mutation($p: ID!) { createCategory(input: { name: "Accessories", parentId: $p }) { id } }`,
      { p: l0.data?.createCategory.id }
    );
    await gql(
      `mutation($p: ID!) { createCategory(input: { name: "Smart Watch", parentId: $p }) { id } }`,
      { p: l1.data?.createCategory.id }
    );

    const res = await gql(`query { categoryByName(name: "Smart Watch") { name ancestors { name } } }`);
    expect(res.errors).toBeUndefined();
    const names = res.data?.categoryByName.ancestors.map((a: any) => a.name);
    expect(names).toContain('Electronics');
    expect(names).toContain('Accessories');
  });

  it('returns NOT_FOUND for missing category', async () => {
    const res = await gql(`query { categoryByName(name: "DoesNotExist") { id } }`);
    expect(res.errors?.[0].extensions?.code).toBe('NOT_FOUND');
  });
});

describe('deactivateCategory (cascade)', () => {
  it('deactivates a category and all its descendants', async () => {
    const l0 = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const l0id = l0.data?.createCategory.id;
    const l1 = await gql(
      `mutation($p: ID!) { createCategory(input: { name: "Mobile", parentId: $p }) { id } }`,
      { p: l0id }
    );
    const l2 = await gql(
      `mutation($p: ID!) { createCategory(input: { name: "Android", parentId: $p }) { id } }`,
      { p: l1.data?.createCategory.id }
    );

    await gql(`mutation($id: ID!) { deactivateCategory(id: $id) { id } }`, { id: l0id });

    // Verify all levels are inactive
    const check = async (id: string) => {
      const r = await gql(`query($id: ID!) { category(id: $id) { isActive } }`, { id });
      return r.data?.category.isActive;
    };

    expect(await check(l0id)).toBe(false);
    expect(await check(l1.data?.createCategory.id)).toBe(false);
    expect(await check(l2.data?.createCategory.id)).toBe(false);
  });

  it('returns CATEGORY_INACTIVE if already inactive', async () => {
    const cat = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const id = cat.data?.createCategory.id;
    await gql(`mutation($id: ID!) { deactivateCategory(id: $id) { id } }`, { id });
    const res = await gql(`mutation($id: ID!) { deactivateCategory(id: $id) { id } }`, { id });
    expect(res.errors?.[0].extensions?.code).toBe('CATEGORY_INACTIVE');
  });
});

describe('soft delete & restore', () => {
  it('soft-deletes a category (isDeleted=true, not physically removed)', async () => {
    const cat = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const id = cat.data?.createCategory.id;

    const del = await gql(`mutation($id: ID!) { deleteCategory(id: $id) { success message } }`, { id });
    expect(del.data?.deleteCategory.success).toBe(true);

    // Should not be found in normal queries
    const find = await gql(`query($id: ID!) { category(id: $id) { id } }`, { id });
    expect(find.errors?.[0].extensions?.code).toBe('NOT_FOUND');

    // Should appear in deletedCategories
    const deleted = await gql(`query { deletedCategories { data { id isDeleted } } }`);
    expect(deleted.data?.deletedCategories.data.some((c: any) => c.id === id)).toBe(true);
  });

  it('restores a soft-deleted category', async () => {
    const cat = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const id = cat.data?.createCategory.id;
    await gql(`mutation($id: ID!) { deleteCategory(id: $id) { success } }`, { id });

    const restored = await gql(`mutation($id: ID!) { restoreCategory(id: $id) { id isDeleted isActive } }`, { id });
    expect(restored.errors).toBeUndefined();
    expect(restored.data?.restoreCategory.isDeleted).toBe(false);
    expect(restored.data?.restoreCategory.isActive).toBe(true);
  });

  it('soft-deletes all descendants when parent is deleted', async () => {
    const l0 = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const l0id = l0.data?.createCategory.id;
    const l1 = await gql(
      `mutation($p: ID!) { createCategory(input: { name: "Mobile", parentId: $p }) { id } }`,
      { p: l0id }
    );

    await gql(`mutation($id: ID!) { deleteCategory(id: $id) { success } }`, { id: l0id });

    // Child should also be soft-deleted (not found in normal query)
    const find = await gql(`query($id: ID!) { category(id: $id) { id } }`, { id: l1.data?.createCategory.id });
    expect(find.errors?.[0].extensions?.code).toBe('NOT_FOUND');
  });
});

describe('updateCategory', () => {
  it('updates category name', async () => {
    const cat = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    const id = cat.data?.createCategory.id;

    const updated = await gql(
      `mutation($id: ID!) { updateCategory(id: $id, input: { name: "Consumer Electronics" }) { name } }`,
      { id }
    );
    expect(updated.data?.updateCategory.name).toBe('Consumer Electronics');
  });

  it('rejects renaming to an existing name', async () => {
    const a = await gql(`mutation { createCategory(input: { name: "Electronics" }) { id } }`);
    await gql(`mutation { createCategory(input: { name: "Appliances" }) { id } }`);
    const res = await gql(
      `mutation($id: ID!) { updateCategory(id: $id, input: { name: "Appliances" }) { name } }`,
      { id: a.data?.createCategory.id }
    );
    expect(res.errors?.[0].extensions?.code).toBe('ALREADY_EXISTS');
  });
});

describe('categories (pagination)', () => {
  it('returns paginated results with correct meta', async () => {
    for (let i = 1; i <= 5; i++) {
      await gql(`mutation { createCategory(input: { name: "Cat${i}" }) { id } }`);
    }
    const res = await gql(`query { categories(pagination: { page: 1, limit: 3 }) { data { id } total totalPages hasNextPage } }`);
    expect(res.data?.categories.data).toHaveLength(3);
    expect(res.data?.categories.total).toBe(5);
    expect(res.data?.categories.totalPages).toBe(2);
    expect(res.data?.categories.hasNextPage).toBe(true);
  });
});

describe('query depth limit', () => {
  it('rejects queries exceeding depth limit', async () => {
    // Deeply nested query — exceeds MAX_QUERY_DEPTH of 7
    const res = await gql(`
      query {
        categories {
          data {
            parent {
              parent {
                parent {
                  parent {
                    parent {
                      parent {
                        parent { id }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeDefined();
  });
});
