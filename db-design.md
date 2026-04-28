# Database Design

## Overview

MongoDB is used as the primary datastore. The Category collection uses a **hybrid Adjacency List + Materialized Path (Ancestors Array)** strategy to support unlimited nesting depth while keeping all critical operations — full parent-chain retrieval, cascade deactivation, and descendant queries — at O(1) or single-query complexity.

---

## Collection: `categories`

### Schema

| Field        | Type               | Required | Default | Description                                             |
|--------------|--------------------|----------|---------|---------------------------------------------------------|
| `_id`        | `ObjectId`         | Auto     | —       | MongoDB primary key                                     |
| `name`       | `String`           | Yes      | —       | Globally unique, trimmed, max 100 chars                 |
| `parent`     | `ObjectId \| null` | No       | `null`  | Direct parent reference; `null` = root category         |
| `ancestors`  | `ObjectId[]`       | No       | `[]`    | Ordered list from root → direct parent                  |
| `isActive`   | `Boolean`          | No       | `true`  | Soft-deactivation flag                                  |
| `createdAt`  | `Date`             | Auto     | —       | Managed by Mongoose timestamps                          |
| `updatedAt`  | `Date`             | Auto     | —       | Managed by Mongoose timestamps                          |

---

## Indexes

| Index                         | Type      | Purpose                                             |
|-------------------------------|-----------|-----------------------------------------------------|
| `name`                        | Unique    | Enforce globally unique category names              |
| `ancestors`                   | Standard  | Fast cascade deactivation & descendant queries      |
| `parent + isActive`           | Compound  | Fast direct-children lookup with status filter      |
| `name` (text)                 | Text      | Full-text search support                            |

---

## Design Strategy: Why Adjacency List + Ancestors Array?

A plain Adjacency List (storing only `parent`) requires recursive queries to traverse the tree — expensive at depth. By also storing `ancestors` (the full path from root to direct parent), we achieve:

| Operation                          | Plain Adjacency List | **This Design**     |
|------------------------------------|----------------------|---------------------|
| Get full parent chain              | N recursive queries  | **1 query + populate** |
| Cascade deactivate all descendants | N recursive queries  | **1 updateMany**    |
| Find all descendants               | N recursive queries  | **1 find**          |
| Insert new category                | 1 insert             | **1 insert**        |
| Depth level                        | Unlimited            | **Unlimited**       |

---

## Example Documents

### Root (Level 0)
```json
{
  "_id": "AAA",
  "name": "Electronics",
  "parent": null,
  "ancestors": [],
  "isActive": true
}
```

### Level 1
```json
{
  "_id": "BBB",
  "name": "Accessories",
  "parent": "AAA",
  "ancestors": ["AAA"],
  "isActive": true
}
```

### Level 2
```json
{
  "_id": "CCC",
  "name": "Wearable Accessories",
  "parent": "BBB",
  "ancestors": ["AAA", "BBB"],
  "isActive": true
}
```

### Level 3
```json
{
  "_id": "DDD",
  "name": "Smart Watch",
  "parent": "CCC",
  "ancestors": ["AAA", "BBB", "CCC"],
  "isActive": true
}
```

Path: `Electronics > Accessories > Wearable Accessories > Smart Watch`

---

## Edge Case: Adding a New Category

When a new category is created:

1. **Name uniqueness** is checked before insert (case-insensitive).
2. If a `parentId` is provided:
   - Parent must exist — throws `NOT_FOUND` if not.
   - Parent must be active — throws `CATEGORY_INACTIVE` if not.
   - `ancestors` is derived as `[...parent.ancestors, parent._id]`.
3. If no `parentId`, it becomes a root category with `ancestors: []`.
4. The insert runs inside a **MongoDB transaction** to ensure atomicity.

---

## Cascade Deactivation

When a category is deactivated, a single `updateMany` using the `ancestors` index deactivates all descendants:

```js
// Deactivate the category
await Category.findByIdAndUpdate(id, { isActive: false });

// Deactivate every document that has this category in its ancestors array
await Category.updateMany({ ancestors: id }, { isActive: false });
```

Both operations run inside a single transaction.

---

## Redis Cache Layer

All read operations are cached in Redis with a configurable TTL (default: 3600s).

| Cache Key Pattern              | Stores                              |
|-------------------------------|--------------------------------------|
| `category:{id}`               | Single category by ID                |
| `category:name:{name}`        | Single category by name              |
| `categories:all:{page}:{limit}` | Paginated category list             |
| `category:{id}:children`      | Direct children list                 |

Any write or deactivation operation flushes all `category*` keys atomically.
