# State Management

## Three-Layer Strategy

| Layer | Library | Responsibility | Persistence |
|-------|---------|---------------|-------------|
| Auth + Period | Zustand | Client-side persistent state | localStorage |
| Server data | TanStack Query | All API data (cache, refetch, mutations) | In-memory (query cache) |
| UI state | React useState | Forms, modals, filters, toggles | None (component lifecycle) |

## Zustand Stores

### Auth Store

**File**: `apps/frontend/src/stores/authStore.ts`
**localStorage key**: `"auth-storage"`

```ts
interface AuthState {
  user: AuthUser | null;       // { id, email, name, picture }
  token: string | null;        // JWT token
  isLoading: boolean;
  isAuthenticated: boolean;    // derived from token presence
  setAuth(user, token): void;
  logout(): void;
  checkAuth(): Promise<void>;  // verifies token via GET /auth/me
}
```

- Only `token` and `user` are persisted (via Zustand `persist` + `partialize`)
- `checkAuth()` calls `/auth/me` — on 401 triggers logout, on network error keeps session alive (defensive)
- `logout()` clears store + fires `POST /auth/logout` (fire-and-forget)
- Token is read by `fetchApi` via `useAuthStore.getState().token` (non-reactive, at request time)

### Period Store

**File**: `apps/frontend/src/hooks/usePeriod.ts`
**localStorage key**: `"budget-period"`

```ts
interface PeriodState {
  periodKey: string;                    // YYYY-MM format
  setPeriodKey(key: string): void;
}
```

- Default: current month via `getCurrentPeriodKey()`
- Used by all data-fetching hooks as primary cache dimension

## TanStack Query

### Configuration

**File**: `apps/frontend/src/main.tsx`

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,  // 1 minute
      retry: 1,
    },
  },
});
```

Exception: Portfolio history uses `staleTime: 1000 * 60 * 60` (1 hour) due to provider quota.

### Query Key Factory

**File**: `apps/frontend/src/hooks/useQueries.ts`

```ts
const queryKeys = {
  dashboard: (periodKey: string) => ['dashboard', periodKey],
  expenses: (periodKey: string, filters?: ExpenseFilters) => ['expenses', periodKey, filters],
  incomes: (periodKey: string) => ['incomes', periodKey],
  budgetRule: (periodKey: string) => ['budgetRule', periodKey],
  reallocations: (periodKey: string) => ['reallocations', periodKey],
  reallocationPreview: (periodKey: string) => ['reallocationPreview', periodKey],
  periods: () => ['periods'],
  period: (periodKey: string) => ['period', periodKey],
  savingsHistory: (periodKey: string) => ['savingsHistory', periodKey],
  cashFlowChecks: () => ['cashFlowChecks'],
  cashFlowColumns: () => ['cashFlowColumns'],
  cashFlowSettings: () => ['cashFlowSettings'],
  cashFlowClassifications: () => ['cashFlowClassifications'],
  fixedExpenseTemplates: (category?: string) => ['fixedExpenseTemplates', category],
  portfolioHistory: (signature: string, horizon: string) => ['portfolioHistory', signature, horizon],
};
```

**periodKey** is the primary cache dimension for budget data. CashFlow and Portfolio keys are user-global (not period-scoped).

### Mutation → Invalidation Pattern

Every mutation hook follows:
```ts
useMutation({
  mutationFn: (data) => api.create(periodKey, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses(periodKey) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
  },
});
```

**Key rule**: mutations invalidate the parent list AND related summaries (e.g., expense changes invalidate dashboard).

## Local useState Patterns

- **Form inputs**: Settings page budget % sliders, expense form fields
- **Modal open/close**: `useState<boolean>` for QuickAddModal, FixedExpensesModal
- **Filters**: Expenses page category/search/pagination state
- **Computed values**: `useMemo` for totals, weight calculations (Portfolio page)

## Anti-Patterns to Avoid

- Do not create Zustand stores for server data — use TanStack Query
- Do not duplicate query data in local state — read from query cache
- Do not use React Context for data that TanStack Query already manages
- Do not change query key structure without updating all related mutation invalidations
