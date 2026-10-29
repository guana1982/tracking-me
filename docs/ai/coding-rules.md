# Coding Rules

Rules inferred from the actual codebase. Follow these when implementing or reviewing changes.

## File Naming

- Backend routes: `kebab-case.routes.ts` (e.g., `budget-rule.routes.ts`, `month-period.routes.ts`)
- Backend services: `kebab-case.service.ts` (e.g., `expense.service.ts`)
- Frontend pages: `PascalCase.tsx` (e.g., `Dashboard.tsx`, `CashFlow.tsx`)
- Frontend components: `PascalCase.tsx` (e.g., `BudgetChart.tsx`, `QuickAddModal.tsx`)
- Frontend hooks: `camelCase.ts` (e.g., `useQueries.ts`, `usePeriod.ts`)
- Shared: `kebab-case.ts` (e.g., `types.ts`, `schemas.ts`, `constants.ts`)

## Export Patterns

- **Backend services**: Class + singleton instance export
  ```ts
  class ExpenseService { ... }
  export const expenseService = new ExpenseService();
  ```
- **Backend routes**: Named async plugin function export
  ```ts
  export const expenseRoutes: FastifyPluginAsync = async (fastify) => { ... };
  ```
- **Frontend components/pages**: Named exports (not default)
  ```ts
  export function Dashboard() { ... }
  ```
- **Frontend API**: Namespace objects grouping related endpoints
  ```ts
  export const expensesApi = { getByPeriod, create, update, delete: remove };
  ```

## Import Conventions

- Backend uses `.js` extensions in imports (ESM with TypeScript): `import { expenseService } from './services/expense.service.js'`
- Frontend uses `@/` path alias: `import { useAuthStore } from '@/stores/authStore'`
- Both import shared types/schemas via: `import { ... } from '@budget/shared'`

## Validation Flow (Backend)

1. Route handler receives request
2. Parse input with Zod schema from `@budget/shared`: `createExpenseSchema.parse(request.body)`
3. ZodError is caught by centralized `errorHandler` → 400 VALIDATION_ERROR
4. On success, call service method with parsed data
5. Service returns DTO, route wraps in `{ success: true, data }`

## Response Shape

Every endpoint returns:
```ts
// Success
{ success: true, data: T }

// Paginated success (expenses only)
{ success: true, data: { items: T[], total, page, pageSize, totalPages } }

// Error (via errorHandler)
{ success: false, error: { code: string, message: string, details?: unknown } }
```

## User-Scoped Data

- Every Prisma query MUST filter by `userId` from `request.authUser!.id`
- Never expose data across users
- MonthPeriod is the primary user-scoping join: `where: { monthPeriod: { userId } }`
- CashFlowCheck and FixedExpenseTemplate have direct `userId` foreign key

## Shared Types (packages/shared)

- All DTOs used by both frontend and backend live in `packages/shared/src/types.ts`
- All Zod validation schemas live in `packages/shared/src/schemas.ts`
- All constants (categories, defaults, thresholds) live in `packages/shared/src/constants.ts`
- **Never** duplicate a DTO type locally in frontend or backend — import from `@budget/shared`
- If a type is only used by one package, keep it there (e.g., Prisma model types stay backend-only)

## Error Handling

- Backend: throw `AppError(message, statusCode, code)` for business errors — centralized handler converts to API response
- Backend: let Zod and Prisma errors propagate — centralized handler handles them
- Frontend: `fetchApi` throws `ApiError` on non-success — TanStack Query catches it — components access `error.message`
- Frontend: 401 responses trigger automatic logout via `useAuthStore.getState().logout()`

## Styling (Frontend)

- Tailwind CSS utility-first approach
- Custom component classes defined in `apps/frontend/src/index.css` using `@layer components`:
  - `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`
  - `.input`, `.label`, `.card`
- Category colors: NEEDS=emerald, WANTS=amber, SAVINGS=sky — use `getCategoryColor()` from `@/lib/utils`
- Responsive: mobile-first breakpoints (`sm:`, `md:`, `lg:`)
- Utility combo: `cn()` from `@/lib/utils` (clsx + tailwind-merge)

## Language

- All user-facing text in the UI: **Italian**
- All code, types, comments, variable names: **English**
- Date formatting: `date-fns` with Italian locale (`it`)
- Number formatting: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`

## Naming Patterns

- Query hooks: `use{Resource}(params)` (e.g., `useDashboard(periodKey)`)
- Mutation hooks: `use{Action}{Resource}(params)` (e.g., `useCreateExpense(periodKey)`)
- API functions: verb + noun (e.g., `getSummary`, `create`, `update`, `remove`)
- Route prefixes: `/api/{plural-resource}` (e.g., `/api/expenses`, `/api/periods`)
- Service methods: verb + context (e.g., `getByPeriodKey`, `getTotalsByCategory`)

## What NOT to Do

- Do not add raw SQL queries — use Prisma client exclusively
- Do not create new Zustand stores for server data — use TanStack Query
- Do not hardcode category strings — import `CATEGORIES` from `@budget/shared`
- Do not add new named columns to CashFlowCheck — use the dynamic `valuesJson` approach
- Do not skip Zod validation in route handlers
- Do not return raw Prisma models — always map to DTOs
