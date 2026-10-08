# Backend Map

**Package**: `apps/backend/` (`@budget/backend`)
**Stack**: Fastify 4 + TypeScript + Prisma 5 + PostgreSQL 16

## Directory Structure

```
apps/backend/src/
├── auth/
│   ├── auth.plugin.ts       → Registers JWT, OAuth2, cookie plugins
│   ├── auth.middleware.ts    → JWT verification middleware for /api/* routes
│   ├── auth.routes.ts       → /auth/google, /auth/callback, /auth/me, /auth/logout
│   └── auth.service.ts      → findOrCreateUser, getUserById
├── lib/
│   ├── prisma.ts            → Singleton PrismaClient export
│   ├── error-handler.ts     → AppError class + centralized Fastify error handler
│   └── utils.ts             → isPastCutoffDay, buildDedupKey helpers
├── routes/
│   ├── dashboard.routes.ts
│   ├── expense.routes.ts
│   ├── income.routes.ts
│   ├── budget-rule.routes.ts
│   ├── month-period.routes.ts
│   ├── reallocation.routes.ts
│   ├── cashflow.routes.ts
│   ├── fixed-expense-template.routes.ts
│   └── portfolio.routes.ts
├── services/
│   ├── dashboard.service.ts
│   ├── expense.service.ts
│   ├── income.service.ts
│   ├── budget-rule.service.ts
│   ├── month-period.service.ts
│   ├── reallocation.service.ts
│   ├── cashflow.service.ts
│   ├── fixed-expense-template.service.ts
│   └── portfolio.service.ts
└── index.ts                  → Server entry, plugin registration, route mounting
```

## Plugin Registration Order (index.ts)

1. `@fastify/cors` — CORS with allowed origins list
2. `authPlugin` — JWT + OAuth2 + cookies
3. `@fastify/swagger` + `@fastify/swagger-ui` — OpenAPI docs at `/docs`
4. `errorHandler` — centralized Fastify `setErrorHandler`
5. Health check: `GET /health`
6. Auth routes: `/auth/*` (public)
7. Auth middleware hook: `onRequest` for `/api/*` → verifies JWT
8. Functional routes (9 modules, all under `/api/`)

## Route Prefix Mapping

| Module | Prefix | Endpoints |
|--------|--------|-----------|
| `month-period.routes` | `/api/periods` | GET /, GET /current, GET /:periodKey, POST /, POST /:periodKey/close, POST /:periodKey/reopen, DELETE /:periodKey |
| `dashboard.routes` | `/api/dashboard` | GET /current, GET /:periodKey, GET /savings-history/:periodKey |
| `budget-rule.routes` | `/api/budget-rules` | GET /:periodKey, PUT /:periodKey |
| `income.routes` | `/api/incomes` | GET /period/:periodKey, GET /:id, POST /period/:periodKey, PUT /:id, DELETE /:id |
| `expense.routes` | `/api/expenses` | GET /period/:periodKey, GET /:id, POST /period/:periodKey, PUT /:id, DELETE /:id |
| `reallocation.routes` | `/api/reallocations` | GET /period/:periodKey, GET /period/:periodKey/preview, POST /period/:periodKey, DELETE /:id |
| `cashflow.routes` | `/api/cashflow` | Checks (CRUD), Columns (CRUD + swap), Classifications (CRUD), Settings (GET/PUT) |
| `fixed-expense-template.routes` | `/api/fixed-expenses` | GET /, POST /, PUT /:id, DELETE /:id, POST /apply/:periodKey |
| `portfolio.routes` | `/api/portfolio` | GET /history?symbols=...&horizon=... |

## Service Layer Pattern

- Each service is a class exported as a singleton: `export const fooService = new FooService()`
- 1:1 mapping with route modules
- Services own all Prisma queries and business logic
- Routes never access Prisma directly
- Services import other services when needed (e.g., `dashboardService` calls `expenseService.getTotalsByCategory()`)

## Error Handling Flow

```
Route handler throws / Zod parse fails / Prisma rejects
  → Fastify errorHandler catches
  → Inspects error type:
     ZodError        → 400 VALIDATION_ERROR (details: field-level errors)
     PrismaP2002     → 409 DUPLICATE_ENTRY
     PrismaP2025     → 404 NOT_FOUND
     AppError        → error.statusCode + error.code
     Other           → 500 INTERNAL_SERVER_ERROR
  → Returns { success: false, error: { code, message, details? } }
```

## Validation Approach

- All input validation uses Zod schemas imported from `@budget/shared`
- Route handler: `const data = createExpenseSchema.parse(request.body)`
- URL params validated inline: `periodKeySchema.parse(request.params.periodKey)`
- Query params: `expenseFiltersSchema.parse(request.query)`

## Database

- Schema: `apps/backend/prisma/schema.prisma`
- 7 models + 2 enums (Category, TricountType)
- 8 migrations in `prisma/migrations/`
- Singleton client: `apps/backend/src/lib/prisma.ts`
- All FKs cascade on delete

## Related Docs

- Shared types/schemas → [shared-contracts.md](shared-contracts.md)
- API patterns → [api-integration-patterns.md](api-integration-patterns.md)
- Auth details → [auth-session-security.md](auth-session-security.md)
