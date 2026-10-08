# Test Strategy

## Current State

- **Backend**: `vitest` is a devDependency. Scripts defined: `pnpm test` (vitest run), `pnpm test:watch` (vitest). **Zero test files exist.**
- **Frontend**: No test framework configured. No test scripts. No test files.
- **Shared**: No test files. Zod schemas are only validated at runtime.
- **CI/CD**: None configured. No automated test gate on commits or PRs.

All quality assurance is currently manual.

## Recommended Test Priority

If/when adding tests, prioritize by impact:

### Priority 1: Backend Service Unit Tests

**Why**: Services contain all business logic and are pure enough to test without HTTP.

**Candidates**:
- `dashboard.service.ts` — category summary calculation, status derivation (ok/warning/danger), reallocation preview
- `reallocation.service.ts` — amount validation, direction enforcement (only NEEDS/WANTS → SAVINGS)
- `expense.service.ts` — tricount amount halving, date parsing, pagination math
- `month-period.service.ts` — period auto-creation, P2002 retry logic
- `budget-rule.service.ts` — percentage sum validation

**Approach**: Mock Prisma client, test service method outputs.

### Priority 2: Backend Route Integration Tests

**Why**: Validates Zod parsing + error handler + response shape end-to-end.

**Approach**: Use Fastify's `inject()` for in-process HTTP testing.

**Candidates**:
- Validation rejection (malformed body → 400 VALIDATION_ERROR)
- Auth rejection (missing token → 401)
- Response shape compliance (all endpoints return `{ success, data }`)

### Priority 3: Shared Schema Tests

**Why**: Schemas are the API contract. Regressions here break both FE and BE.

**Candidates**:
- `periodKeySchema` — valid/invalid formats
- `updateBudgetRuleSchema` — percentage sum refinement
- `createExpenseSchema` — amount precision, category enum, date formats
- `cashFlowValueMapSchema` — key pattern, value precision

### Priority 4: Frontend Hook Tests

**Why**: Mutation hooks drive cache invalidation — incorrect keys = stale UI.

**Approach**: Mock API layer, verify query key usage and invalidation targets.

## Test File Convention

- Co-locate with source: `expense.service.test.ts` next to `expense.service.ts`
- Or use `__tests__/` directory within each module
- Use `*.test.ts` suffix (vitest default pattern)

## Manual Smoke Test Areas

Always check these manually after significant changes:

1. **Login flow**: /login → Google OAuth → /auth/callback → /dashboard (first attempt success)
2. **Dashboard**: summary loads, category cards show correct %, pie chart renders
3. **Expense CRUD**: create expense → appears in list → delete → removed → dashboard updates
4. **Period navigation**: switch months → data changes → switch back → data correct
5. **Settings**: change budget rule % → save → dashboard reflects new allocation
6. **CashFlow**: add check → chart updates → columns visible
7. **Portfolio**: add symbols → chart loads (if quota allows)
8. **Mobile**: check all pages at < 640px width
