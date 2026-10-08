# API Integration Patterns

## Frontend Fetch Layer

**File**: `apps/frontend/src/lib/api.ts`

### Core Function

```ts
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T>
```

- Prepends `API_BASE + '/api'` to endpoint (API_BASE is empty in dev → Vite proxy)
- Reads token from `useAuthStore.getState().token` at request time
- Sets `Authorization: Bearer {token}` if token exists
- Sets `Content-Type: application/json` only if body present
- Sets `credentials: 'include'`
- On 401: calls `useAuthStore.getState().logout()`, throws ApiError
- On non-success response: throws `ApiError(error.message, error.code, error.details)`
- On success: unwraps `ApiResponse<T>` and returns `data` directly

### API Namespace Objects

Each domain has a namespace object grouping related endpoints:

```ts
export const expensesApi = {
  getByPeriod: (periodKey, filters?) => fetchApi<PaginatedResponse<ExpenseDTO>>(`/expenses/period/${periodKey}?...`),
  getById: (id) => fetchApi<ExpenseDTO>(`/expenses/${id}`),
  create: (periodKey, data) => fetchApi<ExpenseDTO>(`/expenses/period/${periodKey}`, { method: 'POST', body }),
  update: (id, data) => fetchApi<ExpenseDTO>(`/expenses/${id}`, { method: 'PUT', body }),
  remove: (id) => fetchApi<void>(`/expenses/${id}`, { method: 'DELETE' }),
};
```

**Namespaces**: `dashboardApi`, `periodsApi`, `budgetRulesApi`, `incomesApi`, `expensesApi`, `reallocationsApi`, `cashFlowApi`, `fixedExpensesApi`, `portfolioApi`

### Auth Endpoints (Non-API Prefix)

Auth calls use a separate `fetchAuth` or direct fetch to `/auth/*` (not `/api/*`):
- `GET /auth/me` — called during auth callback and checkAuth
- `POST /auth/logout` — fire-and-forget on logout

## Hook Layer

**File**: `apps/frontend/src/hooks/useQueries.ts`

### Query Hook Pattern

```ts
export function useExpenses(periodKey: string, filters?: ExpenseFilters) {
  return useQuery({
    queryKey: queryKeys.expenses(periodKey, filters),
    queryFn: () => expensesApi.getByPeriod(periodKey, filters),
    enabled: !!periodKey,
  });
}
```

### Mutation Hook Pattern

```ts
export function useCreateExpense(periodKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseDTO) => expensesApi.create(periodKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}
```

### Naming Convention

- Query hooks: `use{Resource}(params)` — e.g., `useDashboard(periodKey)`
- Mutation hooks: `use{Action}{Resource}(params)` — e.g., `useCreateExpense(periodKey)`, `useDeleteIncome(periodKey)`

## Backend Validation & Response

### Route Handler Pattern

```ts
fastify.post('/period/:periodKey', async (request, reply) => {
  const periodKey = periodKeySchema.parse(request.params.periodKey);
  const data = createExpenseSchema.parse(request.body);
  const userId = request.authUser!.id;

  const expense = await expenseService.create(periodKey, userId, data);
  return reply.status(201).send({ success: true, data: expense });
});
```

### Error → Response Mapping

| Error Type | HTTP | Code | Details |
|------------|------|------|---------|
| ZodError | 400 | `VALIDATION_ERROR` | `[{ path, message }]` |
| Prisma P2002 | 409 | `DUPLICATE_ENTRY` | — |
| Prisma P2025 | 404 | `NOT_FOUND` | — |
| AppError | varies | `error.code` | — |
| Unknown | 500 | `INTERNAL_SERVER_ERROR` | — |

## Full-Stack Data Flow

```
Page component
  → calls useCreateExpense(periodKey).mutateAsync(data)
  → hook calls expensesApi.create(periodKey, data)
  → fetchApi sends POST /api/expenses/period/2026-03 with Bearer token + JSON body
  → Vite proxy (dev) forwards to localhost:3001
  → Fastify auth middleware verifies JWT → sets request.authUser
  → expense.routes.ts parses body with Zod → calls expenseService.create()
  → expenseService creates Prisma record, returns ExpenseDTO
  → Route wraps in { success: true, data }
  → fetchApi unwraps, returns ExpenseDTO
  → mutation onSuccess invalidates ['expenses', '2026-03'] + ['dashboard', '2026-03']
  → TanStack Query refetches affected queries
  → UI re-renders with new data
```

## Pagination

Only expenses support pagination:
- Frontend sends: `?page=1&pageSize=20&category=NEEDS&search=...`
- Backend returns: `{ items: ExpenseDTO[], total, page, pageSize, totalPages }`
- Frontend type: `PaginatedResponse<ExpenseDTO>` from `@budget/shared`
