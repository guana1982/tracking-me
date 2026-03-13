# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Budget Tracker 65/25/10 — a full-stack personal finance app implementing the 65/25/10 budget rule (Needs/Wants/Savings). Italian language UI. Built as a pnpm monorepo with three packages:

- **`apps/frontend`** (`@budget/frontend`): React 18 + TypeScript + Vite + Tailwind CSS
- **`apps/backend`** (`@budget/backend`): Fastify + TypeScript + Prisma ORM + PostgreSQL 16
- **`packages/shared`** (`@budget/shared`): Shared Zod schemas, TypeScript types, and constants

## Common Commands

```bash
# Development
pnpm dev                # Run frontend + backend concurrently
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

Database runs via Docker: `docker compose up -d` starts PostgreSQL 16 on :5432 and pgAdmin on :5050.

## Architecture

### Backend (Fastify)

Plugin-based architecture with a clear service layer:

- **Routes** (`apps/backend/src/routes/`): HTTP endpoint definitions, request validation with Zod, delegate to services. Six modules: dashboard, expenses, incomes, budgetRules, periods, reallocations.
- **Services** (`apps/backend/src/services/`): Business logic, Prisma queries, no HTTP concerns.
- **Auth** (`apps/backend/src/auth/`): Google OAuth2 → JWT flow. Plugin registers passport strategies; middleware verifies JWT on `/api` routes.
- **Error handling** (`apps/backend/src/lib/error-handler.ts`): Custom `AppError` class. Centralized handler for Zod validation, Prisma, and HTTP errors. All API responses follow `{ success, data?, error? }` shape.

### Frontend (React)

- **Pages** (`apps/frontend/src/pages/`): Dashboard, Expenses, Settings, Login, AuthCallback
- **State**: Zustand store for auth (token + user, localStorage-persisted). TanStack Query for all server state (caching, refetching, mutations).
- **API layer** (`apps/frontend/src/lib/api.ts`): Centralized typed fetch functions. All requests include `Authorization: Bearer` header from auth store.
- **Hooks** (`apps/frontend/src/hooks/`): `useQueries.ts` wraps TanStack Query with typed query keys; `usePeriod.ts` manages month navigation state.
- **Vite proxy**: Dev server proxies `/api` and `/auth` to backend at localhost:3001.
- **Path alias**: `@/` maps to `apps/frontend/src/`.

### Shared Package

- `types.ts`: All DTOs and interfaces used by both frontend and backend
- `schemas.ts`: Zod validation schemas (used by backend routes and could be used by frontend forms)
- `constants.ts`: Budget categories, default percentages (65/25/10), thresholds

### Database (Prisma)

Schema at `apps/backend/prisma/schema.prisma`. Six models: User, MonthPeriod, BudgetRule, Income, Expense, Reallocation. All data is user-scoped with cascading deletes. Category enum: `NEEDS`, `WANTS`, `SAVINGS`. Period keys use `YYYY-MM` format. Unique constraint on `userId + periodKey` for periods.

### Authentication Flow

Google OAuth2 callback → find/create user → sign JWT → redirect to frontend with token in query param → Zustand store persists token → all API calls authenticated via Bearer header.

## Key Conventions

- All API responses use the shape: `{ success: boolean, data?: T, error?: { code, message, details? } }`
- Error codes: `VALIDATION_ERROR`, `DUPLICATE_ENTRY`, `NOT_FOUND`, `DATABASE_ERROR`, `UNAUTHORIZED`
- Frontend uses Tailwind CSS utility classes (mobile-first responsive), Lucide icons
- Environment variables: backend uses `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`; frontend uses `VITE_API_URL`
- Docker deployment: separate Dockerfiles for frontend and backend, `docker-compose.yml` for local PostgreSQL

## Architectural Evidence (March 2026)

This section tracks architecture and implementation decisions introduced during the current development thread.

### Authentication and Login Reliability

- Login flow (`/login` -> Google OAuth -> `/auth/callback`) has been hardened on frontend side to reduce first-attempt failures.
- Observed `304 Not Modified` on `/dashboard` and cached font requests are expected HTTP cache behavior and are not root-cause errors.
- Focus area for reliability: token propagation timing in callback/store initialization and redirect sequencing.

### Cash-Flow Chart (Andamento Totale nel Tempo)

- Y-axis scaling for the total trend chart was changed to be data-driven from actual point excursion instead of broad static ranges.
- Goal: preserve visual readability of small deltas (for example 58,500 -> 58,000 -> 57,800) by avoiding axis domains starting from zero when not meaningful.
- Y-axis labels were improved to avoid overlap and increase legibility with a cleaner UX.
- Added a dedicated toggle for the blue "Totale" line:
- default state: ON (visible at first load)
- user can disable it to hide the total line
- other optional series remain OFF by default

### Portfolio Page Introduction

- Added a new `Portfolio` page to support portfolio analysis workflows.
- Page is split into two main functional areas:
- current invested instruments (user portfolio registry)
- interactive study/simulation area for equities and bonds allocation analysis
- Added UX flow to insert instruments (ETF and bonds) from the UI using an input workflow with modal-based interaction.

### Market Data Integration (Historical Series)

- Implemented backend endpoint for historical market data:
- `GET /api/portfolio/history?symbols=...&horizon=...`
- Added shared contracts (types + schemas) in `packages/shared` for portfolio history request/response validation.
- Added backend service integration with Twelve Data as primary provider for historical series.
- Added frontend API and query hook integration to consume backend portfolio history and render charts from real data (mock replaced).
- Added in-memory protections in backend service:
- request deduplication for in-flight identical fetches
- provider quota guards for per-minute and per-day limits
- short-lived caching to reduce repeated provider hits

### Environment and Deployment Notes

- Backend local development script was aligned to load env file explicitly:
- `tsx --env-file=.env watch src/index.ts`
- Important deployment rule: `apps/backend/.env` is local-only and not pushed to Git.
- Railway must receive `TWELVE_DATA_API_KEY` (and related env vars) in service Variables, then redeploy/restart to apply.
- Added `TWELVE_DATA_API_KEY` placeholders/documentation in backend env example.

### Known Runtime Behavior and Quota Implications

- Error `PROVIDER_MINUTE_LIMIT` with HTTP 429 can happen even on "first manual test" when one frontend action requests multiple symbols.
- Current provider guard counts per-symbol external calls; example: 6 symbols in one request consume 6 minute slots.
- If free tier minute budget is low, charts may not render because data fetch is rate-limited before usable series are returned.
- UI rendering logic was adjusted to show chart when at least one valid series is available (not only when both compared sets are present).

### Operational Guidance

- For personal use with free provider tiers, keep requests bounded:
- fewer symbols per request
- lower auto-refetch frequency
- leverage backend cache window
- If usage increases, consider either:
- provider plan upgrade
- secondary fallback provider (Yahoo-based ingestion path) with normalized internal DTOs
