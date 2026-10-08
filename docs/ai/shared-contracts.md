# Shared Contracts

**Package**: `packages/shared/` (`@budget/shared`)
**Build**: `tsup src/index.ts --format cjs,esm --dts` → outputs to `dist/`

## Purpose

Single source of truth for types, validation schemas, and constants shared between frontend and backend. Both packages import via `@budget/shared`.

## File Structure

```
packages/shared/src/
├── index.ts       → Barrel re-export of all modules
├── types.ts       → TypeScript interfaces and type aliases (DTOs)
├── schemas.ts     → Zod validation schemas
└── constants.ts   → Domain constants and defaults
```

## types.ts — DTOs and Interfaces

### Core Domain DTOs
- `MonthPeriodDTO` — period with isClosed, year, month, periodKey
- `BudgetRuleDTO` — needsPct, wantsPct, savingsPct, cutoffDay, autoReallocateNeedsRemainder
- `IncomeDTO` — label, amount
- `ExpenseDTO` — date, category, label, amount, notes, isFixed, tricountType
- `ReallocationDTO` — fromCategory, toCategory, amount, reason
- `FixedExpenseTemplateDTO` — category, label, amount

### Composite DTOs
- `DashboardSummaryDTO` — monthPeriod + budgetRule + totalIncome + categories[] + recentExpenses + reallocationPreview
- `CategorySummaryDTO` — category, budget, spent, remaining, percentage, status
- `ReallocationPreviewDTO` — needsRemainder, wantsRemainder, suggestedAmount, cutoffDay, isAfterCutoff
- `SavingsHistoryDTO` — monthly savings array + cumulative total

### CashFlow DTOs
- `CashFlowCheckDTO` — date, checkLabel, values map, notes
- `CashFlowColumnDTO` — key, label, position, isActive, showInPie
- `CashFlowClassificationDTO` — key, label, columnKeys[], position
- `CashFlowSettingsDTO` — commissionPerEtf, etfCount, columns, classifications

### Portfolio DTOs
- `PortfolioHistoryHorizonDTO` — `'1Y' | '3Y' | '5Y'`
- `PortfolioHistoryResponseDTO` — horizon, generatedAt, series: { symbol, points: { date, close }[] }[]

### Response Wrappers
- `ApiResponse<T>` — `{ success: boolean, data?: T, error?: { code, message, details? } }`
- `PaginatedResponse<T>` — `{ items: T[], total, page, pageSize, totalPages }`
- `ExpenseFilters` — category?, startDate?, endDate?, search?, page?, pageSize?

### Enums (TypeScript)
- `Category` — `'NEEDS' | 'WANTS' | 'SAVINGS'`
- `TricountType` — `'IO' | 'FRA'`
- `FixedExpenseCategory` — `'NEEDS' | 'WANTS'` (subset)

## schemas.ts — Zod Validation

### Key Schemas
- `periodKeySchema` — `z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)`
- `createExpenseSchema` — date, category, label, amount (.positive().multipleOf(0.01)), notes, isFixed, tricountType
- `updateBudgetRuleSchema` — with `.refine()`: if all three percentages provided, must sum to 100
- `cashFlowValueMapSchema` — `z.record(keyPattern, z.number().multipleOf(0.01))`
- `portfolioHistoryQuerySchema` — symbols array (max 20), horizon enum

### Usage Pattern
- **Backend routes**: `schema.parse(request.body)` — throws ZodError on failure
- **Frontend**: types imported for generics; schemas could be used for client-side validation but currently are not

## constants.ts — Domain Constants

```ts
CATEGORIES = ['NEEDS', 'WANTS', 'SAVINGS']
DEFAULT_BUDGET_RULE = { needsPct: 65, wantsPct: 25, savingsPct: 10, cutoffDay: 26, autoReallocateNeedsRemainder: true }
WARNING_THRESHOLDS = { WARNING: 80, DANGER: 100 }  // % of category budget used
CURRENCY = 'EUR'
CURRENCY_SYMBOL = '€'
LOCALE = 'it-IT'
MONTH_FORMAT = 'yyyy-MM'
```

## Rules

| Belongs in `@budget/shared` | Stays package-local |
|-----------------------------|---------------------|
| DTOs used by both FE and BE | Prisma model types (backend only) |
| Zod schemas for API validation | React component props (frontend only) |
| Domain constants (categories, defaults) | UI-specific constants (colors, breakpoints) |
| Enum types | Internal service types |
| Response wrappers | Zustand store shape |

## Build Dependency

- `@budget/shared` must be built before frontend/backend can consume it
- `pnpm dev` runs `pnpm --filter @budget/shared build` first
- After modifying shared source, rebuild with `pnpm --filter @budget/shared build`
