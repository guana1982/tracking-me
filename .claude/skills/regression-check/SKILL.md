# Regression Check

## Description

Generate a practical regression checklist before closing a change request. Covers frontend, backend, auth, contracts, persistence, and manual smoke tests. Specific to this repository's architecture and known risks.

## When to Use

- Before merging a feature branch
- After completing a significant change
- When asked "is this safe to ship?"

## Process

### 1. Identify Change Scope
- List all modified/added/deleted files
- Classify: shared contracts, backend routes, backend services, frontend hooks, frontend pages, Prisma schema

### 2. Shared Contract Check
- [ ] If `packages/shared/src/types.ts` changed: verify all frontend imports still match
- [ ] If `packages/shared/src/schemas.ts` changed: verify all backend `.parse()` calls still work
- [ ] If `packages/shared/src/constants.ts` changed: grep for old values in FE and BE
- [ ] Rebuild shared: `pnpm --filter @budget/shared build`
- [ ] Both `pnpm build:frontend` and `pnpm build:backend` succeed

### 3. Backend Regression Check
- [ ] All routes still validate input with Zod
- [ ] All services still scope queries by userId
- [ ] Error handler still catches all error types correctly
- [ ] Response shape unchanged for existing endpoints
- [ ] No new Prisma migrations needed (if schema untouched)
- [ ] If migration added: test on clean DB

### 4. Frontend Regression Check
- [ ] Query keys in `useQueries.ts` are consistent with mutation invalidations
- [ ] No stale data scenarios (mutation succeeds but UI doesn't update)
- [ ] Auth store not affected (token persistence, checkAuth behavior)
- [ ] Period store not affected (month selection, localStorage key)
- [ ] No new TypeScript errors: `pnpm build:frontend`

### 5. Auth Flow Check
Only if auth-related files were touched:
- [ ] Login → Google OAuth → callback → dashboard works on first attempt
- [ ] Token stored in localStorage after callback
- [ ] 401 on expired token triggers logout
- [ ] Protected routes redirect to /login when not authenticated

### 6. Manual Smoke Tests
Select based on change scope:

| Area Changed | Smoke Test |
|-------------|------------|
| Dashboard/expenses | Login → dashboard loads → create expense → appears in list → dashboard updates |
| Settings/budget rules | Settings → change % → save → dashboard reflects change |
| CashFlow | CashFlow → add check → chart updates → columns display |
| Portfolio | Portfolio → add symbols → chart loads (quota permitting) |
| Auth | Fresh login → callback → dashboard → refresh page → still logged in |
| Period logic | Switch month → data changes → switch back → correct |
| Shared types | Full flow: create entity → appears in FE → correct shape |
| Mobile | All affected pages at < 640px width |

### 7. Build Verification
```bash
pnpm --filter @budget/shared build
pnpm build:frontend
pnpm build:backend
pnpm lint
```

## Output Format

```
## Regression Checklist: [change description]

### Scope
- [packages affected]

### Automated Checks
- [ ] pnpm build ✓/✗
- [ ] pnpm lint ✓/✗

### Contract Checks
- [relevant items from section 2]

### Manual Smoke Tests Required
- [ordered list from section 6]

### Risk Assessment: LOW / MEDIUM / HIGH
[rationale]
```
