# React Feature Implementation

## Description

Implement features conservatively in this React/Fastify monorepo. Follow the established patterns, reuse existing infrastructure, and minimize new abstractions.

## When to Use

- Adding a new page, component, or feature
- Adding a new backend endpoint with frontend integration
- Extending an existing feature with new functionality

## Steps

### 1. Map Impact (do not code yet)
- Read `docs/ai/frontend-map.md` and `docs/ai/backend-map.md`
- Identify all files that will be affected
- Determine if shared types/schemas need updating
- Check if a new backend endpoint is needed

### 2. Find Similar Implementation
- Check existing pages for the closest archetype (see `docs/ai/ui-patterns.md`):
  - Summary page → follow Dashboard pattern
  - CRUD list → follow Expenses pattern
  - Config page → follow Settings pattern
  - Modal form → follow QuickAddModal pattern
- Check existing routes/services for backend pattern
- Reuse as much as possible

### 3. Implementation Order
Follow this sequence to avoid type errors and incomplete integrations:

1. **Shared contracts** (`packages/shared/src/`):
   - Add/update types in `types.ts`
   - Add/update Zod schemas in `schemas.ts`
   - Add constants if needed in `constants.ts`
   - Rebuild: `pnpm --filter @budget/shared build`

2. **Backend service** (`apps/backend/src/services/`):
   - Create/update service class with business logic
   - All Prisma queries scoped by userId
   - Return DTOs, not raw Prisma models

3. **Backend route** (`apps/backend/src/routes/`):
   - Register in `index.ts` with `/api/` prefix
   - Validate all input with Zod schemas
   - Delegate to service, wrap response in `{ success: true, data }`

4. **Frontend API** (`apps/frontend/src/lib/api.ts`):
   - Add function(s) to appropriate namespace object
   - Use `fetchApi<T>()` with correct DTO type

5. **Frontend hook** (`apps/frontend/src/hooks/useQueries.ts`):
   - Add query key to `queryKeys` factory
   - Add query hook: `use{Resource}(params)`
   - Add mutation hook(s): `use{Action}{Resource}(params)` with `onSuccess` invalidation

6. **Frontend UI** (`apps/frontend/src/pages/` or `components/`):
   - Build page/component using hooks
   - Handle loading, empty, and error states
   - Italian labels
   - Mobile-responsive with Tailwind

### 4. Self-Review
Before considering done, check against `docs/ai/definition-of-done.md`:
- [ ] Shared types/schemas updated and rebuilt
- [ ] Backend validates all input, scopes by user, returns correct shape
- [ ] Frontend uses hooks (not direct API calls), handles all states
- [ ] Cache invalidation correct
- [ ] Italian labels, mobile-responsive
- [ ] No duplicate types, no hardcoded strings
- [ ] Check `docs/ai/known-pitfalls.md` for relevant risks

### 5. Verify
- `pnpm build` succeeds
- `pnpm lint` passes
- Manual smoke test of the affected pages
