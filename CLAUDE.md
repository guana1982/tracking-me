# CLAUDE.md

Budget Tracker 65/25/10 — pnpm monorepo, Italian UI.
`apps/frontend` (React 18 + Vite + Tailwind), `apps/backend` (Fastify + Prisma + PostgreSQL 16), `packages/shared` (Zod schemas + TS types + constants).

## Commands

```bash
# Development
pnpm dev                # Run frontend + backend concurrently (builds shared first)
pnpm dev:frontend       # Vite dev server on :5173
pnpm dev:backend        # Fastify on :3001 (tsx watch mode)

# Build
pnpm build              # Build all packages
pnpm build:frontend     # TypeScript check + Vite build
pnpm build:backend      # TypeScript compilation to dist/

# Database (Prisma)
pnpm db:generate        # Generate Prisma client
pnpm db:migrate         # Run pending migrations
pnpm db:seed            # Seed demo data
pnpm db:studio          # Open Prisma Studio GUI

# Testing & Linting
pnpm test               # Run backend tests (vitest)
pnpm lint               # ESLint across all packages

# Run a single test (from apps/backend/)
pnpm --filter @budget/backend test -- <test-file-path>
```

Docker: `docker compose up -d` starts PostgreSQL 16 on :5432 and pgAdmin on :5050.

## Read Before Coding

| Topic | File |
|-------|------|
| System architecture | [docs/ai/architecture-overview.md](docs/ai/architecture-overview.md) |
| Frontend map | [docs/ai/frontend-map.md](docs/ai/frontend-map.md) |
| Backend map | [docs/ai/backend-map.md](docs/ai/backend-map.md) |
| Shared contracts | [docs/ai/shared-contracts.md](docs/ai/shared-contracts.md) |
| Routing & navigation | [docs/ai/routing-navigation.md](docs/ai/routing-navigation.md) |
| State management | [docs/ai/state-management.md](docs/ai/state-management.md) |
| API integration | [docs/ai/api-integration-patterns.md](docs/ai/api-integration-patterns.md) |
| UI patterns | [docs/ai/ui-patterns.md](docs/ai/ui-patterns.md) |
| Auth & security | [docs/ai/auth-session-security.md](docs/ai/auth-session-security.md) |
| Coding rules | [docs/ai/coding-rules.md](docs/ai/coding-rules.md) |
| Definition of done | [docs/ai/definition-of-done.md](docs/ai/definition-of-done.md) |
| Test strategy | [docs/ai/test-strategy.md](docs/ai/test-strategy.md) |
| Known pitfalls | [docs/ai/known-pitfalls.md](docs/ai/known-pitfalls.md) |
| Glossary | [docs/ai/glossary.md](docs/ai/glossary.md) |

## Quick Rules

- **Response shape**: `{ success: boolean, data?: T, error?: { code, message, details? } }`
- **All data user-scoped**: every Prisma query must filter by `userId`
- **Shared types only**: DTOs in `@budget/shared`, never duplicate locally
- **Italian UI, English code**: user-facing text in Italian, code/types/comments in English
- **Category colors**: NEEDS=emerald, WANTS=amber, SAVINGS=sky (use `getCategoryColor()`)
- **Validation**: Zod `.parse()` on every route input, schemas from `@budget/shared`
- **No new Zustand stores for server data**: use TanStack Query
- **After changing shared package**: rebuild with `pnpm --filter @budget/shared build`

## Environment

- **Backend .env** (local-only, gitignored): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TWELVE_DATA_API_KEY`
- **Frontend .env**: `VITE_API_URL` (empty in dev — Vite proxy handles `/api` and `/auth`)
- **Deploy**: Railway (Dockerfile.backend, Dockerfile.frontend). Secrets must be set in Railway service variables.

## Working Mode

When proposing changes:
1. Read the relevant `docs/ai/` files for the area you're modifying
2. Find the closest existing pattern and follow it
3. Implement in order: shared contracts → backend → frontend
4. Check against [definition-of-done.md](docs/ai/definition-of-done.md) before finishing
5. Review [known-pitfalls.md](docs/ai/known-pitfalls.md) for regression risks
