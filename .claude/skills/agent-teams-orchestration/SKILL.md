---
name: agent-teams-orchestration
description: Coordinate the project2026 6-agent team. Use ONLY when the user explicitly asks for an "agent team", "team end-to-end", "parallel team", or invokes /agent-teams-orchestration. Spawns the right teammates per task type using a routing matrix, manages plan-approval, and gates completion on qa-verifier PASS.
---

# Agent Teams Orchestration — project2026

## When to Use

**Trigger only on explicit user request.** Examples:
- "Usa il team end-to-end per…"
- "Avvia il team agenti per…"
- "Lavora con gli agenti in team su…"
- User invokes `/agent-teams-orchestration`

If the user asks for a feature without mentioning team/agents, do not spawn a team — handle inline or use single subagents. The user wants explicit control over when to pay the agent-team token cost.

## Pre-flight (do this every time before spawning)

1. **Verify env flag**: Read `.claude/settings.json`. Confirm `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1"`. If missing, tell the user to add it (or update settings.json yourself only if the user confirms).
2. **Verify Claude Code version**: Run `claude --version`. Agent teams require **v2.1.32 or later**. If older, tell the user to upgrade and stop.
3. **Verify no team is already running**: A lead can only manage one team at a time. If one exists, ask the user whether to clean it up first.
4. **Confirm scope**: Restate the task in one sentence and the team composition you intend to spawn (using the routing matrix). The user will redirect if needed.

## The Six Teammates

Spawn each by **explicit short name** so the user can message them by that name. Pass the agent type (subagent definition) so the teammate inherits the role.

| Short name (use exactly) | Agent type                     | Owns                                    |
|--------------------------|--------------------------------|-----------------------------------------|
| `shared`                 | `shared-contracts-architect`   | `packages/shared/` — DTO, Zod, constants|
| `backend`                | `backend-architect`            | `apps/backend/` — routes, services, Prisma |
| `frontend`               | `frontend-architect`           | `apps/frontend/` — pages, hooks, API namespaces |
| `test`                   | `test-impact-analyst`          | vitest tests + impact analysis          |
| `qa`                     | `qa-verifier`                  | build/lint/DoD/smoke gate               |
| `devops`                 | `devops-deploy`                | Dockerfiles, env, Railway, migrations   |

Default model for all teammates: `sonnet`. Use `opus` only if the user explicitly asks for it.

## Routing Matrix — who to spawn per task type

| Task                          | Spawn order                                                |
|-------------------------------|-----------------------------------------------------------|
| Full-stack feature            | `shared` → (`backend` ∥ `frontend`) → `test` → `qa`        |
| Frontend-only bugfix          | `frontend` → `qa`                                          |
| Backend-only bugfix           | `backend` → `test` → `qa`                                  |
| Cross-package refactor        | `shared` → (`backend` ∥ `frontend`) → `test` → `qa` → `devops` |
| New API endpoint              | `shared` → `backend` → `test` → `qa`                       |
| Prisma schema change          | `shared` → `backend` → `devops` → `qa`                     |
| Auth/security touch           | `backend` (plan-approval ON) → `test` → `qa`               |
| Audit / PR review             | `backend` ∥ `frontend` (parallel, plan-approval ON)        |
| Infra / Dockerfile / env      | `devops` → `qa`                                            |
| Add tests only                | `test` → `qa`                                              |

`∥` = parallel (independent files). `→` = sequential dependency.

**Never spawn a teammate that has nothing to do.** Skip roles whose package isn't touched.

## Spawn Protocol

For each teammate you spawn, the spawn prompt must include:

1. **Short name**: tell the lead the name to call them (e.g. "name them `backend`")
2. **Scope**: which files/packages are theirs in this task
3. **Inputs they depend on**: e.g. "wait for `shared` to publish DTO `XyzDTO`"
4. **Deliverables**: what the task list entry asks them to produce
5. **Plan approval flag**: ON for auth, Prisma schema, Dockerfile, CORS, secrets; OFF otherwise
6. **Permission hint**: lead's permissions inherit; pre-approve common Bash commands in settings.json (already done for `pnpm lint/test/build`, `pnpm db:*`, `git diff/status/log`)

Example spawn instruction (you give this to yourself as Lead):

> Spawn a teammate named `backend` using the `backend-architect` agent type with prompt: "Implement `GET/POST/DELETE /api/expense-tags` in `apps/backend/`. Wait for `shared` to publish `ExpenseTagDTO` and `createExpenseTagSchema`. Coordinate Prisma migration with `devops`. Self-review with the Review Checklist before marking task complete."

## Quality Gates (the Lead enforces these)

1. **No file overlap**: assign tasks by package, never let two teammates edit the same file. If overlap is unavoidable, sequence them.
2. **Wait for dependencies**: don't let `backend` start before `shared` publishes the DTO. Use task dependencies in the shared task list.
3. **No work-stealing by Lead**: while teammates run, the Lead synthesizes and coordinates only. If tempted to implement, stop and assign to the right teammate. (`Wait for your teammates to complete their tasks before proceeding`)
4. **`qa` is mandatory before completion**: every team task ends with a `qa-verifier` PASS. PARTIAL PASS requires explicit user acknowledgement of the manual smoke gap.
5. **Idle notifications**: when a teammate goes idle, check that they marked their task completed. If not, message them to update the task list — stuck tasks block dependent ones.

## Plan Approval

Turn ON for any spawn whose work touches:
- Authentication / `auth.middleware.ts` / OAuth flow
- Prisma schema (`apps/backend/prisma/schema.prisma`) or migrations
- `Dockerfile.*`, `docker-compose.yml`, `.env.example`
- CORS allowed origins
- Anything involving secrets

Approval criteria when reviewing teammate plans:
- Reject plans that store secrets in code or logs
- Reject plans that introduce destructive migrations on populated tables without a backfill strategy
- Reject Prisma queries without a `userId` filter
- Approve plans only if they reference the relevant `docs/ai/` files

## Cleanup

When the task is done and `qa` reports PASS:

1. Confirm all teammates' tasks are marked completed
2. Ask each teammate to shut down (graceful)
3. Run `Clean up the team`
4. Confirm to the user: "Team chiuso. Riepilogo: …"

Never leave a team running idle after the task is closed.

## Common Pitfalls (project2026-specific)

- **Stale `@budget/shared/dist`**: if `shared` updated but didn't rebuild, `backend`/`frontend` see old types. Confirm `shared` ran `pnpm --filter @budget/shared build` before signaling done.
- **Query key drift**: when `frontend` adds a new query, ensure related mutations invalidate it. `qa` checks this against `useQueries.ts`.
- **CashFlowCheck columns**: never let `backend` add a new named Prisma column on `CashFlowCheck`. Use `valuesJson`.
- **Period auto-create P2002**: don't refactor `month-period.service.getOrCreate()` away from its retry-on-P2002 pattern. The race is real.
- **Twelve Data quota**: if portfolio is touched, `frontend` must not auto-refetch on short intervals.
- **Italian labels**: every UI string in Italian. `qa` greps for English literals (`'Save'`, `'Cancel'`, `'Loading'`) before PASS.

## Output to User (after team finishes)

When the team completes (clean exit, qa PASS, cleanup done), give the user a 5–8 line summary:

```
✓ Team end-to-end completato: [one-line task description]

Modifiche:
- shared: [files]
- backend: [files]
- frontend: [files]
- test: [files]
- devops: [files, if any]

QA: PASS / PARTIAL PASS (manual smoke required for: [list])

Note: [any deploy reminder, e.g. "set NEW_VAR in Railway"]
```

Then the team is cleaned up. The user is back to a single-session conversation with the Lead.

---

## Lessons Learned

This section grows over time. After every team run, add ONE line capturing what we'd do differently next time. Keep entries terse and dated.

<!-- Format: - YYYY-MM-DD: [what we observed] → [adjustment to apply] -->
<!-- Empty until the first team run. -->
