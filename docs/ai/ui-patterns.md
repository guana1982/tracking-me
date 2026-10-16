# UI Patterns

## Styling System

- **Framework**: Tailwind CSS 3.4, mobile-first responsive
- **Custom classes**: defined in `apps/frontend/src/index.css` via `@layer components`
  - Buttons: `.btn`, `.btn-primary` (slate-900), `.btn-secondary` (white/border), `.btn-danger` (red-500), `.btn-success` (emerald-500)
  - Form: `.input`, `.label`
  - Layout: `.card`
- **Utility combo**: `cn()` from `apps/frontend/src/lib/utils.ts` (clsx + tailwind-merge)
- **Font**: Inter (imported via Google Fonts in index.html)
- **Color palette**: slate for neutrals, category colors for domain (see below)

## Category Color Scheme

| Category | Tailwind Color | Usage |
|----------|---------------|-------|
| NEEDS | emerald (green) | bg-emerald-*, text-emerald-*, border-emerald-* |
| WANTS | amber (orange) | bg-amber-*, text-amber-*, border-amber-* |
| SAVINGS | sky (blue) | bg-sky-*, text-sky-*, border-sky-* |

Accessed via `getCategoryColor()` in `apps/frontend/src/lib/utils.ts`.

## Responsive Layout

- **Desktop**: Left sidebar (w-60) with nav links + user section. Content area with `sm:ml-60`.
- **Mobile**: Sidebar hidden. Bottom tab bar for navigation. Hamburger or simplified header.
- **Breakpoints**: `sm:` (640px) is the primary layout shift. `md:` for grid columns. `lg:` for wider layouts.
- **Grid**: `grid-cols-1 md:grid-cols-3` for category columns on Dashboard.

## Charts (Recharts)

| Chart Type | Component | Used In |
|-----------|-----------|---------|
| PieChart / donut | `<BudgetChart>` | Dashboard — budget allocation |
| LineChart | inline | CashFlow — net worth trend over time |
| BarChart | inline | CashFlow — category breakdown bars |
| LineChart | inline | Portfolio — historical price comparison |

Charts use Recharts library. Category colors are applied as line/area/bar fill colors.

## Icon Library

- **Library**: `lucide-react`
- **Common icons**: `Loader2` (spinner with `animate-spin`), `AlertCircle` (errors), `Plus` (add), `Trash2` (delete), `ChevronDown`, `X` (close)

## Locale & Formatting

- **Dates**: `date-fns` with Italian locale (`import { it } from 'date-fns/locale'`)
- **Currency**: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`
- **Period display**: `format(date, 'MMMM yyyy', { locale: it })` → "marzo 2026"
- **Numbers**: tabular-nums font feature for aligned columns

## Archetype: Dashboard Data Page

**Goal**: Show monthly budget summary with charts and category cards.
**Files**: `pages/Dashboard.tsx`, `components/BudgetChart.tsx`, `components/CategoryCard.tsx`
**Pattern**:
- Fetch summary via `useDashboard(periodKey)`
- Show loading spinner while `isLoading`
- Render chart + cards from DTO data
- Mutations for reallocation trigger cache invalidation
**Reuse**: Follow this for any new summary/overview page.

## Archetype: CRUD List Page

**Goal**: Paginated, filterable list with create/delete.
**Files**: `pages/Expenses.tsx`
**Pattern**:
- Local state for filters (`useState<ExpenseFilters>`)
- Query with filters: `useExpenses(periodKey, filters)`
- Delete with confirmation dialog
- Pagination controls at bottom
- Create via modal (QuickAddModal)
**Reuse**: Follow this for any new list/table page.

## Archetype: Settings/Config Page

**Goal**: Edit configuration with save.
**Files**: `pages/Settings.tsx`
**Pattern**:
- Load current values from query hooks
- Sync to local state via `useEffect` when data loads
- Track `hasChanges` for save button enable/disable
- Submit via mutation hook
- Section-based layout with cards
**Reuse**: Follow this for any new configuration page.

## Archetype: Modal Form

**Goal**: Create/edit entity via overlay form.
**Files**: `components/QuickAddModal.tsx`, `components/FixedExpensesModal.tsx`
**Pattern**:
- Props: `isOpen`, `onClose`, `periodKey` (+ optional defaults)
- Fixed overlay with backdrop click to close
- Controlled form inputs
- Submit via mutation hook
- Close on success, show error on failure
- Mobile: full-width bottom sheet; Desktop: centered card
**Reuse**: Follow this for any new modal form.

## Archetype: Auth Callback

**Goal**: Handle OAuth redirect, extract token, verify, store, redirect.
**Files**: `pages/AuthCallback.tsx`
**Pattern**:
- Extract params from `useSearchParams`
- Show loading state during verification
- On error: Italian error message + link to /login
- On success: `setAuth()` + `navigate('/dashboard', { replace: true })`
- Single `useEffect` runs once on mount
**Do not modify** without reviewing [known-pitfalls.md](known-pitfalls.md).
