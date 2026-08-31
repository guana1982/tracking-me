# Codebase Onboarding

## Description

Study a module or area of the codebase before making changes. Identify entry points, dependencies, patterns, and similar existing implementations. Do not write code — produce a map.

## When to Use

- Before starting work on an unfamiliar part of the repo
- When asked "how does X work?" about a feature area
- Before implementing a feature in a new domain area

## Steps

### 1. Identify the Target Area
- Determine which package(s) are involved: `apps/frontend`, `apps/backend`, `packages/shared`
- Find the primary files: page, route module, service, hooks

### 2. Read Architecture Context
- Read `docs/ai/architecture-overview.md` for system-level understanding
- Read the relevant map: `docs/ai/frontend-map.md` or `docs/ai/backend-map.md`
- Read `docs/ai/shared-contracts.md` if the area uses shared types/schemas

### 3. Trace the Data Flow
- **Frontend**: Page → hook (useQueries.ts) → API function (api.ts) → endpoint
- **Backend**: Route handler → Zod validation → service method → Prisma query → DTO return
- Document: which files are involved, what data flows between them

### 4. Find Similar Implementations
- Look for existing features that follow the same pattern
- Dashboard is the archetype for summary pages
- Expenses is the archetype for CRUD list pages
- Settings is the archetype for config pages
- QuickAddModal is the archetype for modal forms

### 5. Identify Dependencies
- What shared types/schemas are used?
- What other services does the service depend on?
- What query keys are involved?
- What cache invalidation relationships exist?

### 6. Document Constraints
- Is the area auth-protected?
- Is it period-scoped or user-global?
- Are there known pitfalls? (check `docs/ai/known-pitfalls.md`)
- Are there quota/rate limits? (portfolio area)

## Output Format

```
## Module: [name]

### Entry Points
- [files and their roles]

### Data Flow
- [traced path from UI to DB or vice versa]

### Patterns Used
- [which archetype from ui-patterns.md / backend-map.md]

### Dependencies
- [shared types, other services, hooks]

### Constraints
- [auth, scoping, pitfalls, quotas]

### Similar Implementations
- [existing features to reference]
```
