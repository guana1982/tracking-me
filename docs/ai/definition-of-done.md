# Definition of Done

Practical checklist before closing any feature or change request in this repo.

## New Feature Checklist

- [ ] **Shared contracts**: If the feature involves FE↔BE communication, types and schemas are in `@budget/shared` (not duplicated locally)
- [ ] **Backend route**: Registered in `index.ts` with `/api/` prefix, Zod validation on all inputs, response shape `{ success, data }`
- [ ] **Backend service**: Business logic in service class (not in route), Prisma queries scoped by userId, exported as singleton
- [ ] **Frontend API function**: Added to appropriate namespace in `apps/frontend/src/lib/api.ts`
- [ ] **Frontend hook**: Query or mutation hook added to `apps/frontend/src/hooks/useQueries.ts` with correct query key
- [ ] **Cache invalidation**: Mutation `onSuccess` invalidates all affected query keys (list + related summaries)
- [ ] **Error handling**: Backend uses AppError / lets Zod+Prisma errors propagate. Frontend shows error.message to user
- [ ] **Loading state**: Component shows spinner/skeleton while query `isLoading`
- [ ] **Empty state**: Component handles empty data gracefully (no blank screen)
- [ ] **Error state**: Component shows meaningful message on query error
- [ ] **Italian labels**: All user-facing text is in Italian
- [ ] **Mobile responsive**: Tested at mobile breakpoint (< 640px)
- [ ] **Category consistency**: Uses NEEDS/WANTS/SAVINGS from `@budget/shared` constants, not hardcoded strings

## New Endpoint Checklist

- [ ] Route file follows `kebab-case.routes.ts` naming
- [ ] Registered under `/api/` prefix (auth middleware applies automatically)
- [ ] All input validated with Zod schemas from `@budget/shared`
- [ ] All Prisma queries filter by `request.authUser!.id`
- [ ] Returns `{ success: true, data }` on success
- [ ] Errors propagate to centralized handler (no manual try/catch wrapping response)

## Database Change Checklist

- [ ] Prisma migration created (`pnpm db:migrate`)
- [ ] Prisma client regenerated (`pnpm db:generate`)
- [ ] Shared types updated if DTO shape changed
- [ ] Existing data migration considered (if altering columns)
- [ ] Foreign keys have appropriate `onDelete` behavior (default: Cascade)

## Auth Impact Checklist

- [ ] New endpoints are properly protected (under `/api/` prefix)
- [ ] User-scoping is enforced in service layer
- [ ] No token/credential exposure in logs or responses
- [ ] OAuth callback flow not broken (if touching auth module)

## Pre-Merge Verification

- [ ] `pnpm build` succeeds (both packages)
- [ ] `pnpm lint` passes
- [ ] No TypeScript errors in either package
- [ ] Shared package rebuilt if modified (`pnpm --filter @budget/shared build`)
- [ ] Manual smoke test: login → dashboard → affected pages
- [ ] Regression areas reviewed (see [known-pitfalls.md](known-pitfalls.md))

## Currently NOT Required

- Automated tests (none exist yet — see [test-strategy.md](test-strategy.md))
- CI/CD pipeline checks (none configured)
- Internationalization framework (Italian is hardcoded)
- Accessibility audit (not yet established)
- Performance benchmarks
