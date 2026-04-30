# Category API

A production-ready **GraphQL API** for hierarchical category management built with Node.js, TypeScript, Express, Apollo Server 4, MongoDB, and Redis.

---

## Features

| Feature | Detail |
|---|---|
| Unlimited nesting | Adjacency List + Ancestors Array — no depth cap |
| Full parent chain | Returned in a single query response — no extra round trips |
| Cascade deactivation | Deactivating a category auto-deactivates all descendants |
| Soft delete | `deleteCategory` marks data as deleted — fully restorable |
| Redis caching | Reads served from cache; all writes invalidate cache atomically |
| DataLoader | Batches parent/ancestor DB lookups — eliminates N+1 queries |
| Query depth limit | Rejects queries deeper than 7 levels at parse time |
| Query complexity limit | Rejects queries scoring above 200 complexity points |
| Rate limiting | 100 POST requests / 15 min per IP on `/graphql` |
| Global request logger | Every request path intercepted — logs method, path, status, duration, requestId |
| Structured errors | Typed error codes with consistent HTTP status mapping |
| Graceful shutdown | SIGTERM / SIGINT handled — drains connections before exit |
| Docker-ready | Multi-stage Dockerfile + Docker Compose with health checks |
| Integration tests | 15 tests covering all business rules — no mocks, real in-memory DB |
| Seeder | 260 realistic categories across 7 trees — `npm run seed` |

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 22 |
| Language | TypeScript | 5 |
| Framework | Express | 4 |
| GraphQL Server | Apollo Server | 4 |
| ODM | Mongoose | 8 |
| Database | MongoDB | 7 |
| Cache | Redis + ioredis | 7 / 5 |
| DataLoader | dataloader | 2 |
| Logging | Winston | 3 |
| Testing | Jest + mongodb-memory-server | 29 / 10 |
| Container | Docker + Docker Compose | — |

---

## Project Structure

```
category-api/
├── src/
│   ├── config/
│   │   ├── index.ts           # Environment config with validation
│   │   ├── database.ts        # Mongoose connect / disconnect
│   │   └── redis.ts           # ioredis client factory
│   ├── models/
│   │   └── category.model.ts  # Mongoose schema + indexes
│   ├── repositories/
│   │   └── category.repository.ts  # Data access layer (all DB queries)
│   ├── services/
│   │   └── category.service.ts     # Business logic + cache + transactions
│   ├── graphql/
│   │   ├── index.ts                # Apollo Server factory (depth + complexity limits)
│   │   ├── schemas/
│   │   │   └── category.schema.ts  # GraphQL SDL type definitions
│   │   └── resolvers/
│   │       └── category.resolver.ts  # Resolvers with DataLoader
│   ├── loaders/
│   │   └── category.loader.ts  # DataLoader — batches DB calls, eliminates N+1
│   ├── middleware/
│   │   ├── requestLogger.ts    # Global request interceptor (every path logged)
│   │   └── errorHandler.ts     # 404 + global error handler
│   ├── seeds/
│   │   ├── data.ts             # 260 realistic seed entries across 7 category trees
│   │   └── runner.ts           # Seed runner — npm run seed
│   ├── tests/
│   │   ├── helpers/
│   │   │   ├── globalSetup.ts    # Starts MongoMemoryServer before suite
│   │   │   ├── globalTeardown.ts # Stops MongoMemoryServer after suite
│   │   │   └── testDb.ts         # Per-test connect / clear / disconnect
│   │   └── integration/
│   │       └── category.test.ts  # 15 integration tests
│   ├── types/
│   │   ├── index.ts           # Shared interfaces + GraphQLContext
│   │   └── express.d.ts       # Express Request augmentation (requestId, startTime)
│   ├── utils/
│   │   ├── logger.ts          # Winston structured logger
│   │   ├── errors.ts          # AppError class + ErrorCode enum
│   │   └── cache.ts           # Redis get / set / invalidate helpers
│   ├── app.ts                 # Express app factory (rate limit, middleware, GraphQL)
│   └── index.ts               # Entry point + graceful shutdown
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── tsconfig.json
```

### Architecture Layers

```
GraphQL Resolver → Service → Repository → Mongoose → MongoDB
       ↑                ↕
   DataLoader      Redis Cache
```

---

## Prerequisites

- Node.js >= 22
- MongoDB >= 7
- Redis >= 7
- Docker + Docker Compose *(optional but recommended)*

---

## Quick Start

### Option 1 — Docker (recommended)

```bash
git clone <repo-url>
cd category-service
docker-compose up --build
```

All three services (app, MongoDB, Redis) start automatically.

- GraphQL Sandbox → http://localhost:4000/graphql
- Health check → http://localhost:4000/health

### Option 2 — Manual

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your MongoDB URI and Redis host

# 3. Run (hot reload)
npm run dev

# 4. Seed (optional)
npm run seed

# 4. Integration test (optional)
npm run test
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `4000` | HTTP server port |
| `MONGODB_URI` | `mongodb://localhost:27017/category_db` | MongoDB connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(empty)* | Redis password if set |
| `REDIS_TTL` | `3600` | Cache TTL in seconds |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |

---

## API Reference

**Endpoint:** `POST http://localhost:4000/graphql`

Apollo Sandbox is available at the same URL in `development`. Introspection is disabled in `production`.

---

### Queries

#### Get category by ID
```graphql
query {
  category(id: "64f1a2b3c4d5e6f7a8b9c0d1") {
    id
    name
    isActive
    isDeleted
    parent { id name }
    ancestors { id name }
    createdAt
    updatedAt
  }
}
```

#### Search by name — returns full ancestor chain in one response
```graphql
query {
  categoryByName(name: "Smart Watch") {
    id
    name
    ancestors { id name }
  }
}
```

#### List all categories (paginated)
```graphql
query {
  categories(pagination: { page: 1, limit: 20 }) {
    data { id name isActive }
    total
    page
    limit
    totalPages
    hasNextPage
    hasPrevPage
  }
}
```

#### Get direct children
```graphql
query {
  categoryChildren(parentId: "64f1a2b3c4d5e6f7a8b9c0d1") {
    id
    name
    isActive
  }
}
```

#### Get soft-deleted categories (audit / restore)
```graphql
query {
  deletedCategories(pagination: { page: 1, limit: 20 }) {
    data { id name deletedAt }
    total
  }
}
```

---

### Mutations

#### Create root category
```graphql
mutation {
  createCategory(input: { name: "Electronics" }) {
    id name ancestors { id name }
  }
}
```

#### Create nested category
```graphql
mutation {
  createCategory(input: { name: "Smart Watch", parentId: "64f1a2b3c4d5e6f7a8b9c0d1" }) {
    id name ancestors { id name }
  }
}
```

#### Update name
```graphql
mutation {
  updateCategory(id: "64f1a2b3c4d5e6f7a8b9c0d1", input: { name: "Wearables" }) {
    id name
  }
}
```

#### Deactivate (cascades to all descendants)
```graphql
mutation {
  deactivateCategory(id: "64f1a2b3c4d5e6f7a8b9c0d1") {
    id name isActive
  }
}
```

#### Reactivate
```graphql
mutation {
  reactivateCategory(id: "64f1a2b3c4d5e6f7a8b9c0d1") {
    id name isActive
  }
}
```

#### Soft-delete (cascades to all descendants, restorable)
```graphql
mutation {
  deleteCategory(id: "64f1a2b3c4d5e6f7a8b9c0d1") {
    success message
  }
}
```

#### Restore a soft-deleted category
```graphql
mutation {
  restoreCategory(id: "64f1a2b3c4d5e6f7a8b9c0d1") {
    id name isDeleted isActive
  }
}
```

---

## Error Handling

All errors return a consistent structure via GraphQL `extensions`:

```json
{
  "errors": [{
    "message": "Category with name \"Electronics\" already exists",
    "extensions": {
      "code": "ALREADY_EXISTS",
      "statusCode": 409
    }
  }]
}
```

| Code | Status | Trigger |
|---|---|---|
| `NOT_FOUND` | 404 | Category does not exist |
| `ALREADY_EXISTS` | 409 | Duplicate category name |
| `INVALID_INPUT` | 400 | Validation failure |
| `CATEGORY_INACTIVE` | 400 | Operation on or from an inactive category |
| `MAX_DEPTH_EXCEEDED` | 400 | Nesting depth exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error (sanitised in production) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## Security

| Mechanism | Detail |
|---|---|
| Rate limiting | 100 POST requests / 15 min per IP — `express-rate-limit` |
| Query depth limit | Max 7 levels — `graphql-depth-limit`, enforced at parse time |
| Query complexity | Max score 200 — `graphql-query-complexity`, before execution |
| HTTP headers | Secure defaults via `helmet` |
| CORS | Configurable — restrict `origin` in production |
| Introspection | Disabled in `production` |
| Error masking | `INTERNAL_ERROR` details hidden in `production` responses |

---

## Caching (Redis)

All reads are cached. Any write or deactivation flushes all `category*` keys atomically.

| Key pattern | Stores |
|---|---|
| `category:{id}` | Single category by ID |
| `category:name:{name}` | Single category by name |
| `categories:all:{page}:{limit}` | Paginated list |
| `category:{id}:children` | Direct children list |

Cache is a no-op in `test` environment — Redis is not required for tests.

---

## Logging

Structured JSON in `production`, colorized in `development`.

Every request emits two log lines — one on arrival, one on completion:

```json
{ "message": "Incoming request",   "requestId": "uuid", "method": "POST", "path": "/graphql" }
{ "message": "Request completed",  "requestId": "uuid", "statusCode": 200, "durationMs": 12 }
```

Production log files (written to `logs/`):

- `logs/combined.log` — all levels
- `logs/error.log` — errors only

---

## Testing

```bash
npm test               # Run all 15 integration tests
npm run test:coverage  # With coverage report
```

Uses `mongodb-memory-server` — no external MongoDB or Redis required.

| Suite | Tests |
|---|---|
| `createCategory` | 5 — happy path, ancestors, duplicate, inactive parent, bad parentId |
| `getCategoryByName` | 2 — full ancestor chain, NOT_FOUND |
| `deactivateCategory` | 2 — cascade, double-deactivate error |
| `soft delete & restore` | 3 — soft-delete, restore, cascade soft-delete |
| `updateCategory` | 2 — name update, duplicate rejection |
| `categories pagination` | 1 — meta correctness |
| `query depth limit` | 1 — rejection of deep queries |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run production build |
| `npm run seed` | Insert 260 seed categories |
| `npm test` | Run integration tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |

---

## Health Check

```bash
curl http://localhost:4000/health
# { "status": "ok", "timestamp": "...", "environment": "development" }
```

---

## Docker

### Compose (recommended)

```bash
docker-compose up --build
```

| Service | Image | Port |
|---|---|---|
| `app` | Built from `Dockerfile` | 4000 |
| `mongo` | `mongo:7.0` | 27017 |
| `redis` | `redis:7.4-alpine` | 6379 |

All services include health checks. The app container waits for both MongoDB and Redis to be healthy before starting.

### Manual Docker build

```bash
docker build -t category-api .
docker run -p 4000:4000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/category_db \
  -e REDIS_HOST=host.docker.internal \
  category-api
```
