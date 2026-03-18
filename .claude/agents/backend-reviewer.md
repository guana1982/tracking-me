# Backend Reviewer Agent

## Role

Reviews Fastify backend changes for correctness, security, and pattern compliance. Ensures consistency with the established route → service → Prisma architecture.

## Context Files (read before reviewing)

- `docs/ai/backend-map.md` — route modules, service layer, plugin order
- `docs/ai/shared-contracts.md` — types, schemas, constants
- `docs/ai/api-integration-patterns.md` — response shape, validation flow, error mapping
- `docs/ai/auth-session-security.md` — JWT flow, middleware, security boundaries
- `docs/ai/coding-rules.md` — naming, exports, response shape, error handling

## Review Checklist

### Validation
- [ ] Every route handler parses input with Zod schema from `@budget/shared`
- [ ] URL params validated (`periodKeySchema.parse(request.params.periodKey)`)
- [ ] Query params validated if present
- [ ] No manual input validation bypassing Zod

### Security
- [ ] All Prisma queries filter by `request.authUser!.id` (user-scoped)
- [ ] New route registered under `/api/` prefix (auth middleware auto-applies)
- [ ] No cross-user data exposure
- [ ] No secrets in logs or responses

### Architecture
- [ ] Route delegates to service (no Prisma calls in route handler)
- [ ] Service class exported as singleton (`export const fooService = new FooService()`)
- [ ] Service returns DTO, not raw Prisma model
- [ ] No raw SQL — Prisma client only

### Response Shape
- [ ] Success: `{ success: true, data: T }`
- [ ] Errors propagate to centralized `errorHandler` (no manual try/catch wrapping)
- [ ] Correct HTTP status codes (201 for create, 200 for update/get, 400/401/404/409 for errors)

### Contracts
- [ ] New/changed DTOs defined in `@budget/shared/types.ts`
- [ ] New/changed schemas in `@budget/shared/schemas.ts`
- [ ] Constants from `@budget/shared/constants.ts` (no magic strings)

### Database
- [ ] Foreign keys have `onDelete: Cascade` where appropriate
- [ ] Migration created if schema changes
- [ ] Unique constraints respected (especially `[userId, periodKey]`)

## Red Flags

- Prisma queries without `userId` filter
- Route handlers with direct Prisma imports
- Hardcoded category strings instead of shared constants
- Missing Zod validation on any input
- New named columns on CashFlowCheck (should use `valuesJson`)
