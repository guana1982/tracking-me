# Glossary

## Domain Terms

- **periodKey** — Month identifier in `YYYY-MM` format (e.g., `2026-03`). Primary key for all monthly budget data. Unique per user via `@@unique([userId, periodKey])` in Prisma.
- **Budget Rule 65/25/10** — Default allocation: 65% Needs, 25% Wants, 10% Savings. Percentages are user-editable per month but must sum to 100.
- **Category** — Prisma enum: `NEEDS`, `WANTS`, `SAVINGS`. Drives expense classification, budget allocation, and UI color coding.
- **cutoffDay** — Day of month (default 26) after which unspent budget from NEEDS/WANTS can be reallocated to SAVINGS.
- **Reallocation** — Transfer of unspent budget from NEEDS or WANTS into SAVINGS. Only allowed direction: `NEEDS→SAVINGS` or `WANTS→SAVINGS`. Gated by cutoffDay and autoReallocate flag.
- **TricountType** — Shared expense split: `IO` (user pays own share) or `FRA` (split with partner). Amount is halved when tricount is active. Label prefixed with "[Tricount]".
- **CashFlowCheck** — Net worth snapshot at a point in time. Tracks balances across bank accounts, investments, and custom columns.
- **FixedExpenseTemplate** — Recurring expense template (e.g., rent, subscriptions). Can be bulk-applied to a month period, with deduplication by label+amount.
- **MonthPeriod** — A user's budget month. Can be open or closed (`isClosed`). Auto-created on first access if missing.

## Technical Terms

- **DTO** — Data Transfer Object. All API responses use `*DTO` types defined in `packages/shared/src/types.ts`. Never return raw Prisma models.
- **ApiResponse\<T\>** — Standard response wrapper: `{ success: boolean, data?: T, error?: { code, message, details? } }`.
- **PaginatedResponse\<T\>** — Extension of ApiResponse for lists: `{ items: T[], total, page, pageSize, totalPages }`. Currently used only for expenses.
- **AppError** — Custom error class in `apps/backend/src/lib/error-handler.ts`. Has `statusCode` and `code` fields. Caught by centralized error handler.
- **ApiError** — Frontend error class in `apps/frontend/src/lib/api.ts`. Has `code` and `details` fields. Thrown by `fetchApi` on non-success responses.
- **queryKeys** — Factory object in `apps/frontend/src/hooks/useQueries.ts`. Generates typed cache keys for TanStack Query. periodKey is the primary cache dimension.
- **fetchApi\<T\>** — Generic fetch wrapper in `apps/frontend/src/lib/api.ts`. Auto-injects Bearer token, auto-logout on 401, unwraps ApiResponse to return `T`.

## Italian UI Label Mapping

| English | Italian (UI) | Category Color |
|---------|-------------|----------------|
| Needs | Necessità | Emerald (green) |
| Wants | Svago | Amber (orange) |
| Savings | Risparmi | Sky (blue) |

## Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Zod schema parse failure |
| `DUPLICATE_ENTRY` | 409 | Prisma P2002 unique constraint |
| `NOT_FOUND` | 404 | Prisma P2025 or manual check |
| `DATABASE_ERROR` | 500 | Other Prisma errors |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `PROVIDER_MINUTE_LIMIT` | 429 | Twelve Data per-minute quota exceeded |
| `PROVIDER_DAY_LIMIT` | 429 | Twelve Data daily quota exceeded |
