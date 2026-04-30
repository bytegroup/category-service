# Database Design

## Overview

MongoDB is used as the primary datastore. The `categories` collection uses a **hybrid Adjacency List + Materialized Path (Ancestors Array)** strategy. This allows unlimited nesting depth while keeping every critical operation — full parent-chain retrieval, cascade deactivation, cascade soft-delete, and descendant queries — to a single DB query with no recursion.

---

## Collection: `categories`

### Schema

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Auto | — | MongoDB primary key |
| `name` | `String` | Yes | — | Globally unique, trimmed, max 100 chars |
| `parent` | `ObjectId \| null` | No | `null` | Direct parent reference; `null` = root |
| `ancestors` | `ObjectId[]` | No | `[]` | Ordered path: root → direct parent |
| `isActive` | `Boolean` | No | `true` | Soft-deactivation flag |
| `isDeleted` | `Boolean` | No | `false` | Soft-delete flag — data is never physically removed |
| `deletedAt` | `Date \| null` | No | `null` | Timestamp of soft-deletion |
| `createdAt` | `Date` | Auto | — | Managed by Mongoose timestamps |
| `updatedAt` | `Date` | Auto | — | Managed by Mongoose timestamps |

---

## Indexes

| Index | Type | Purpose |
|---|---|---|
| `name` | Unique | Enforce globally unique category names |
| `parent` | Standard | Fast direct-children lookup |
| `ancestors` | Standard | Fast cascade operations and descendant queries |
| `isActive` | Standard | Filter active/inactive categories |
| `isDeleted` | Standard | Exclude soft-deleted docs from all reads |
| `parent + isActive` | Compound | Children lookup filtered by status |
| `isDeleted + isActive` | Compound | Combined status filter |
| `name` (text) | Text | Full-text name search |

---

## Design Strategy: Adjacency List + Ancestors Array

A plain Adjacency List (only `parent` field) requires recursive queries to traverse the tree. By also storing `ancestors` — the full ordered path from root to direct parent — all tree traversal becomes a single indexed query.

| Operation | Plain Adjacency List | **This Design** |
|---|---|---|
| Get full parent chain | N recursive queries | **1 query + populate** |
| Cascade deactivate descendants | N recursive queries | **1 `updateMany`** |
| Cascade soft-delete descendants | N recursive queries | **1 `updateMany`** |
| Find all descendants | N recursive queries | **1 `find`** |
| Insert new category | 1 insert | **1 insert** |
| Depth support | Unlimited | **Unlimited** |

---

## Example Documents

### Level 0 — Root
```json
{
  "_id": "AAA",
  "name": "Electronics",
  "parent": null,
  "ancestors": [],
  "isActive": true,
  "isDeleted": false,
  "deletedAt": null
}
```

### Level 1
```json
{
  "_id": "BBB",
  "name": "Accessories",
  "parent": "AAA",
  "ancestors": ["AAA"],
  "isActive": true,
  "isDeleted": false,
  "deletedAt": null
}
```

### Level 2
```json
{
  "_id": "CCC",
  "name": "Wearable Accessories",
  "parent": "BBB",
  "ancestors": ["AAA", "BBB"],
  "isActive": true,
  "isDeleted": false,
  "deletedAt": null
}
```

### Level 3
```json
{
  "_id": "DDD",
  "name": "Smart Watch",
  "parent": "CCC",
  "ancestors": ["AAA", "BBB", "CCC"],
  "isActive": true,
  "isDeleted": false,
  "deletedAt": null
}
```

Path: `Electronics > Accessories > Wearable Accessories > Smart Watch`

---

## Key Operations

### Unique Name Enforcement

The `unique: true` index on `name` is enforced at the database level (case-insensitive check also done in the repository layer). Duplicate inserts throw `MongoServerError` code `11000`.

### Building Ancestors on Create

When a new category is created with a `parentId`, the service resolves the ancestors array from the parent document:

```ts
ancestors = [...parent.ancestors, parent._id];
```

No recursion — one `findById` on the parent, then the array is constructed in memory.

### Full Parent Chain in One Response

Because `ancestors` is stored on the document, the complete parent chain is available without any recursive query. The GraphQL resolver uses **DataLoader** to batch-load all ancestor documents in a single `find`:

```ts
// All ancestor IDs across all requested categories → batched into 1 DB query
categoryLoader.loadMany(ancestorIds);
```

### Cascade Deactivation

Deactivating a category marks it and all descendants inactive in two queries (wrapped in a transaction):

```ts
// 1. Deactivate the category itself
Category.findOneAndUpdate({ _id: id }, { isActive: false });

// 2. Deactivate all descendants — single indexed query via ancestors array
Category.updateMany({ ancestors: id, isDeleted: false }, { isActive: false });
```

### Soft Delete

`deleteCategory` never removes documents. It sets `isDeleted: true`, `isActive: false`, and records `deletedAt`. Descendants are soft-deleted in the same operation:

```ts
// 1. Soft-delete the category
Category.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false, deletedAt: new Date() });

// 2. Cascade to all descendants
Category.updateMany({ ancestors: id }, { isDeleted: true, isActive: false, deletedAt: new Date() });
```

All repository read queries include `{ isDeleted: false }` via a shared `ACTIVE_FILTER` constant — soft-deleted documents are invisible to normal operations. They remain accessible via the `deletedCategories` query for audit or restoration.

### Restore

Restoring a soft-deleted category reverses all three flags:

```ts
Category.findOneAndUpdate(
  { _id: id, isDeleted: true },
  { isDeleted: false, isActive: true, deletedAt: null }
);
```

---

## Redis Cache Layer

All read operations are cached with a configurable TTL (default: 3600s). Any write or deactivation invalidates all `category*` keys atomically using `KEYS` + `DEL`. Cache is a no-op in `test` environment.

| Cache Key | Content | Invalidated by |
|---|---|---|
| `category:{id}` | Single category by ID | Any mutation |
| `category:name:{name}` | Single category by name | Any mutation |
| `categories:all:{page}:{limit}` | Paginated list | Any mutation |
| `category:{id}:children` | Direct children list | Any mutation |

---

## Seed Data

Running `npm run seed` inserts 260 categories across 7 root trees:

| Root Category | Approximate Count |
|---|---|
| Electronics | 55 |
| Appliances | 35 |
| Fashion | 40 |
| Health & Beauty | 35 |
| Sports & Outdoors | 35 |
| Books & Stationery | 30 |
| Toys & Games | 30 |

Seed data is ordered so parents always appear before their children — no dependency resolution required at runtime.
