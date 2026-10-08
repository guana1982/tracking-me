# Full-Stack Code Review

## Description

Review a change as a strict senior reviewer. Check frontend/backend contract fit, state/query/API consistency, auth/security impact, typing, error handling, and regression risk.

## When to Use

- Reviewing a PR or set of changes
- Self-reviewing before merging
- Auditing a feature implementation

## Review Process

### 1. Understand the Change
- Read all modified files
- Identify the intent: new feature, bug fix, refactor, or configuration change
- Map the affected layers: shared, backend, frontend

### 2. Contract Consistency
Reference: `docs/ai/shared-contracts.md`
- [ ] New/changed types are in `@budget/shared/types.ts`, not duplicated locally
- [ ] Zod schemas match the TypeScript types
- [ ] Frontend API function return types match backend response DTOs
- [ ] If schema refinements changed (e.g., percentage sum), both FE and BE handle it

### 3. Backend Review
Reference: `docs/ai/backend-map.md`, `docs/ai/coding-rules.md`
- [ ] Route validates all input with Zod `.parse()`
- [ ] Route delegates to service (no Prisma in route handler)
- [ ] Service queries are user-scoped (`userId` filter)
- [ ] Service returns DTO, not raw Prisma model
- [ ] Response shape: `{ success: true, data }` or error via handler
- [ ] Correct HTTP status codes
- [ ] Service exported as singleton

### 4. Frontend Review
Reference: `docs/ai/frontend-map.md`, `docs/ai/state-management.md`
- [ ] API function in `api.ts` namespace object (not inline fetch)
- [ ] Hook in `useQueries.ts` with correct query key
- [ ] Mutation `onSuccess` invalidates all affected keys
- [ ] Loading/empty/error states handled in UI
- [ ] No server data in Zustand (use TanStack Query)
- [ ] Italian labels, no English user-facing text
- [ ] Mobile-responsive (Tailwind mobile-first)

### 5. Auth & Security
Reference: `docs/ai/auth-session-security.md`
- [ ] New endpoints under `/api/` (auto-protected by middleware)
- [ ] User scoping enforced in service layer
- [ ] No secrets in code, logs, or responses
- [ ] Token handling unchanged or improved

### 6. Regression Risk
Reference: `docs/ai/known-pitfalls.md`
- [ ] Auth callback flow not impacted
- [ ] Query key factory consistent (no orphaned invalidations)
- [ ] CashFlow hybrid storage not broken
- [ ] Period auto-create behavior preserved
- [ ] Shared package rebuilt after changes

## Output Format

```
## Code Review: [change description]

### Approval: APPROVE / REQUEST CHANGES / NEEDS DISCUSSION

### Findings
#### Critical (must fix)
- [list]

#### Important (should fix)
- [list]

#### Suggestions (nice to have)
- [list]

### Regression Risk: LOW / MEDIUM / HIGH
[explanation]
```
