You are working inside an existing pnpm monorepo for a SaaS full-stack application.

Your goal is NOT to implement product features now.
Your goal is to create a lightweight, high-signal documentation structure that will later be used by Claude Code as persistent operational context for safe and consistent implementation work.

IMPORTANT WORKING MODE:
- First study the repository.
- Then create the markdown structure and fill it with concise, evidence-based content.
- Do not invent architecture that is not present in the codebase.
- Reuse only patterns that are clearly dominant in the repository.
- Keep docs dense, practical, and short-to-medium length.
- Prefer bullet points over long prose.
- Do not refactor application code unless strictly necessary for documentation generation.
- If a file already exists, update it carefully instead of duplicating concepts elsewhere.
- Do not add theoretical best practices unless they are clearly relevant to this repository.
- Base every statement on the actual codebase.
- Do not write generic React advice; write repository-specific operating guidance.

PROJECT CONTEXT TO USE:
This repository is a pnpm monorepo with:
- apps/frontend: React 18 + TypeScript + Vite + Tailwind CSS
- apps/backend: Fastify + TypeScript + Prisma + PostgreSQL
- packages/shared: shared Zod schemas, shared TS types, constants

Key current architectural characteristics:
- Frontend pages-based structure
- Zustand for auth/client state
- TanStack Query for server state
- Centralized typed API layer
- Fastify plugin/service architecture
- Prisma data access
- Google OAuth2 + JWT auth flow
- Shared DTOs/schemas in packages/shared
- Italian-language UI
- Docker-based local PostgreSQL
- The repo already contains a CLAUDE.md that should be kept aligned and improved if needed, not replaced blindly

YOUR TASK:
Create and/or update the following documentation structure.

TARGET STRUCTURE:

.claude/
  settings.json
  agents/
    frontend-architect.md
    backend-reviewer.md
    test-impact-analyst.md
  skills/
    codebase-onboarding/
      SKILL.md
    react-feature-implementation/
      SKILL.md
    fullstack-cr-review/
      SKILL.md
    regression-check/
      SKILL.md
docs/
  ai/
    architecture-overview.md
    frontend-map.md
    backend-map.md
    shared-contracts.md
    routing-navigation.md
    state-management.md
    api-integration-patterns.md
    ui-patterns.md
    auth-session-security.md
    coding-rules.md
    definition-of-done.md
    test-strategy.md
    known-pitfalls.md
    glossary.md
CLAUDE.md

SPECIFIC INSTRUCTIONS PER FILE:

1) CLAUDE.md
- Keep it compact and high value.
- It must tell Claude Code how to work in this repo.
- It must be operational, not descriptive.
- Include:
  - mission
  - working mode
  - mandatory quality rules
  - what to read before coding
  - expected output format when proposing changes
- Adapt it to THIS React/Fastify monorepo.
- Preserve useful existing project-specific knowledge already present in the current CLAUDE.md.
- Remove duplication and overly narrative sections if needed.
- Keep it focused for future implementation work.

2) docs/ai/architecture-overview.md
Create a concise map of the whole system:
- monorepo structure
- frontend responsibilities
- backend responsibilities
- shared package responsibilities
- auth flow
- database role
- request flow from UI to DB
- deployment/local environment essentials
Only include what is actually supported by code.

3) docs/ai/frontend-map.md
Document the frontend shape:
- main folders and responsibilities
- pages
- reusable UI areas/components if present
- hooks structure
- API client entry points
- query usage pattern
- auth store usage
- route ownership
- current feature/page domains

4) docs/ai/backend-map.md
Document the backend shape:
- route modules
- service layer
- auth modules
- Prisma boundaries
- error handling flow
- validation approach
- response shape conventions
- where business rules live

5) docs/ai/shared-contracts.md
Document the role of packages/shared:
- shared types
- zod schemas
- constants
- contract-sharing rules
- what belongs here vs what should remain frontend-only/backend-only

6) docs/ai/routing-navigation.md
Explain:
- frontend routing structure
- protected vs public routes if present
- auth callback flow
- redirects/navigation ownership
- any route-related caveats or fragile areas

7) docs/ai/state-management.md
Explain the real current state strategy:
- Zustand responsibilities
- TanStack Query responsibilities
- local component state responsibilities
- where not to duplicate state
- query key patterns if discoverable
- mutation/refetch conventions if discoverable

8) docs/ai/api-integration-patterns.md
Describe the dominant API integration pattern:
- typed fetch layer
- auth header propagation
- request/response handling
- error surface
- how frontend hooks wrap API calls
- how backend validates and returns data
- how shared contracts connect FE and BE

9) docs/ai/ui-patterns.md
Find representative feature/UI flows already present in the repo and document them as archetypes.
Try to identify examples such as:
- dashboard data page
- authenticated CRUD/list flow
- settings/configuration page
- login/auth callback flow
- modal/form flow if present
For each archetype include:
- goal
- files involved
- pattern to reuse
- things to avoid

10) docs/ai/auth-session-security.md
Document the real auth/session behavior:
- Google OAuth entry
- callback handling
- JWT generation/consumption
- frontend token persistence
- authenticated API calls
- protected area behavior
- security-sensitive boundaries
- what must not be weakened

11) docs/ai/coding-rules.md
This must be one of the most useful files.
Infer repository-specific coding rules from existing code, including where applicable:
- React component patterns
- hooks conventions
- API usage conventions
- typing rules
- shared DTO usage
- backend route/service separation
- Prisma access boundaries
- error handling conventions
- naming patterns
- Tailwind usage style
- when to keep logic in TS vs JSX
Only include rules that are supported by the codebase or clearly required by current architecture.

12) docs/ai/definition-of-done.md
Create a practical checklist for future CR/feature work in this repo.
Include:
- architecture consistency
- typing/contracts updated
- frontend/backend alignment
- auth impact checked
- error handling checked
- loading/empty/error states checked
- lint/build/test expectations
- regression-sensitive areas reviewed
- docs updated if architecture changed

13) docs/ai/test-strategy.md
Describe the current real testing situation:
- existing test setup
- backend vitest scope
- frontend testing situation if present or absent
- what kinds of tests are most relevant in this repo
- manual smoke areas that should always be checked
Be honest if coverage is limited.

14) docs/ai/known-pitfalls.md
Identify likely regression risks in this codebase, grounded in actual architecture.
Examples to investigate:
- auth callback timing / token propagation
- query cache inconsistencies
- duplicated DTO definitions
- shared contract drift
- API response shape mismatches
- backend validation vs frontend expectations
- Prisma model assumptions
- period/month key logic
- budget category consistency
- portfolio provider quota behavior
- environment/config drift
Write only real risks that matter here.

15) docs/ai/glossary.md
Create a short project glossary for recurring domain terms and technical terms used in this repo.
Examples may include:
- periodKey
- budget rule 65/25/10
- needs / wants / savings
- reallocation
- shared contracts
- auth callback
- provider quota
Use concise definitions.

SUBAGENTS TO CREATE:

Create these files under .claude/agents as concise agent role definitions:

A) frontend-architect.md
Role:
- understand React frontend impact
- map affected pages/hooks/api/state/routing
- prefer existing UI/state/query patterns
- prevent unnecessary abstractions

B) backend-reviewer.md
Role:
- review Fastify service/route changes
- ensure validation/service/error handling consistency
- preserve response contracts and Prisma boundaries

C) test-impact-analyst.md
Role:
- determine regression surface
- identify tests to add
- propose manual smoke checks
- highlight risk hotspots

Keep each agent file short, concrete, and operational.

SKILLS TO CREATE:

Create these SKILL.md files under .claude/skills:

1) codebase-onboarding/SKILL.md
Purpose:
- study a module or area before making changes
- identify entry points, dependencies, patterns, and similar implementations
- do not code immediately

2) react-feature-implementation/SKILL.md
Purpose:
- implement features conservatively in the React/Fastify monorepo
- first map impact
- then find similar implementation
- then propose minimal patch plan
- then implement
- then self-review

3) fullstack-cr-review/SKILL.md
Purpose:
- review a change as a strict senior reviewer
- check frontend/backend contract fit
- state/query/API consistency
- auth/security impact
- typing
- error handling
- regression risk

4) regression-check/SKILL.md
Purpose:
- generate a practical regression checklist before closing a CR
- include frontend, backend, auth, contracts, persistence, and manual smoke tests

Each skill must be structured, reusable, and specific to this repository.
Do not write generic prompts; write concrete operating procedures.

SETTINGS FILE:

Create .claude/settings.json with conservative permissions suitable for local development documentation/review work.
Allow safe read and common non-destructive project commands such as:
- read repository files
- pnpm lint
- pnpm test
- pnpm build
- git diff
- git status
Deny destructive and risky commands such as:
- git push
- git reset --hard
- rm -rf
- reading .env files
- network calls like curl unless clearly necessary

IMPORTANT FILE QUALITY RULES:
- Markdown only
- Clear headings
- Dense bullets
- No filler
- No motivational text
- No generic AI language
- No placeholders like “TBD” unless absolutely unavoidable
- If something is uncertain, explicitly mark it as “verify in code before relying on this”
- Prefer practical examples referencing actual folders/files in the repo

EXECUTION PLAN:
1. Inspect repository structure and current files.
2. Read the existing CLAUDE.md and preserve useful repo-specific content.
3. Infer actual architecture from code.
4. Create/update the target markdown files.
5. Keep terminology consistent across all docs.
6. At the end, provide:
   - list of files created/updated
   - brief summary of what each file now contains
   - any assumptions or weak-confidence areas that should be manually reviewed

CONSTRAINT:
Do not change product behavior or refactor app code unless absolutely required.
Primary deliverable is the markdown/documentation and Claude support structure.