# Architecture Overview

## System Diagram

```
┌─────────────────┐      proxy /api, /auth      ┌──────────────────┐      Prisma      ┌──────────────┐
│  Frontend       │ ──────────────────────────── │  Backend         │ ──────────────── │  PostgreSQL  │
│  React + Vite   │                              │  Fastify         │                  │  (Docker)    │
│  :5173          │                              │  :3001           │                  │  :5432       │
└─────────────────┘                              └──────────────────┘                  └──────────────┘
                                                         │
                                                         │ HTTP
                                                         ▼
                                                 ┌──────────────────┐
                                                 │  Twelve Data API │
                                                 │  (portfolio)     │
                                                 └──────────────────┘
                                                         │
                                                         ▼
                                                 ┌──────────────────┐
                                                 │  Google OAuth2   │
                                                 │  (auth)          │
                                                 └──────────────────┘
```

## Monorepo Layout

```
project2026/
├── apps/frontend/     → @budget/frontend  (React 18 + Vite + Tailwind)
├── apps/backend/      → @budget/backend   (Fastify + Prisma + PostgreSQL)
├── packages/shared/   → @budget/shared    (Zod schemas + TS types + constants)
├── docker-compose.yml → PostgreSQL 16 + pgAdmin
└── pnpm-workspace.yaml
```

- **Build order**: `@budget/shared` must build first (tsup → cjs+esm+dts). `pnpm dev` handles this automatically.
- **Workspace protocol**: packages reference each other via `"@budget/shared": "workspace:*"` in package.json.

## Request Lifecycle

```
HTTP Request
  → CORS check (allowed origins + credentials)
  → Auth plugin (JWT + OAuth2 registered)
  → Auth middleware hook (on /api/* routes: verify Bearer JWT → set request.authUser)
  → Route handler (Zod schema.parse(request.body/query/params))
  → Service method (business logic + Prisma queries, always scoped by userId)
  → Response wrapper ({ success: true, data: DTO })
```

**Error path**: Any thrown error → centralized `errorHandler` → maps Zod/Prisma/AppError to `{ success: false, error: { code, message } }`.

## Data Ownership

- All data is user-scoped. Every query filters by `userId` from JWT.
- Cascading deletes: User → MonthPeriod → (BudgetRule, Income, Expense, Reallocation).
- User → CashFlowCheck, CashFlowSettings, FixedExpenseTemplate (direct FK).
- Unique constraints: `[userId, periodKey]` on MonthPeriod prevents duplicate months.

## External Dependencies

| Dependency | Purpose | Location |
|-----------|---------|----------|
| Google OAuth2 | User authentication | `apps/backend/src/auth/` |
| Twelve Data API | Historical market data for portfolio | `apps/backend/src/services/portfolio.service.ts` |
| PostgreSQL 16 | Primary database | Docker container, Prisma ORM |

## Local Development

- `docker compose up -d` → PostgreSQL :5432 + pgAdmin :5050
- `pnpm dev` → builds shared, starts frontend :5173 + backend :3001
- Vite proxy forwards `/api` and `/auth` to backend
- Backend loads env via `tsx --env-file=.env watch src/index.ts`

## Deployment

- **Target**: Railway (Dockerfile.backend, Dockerfile.frontend)
- Backend: Node 18 + Prisma migrations on startup + Fastify :3001
- Frontend: Vite build → served via `npx serve -s dist` :3000
- Environment: all secrets in Railway service variables (not git)

## Detailed Maps

- Frontend internals → [frontend-map.md](frontend-map.md)
- Backend internals → [backend-map.md](backend-map.md)
- Shared package → [shared-contracts.md](shared-contracts.md)
