# Known Pitfalls

## Auth Token Timing

- **Risk**: Race condition in `/auth/callback` → Zustand store initialization → redirect to `/dashboard`.
- **Detail**: `AuthCallback.tsx` extracts token from URL, calls `/auth/me` to verify, then calls `setAuth()`. If the redirect to `/dashboard` fires before the store is fully hydrated, `ProtectedRoute` may see `isAuthenticated=false` and redirect back to `/login`.
- **Mitigation**: Current code awaits `/auth/me` before setting auth and navigating. Do not refactor to make these concurrent.

## Twelve Data Provider Quota

- **Risk**: `PROVIDER_MINUTE_LIMIT` (429) even on seemingly single requests.
- **Detail**: One frontend call to `/api/portfolio/history?symbols=VTI,BND,EMB` triggers 3 separate Twelve Data API calls (one per symbol). Free tier allows ~7-8 per minute.
- **Impact**: Charts may not render if quota is exhausted before all series return.
- **Location**: `apps/backend/src/services/portfolio.service.ts` — in-memory `minuteUsage` / `dailyUsage` counters.
- **Mitigation**: Keep symbol count per request low. Backend has 5-min cache (`PORTFOLIO_CACHE_TTL_MINUTES`). Don't add auto-refetch on short intervals.

## CashFlowCheck Hybrid Storage

- **Risk**: Data inconsistency between legacy named columns and `valuesJson`.
- **Detail**: `CashFlowCheck` Prisma model has hardcoded fields (`bbva`, `tradeRepublic`, `webankCc`, etc.) AND a `valuesJson` JSON field. The service normalizes between them, but new columns go only into JSON.
- **Location**: `apps/backend/src/services/cashflow.service.ts`, `apps/backend/prisma/schema.prisma`.
- **Rule**: New columns must use the dynamic JSON approach. Do not add new named columns to the Prisma schema.

## Period Auto-Creation

- **Risk**: Unexpected side effects when accessing a month that doesn't exist yet.
- **Detail**: `monthPeriodService.getOrCreate()` creates the period with default budget rule (65/25/10) if it doesn't exist. Dashboard and expense creation both trigger this.
- **Race condition**: Concurrent requests can hit a P2002 unique constraint. The service catches this and retries with a `findFirst()`.
- **Location**: `apps/backend/src/services/month-period.service.ts`.

## Shared Package Build Order

- **Risk**: Stale types if `@budget/shared` is not rebuilt before frontend/backend.
- **Detail**: `pnpm dev` script runs `pnpm --filter @budget/shared build` first, then starts frontend+backend concurrently. If you modify `packages/shared/src/` and only restart one consumer, types may be stale.
- **Rule**: After changing shared types/schemas, run `pnpm --filter @budget/shared build` or restart with `pnpm dev`.

## Float Precision

- **Risk**: Currency amounts stored as Prisma `Float` (JavaScript `number`), not integer cents.
- **Detail**: All amounts (income, expense, reallocation) are EUR floats. Zod schemas enforce `.multipleOf(0.01)` but floating-point arithmetic can still produce rounding issues.
- **Rule**: Be cautious with sum calculations. The codebase uses `parseFloat().toFixed(2)` in some places but not consistently.

## No Test Coverage

- **Risk**: Any change is untested. Vitest is configured but zero test files exist.
- **Impact**: All quality assurance is manual. Regressions can only be caught by running the app.
- **Rule**: When implementing features, consider at minimum adding service-layer unit tests for business logic.

## Query Cache Invalidation

- **Risk**: Stale UI data after mutations if invalidation keys don't match.
- **Detail**: Mutations in `useQueries.ts` invalidate specific query keys on success (e.g., creating an expense invalidates `['expenses', periodKey]` and `['dashboard', periodKey]`). If query keys change shape, invalidation silently fails.
- **Rule**: When modifying query key factories, verify all related mutation `onSuccess` handlers still invalidate the correct keys.

## Environment Variable Drift

- **Risk**: Backend `.env` is local-only (gitignored). Railway deployment requires separate variable configuration.
- **Detail**: `TWELVE_DATA_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `JWT_SECRET` must be set in Railway service variables, not just local `.env`.
- **Location**: `apps/backend/.env.example` documents all required variables.
