# Frontend Map

**Package**: `apps/frontend/` (`@budget/frontend`)
**Stack**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + Zustand

## Directory Structure

```
apps/frontend/src/
├── pages/           → Page-level components (one per route)
├── components/      → Reusable UI components
├── hooks/           → Custom React hooks (query/mutation wrappers, period state)
├── lib/             → Utilities: api.ts (fetch layer), utils.ts (cn, formatters)
├── stores/          → Zustand stores (auth)
├── App.tsx          → Route definitions
├── main.tsx         → Entry point (QueryClient, BrowserRouter)
└── index.css        → Tailwind directives + custom component classes
```

## Route Table

| Path | Component | Access | Purpose |
|------|-----------|--------|---------|
| `/login` | Login | Public | Google OAuth entry |
| `/auth/callback` | AuthCallback | Public | OAuth redirect handler |
| `/` | → redirect `/dashboard` | Protected | — |
| `/dashboard` | Dashboard | Protected | Monthly budget summary |
| `/expenses` | Expenses | Protected | Paginated expense list |
| `/cash-flow` | CashFlow | Protected | Net worth tracking |
| `/portfolio` | Portfolio | Protected | Investment analysis |
| `/settings` | Settings | Protected | Budget rules, templates |

Protected routes are wrapped in `ProtectedRoute` → `Layout` → `Outlet`.

## Page Inventory

| Page | Primary Data | Key Mutations | Key Components Used |
|------|-------------|---------------|---------------------|
| **Dashboard** | `useDashboard`, `useReallocations`, `useReallocationPreview` | Create reallocation, close/reopen month | BudgetChart, CategoryCard, QuickAddModal, RecentExpenses, IncomePopover, ReallocationCard |
| **Expenses** | `useExpenses` (paginated) | Create, update, delete expense | Filters (category, search), pagination controls |
| **CashFlow** | `useCashFlowChecks`, `useCashFlowColumns`, `useCashFlowClassifications`, `useCashFlowSettings` | CRUD checks/columns/classifications, swap columns | Recharts (LineChart, BarChart, PieChart), dynamic column/classification editors |
| **Portfolio** | `usePortfolioHistory` | — (local state for positions) | Recharts LineChart, instrument input forms |
| **Settings** | `useDashboard` (for budget rule), `useIncomes`, `useFixedExpenseTemplates` | Update budget rule, CRUD incomes, CRUD templates, apply templates | Budget % sliders, income list, FixedExpensesModal |
| **Login** | — | — | Google login button |
| **AuthCallback** | — | `setAuth` (Zustand) | Token extraction, /auth/me verification |

## Reusable Components

| Component | File | Purpose |
|-----------|------|---------|
| Layout | `components/Layout.tsx` | App shell: sidebar nav, header, mobile bottom tab, FAB (QuickAddModal trigger), Outlet |
| ProtectedRoute | `components/ProtectedRoute.tsx` | Auth guard: checkAuth on mount, spinner, redirect |
| BudgetChart | `components/BudgetChart.tsx` | Recharts PieChart + bar chart for budget allocation |
| CategoryCard | `components/CategoryCard.tsx` | Budget progress card per category (amount, %, status) |
| QuickAddModal | `components/QuickAddModal.tsx` | Add expense form (modal) |
| RecentExpenses | `components/RecentExpenses.tsx` | Expense list with delete |
| IncomePopover | `components/IncomePopover.tsx` | Inline income editor |
| ReallocationCard | `components/ReallocationCard.tsx` | Reallocation record display |
| FixedExpensesModal | `components/FixedExpensesModal.tsx` | Template management modal |

## Hooks

| Hook | File | Purpose |
|------|------|---------|
| 45+ query/mutation hooks | `hooks/useQueries.ts` | TanStack Query wrappers for all API endpoints |
| `usePeriodStore` | `hooks/usePeriod.ts` | Zustand store for selected month (persisted in localStorage "budget-period") |

## API Layer

- **File**: `lib/api.ts`
- **Core**: `fetchApi<T>(endpoint, options)` — generic fetch with Bearer token injection, 401 auto-logout
- **Namespaces**: `dashboardApi`, `periodsApi`, `budgetRulesApi`, `incomesApi`, `expensesApi`, `reallocationsApi`, `cashFlowApi`, `fixedExpensesApi`, `portfolioApi`
- **Base URL**: `VITE_API_URL || ''` (empty in dev → Vite proxy handles it)

## Related Docs

- State patterns → [state-management.md](state-management.md)
- Route details → [routing-navigation.md](routing-navigation.md)
- UI conventions → [ui-patterns.md](ui-patterns.md)
