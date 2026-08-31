# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and
you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least
one entry must be a decision you later reversed — say what changed your mind. It can be any entry
below, not necessarily the last one; add a **Later reversed:** line to whichever one it is.

## Decision 1: Prisma CLI Version (Phase 1)

- **Chose:** Downgrade to Prisma v5.11.0 (both CLI and Client).
- **Rejected:** Prisma v8 Platform CLI and Prisma v7 ORM CLI.
- **Why:** npm installed Prisma v8 (the new Prisma Platform CLI) while the client was v7, causing compatibility errors (`validate` command wasn't found). Furthermore, v7 introduced breaking changes to `schema.prisma` removing `datasource url` support in favor of `prisma.config.ts`. To stick to a proven, single-file schema configuration that matches standard paradigms, v5 was explicitly chosen.

## Decision 2: Report Totals (Phase 1)

- **Chose:** Calculate the total dynamically via `SUM(amount)` from `ExpenseLine`.
- **Rejected:** Storing a `total` decimal column directly on `ExpenseReport`.
- **Why:** The instructions explicitly forbid trusting the frontend for totals. If `total` is a column on the report, every line update requires a transaction to update the report total. This risks desync bugs. Computing it via Prisma/SQL guarantees the single source of truth is the lines themselves.

## Decision 3: Profile Linking (Phase 2)
- **Chose:** "On-the-fly" profile creation in Express `requireAuth` middleware.
- **Rejected:** Creating users via Supabase Database Triggers (`auth.users` -> `public.users`).
- **Why:** While Postgres triggers are "cleaner" for automatic row creation, they hide application logic in the database layer. By explicitly doing `prisma.user.upsert`/`create` inside the Express middleware when a valid token is seen for the first time, the profile creation logic (and default role assignment) stays inside the version-controlled Node.js application where developers expect to find it.

## Decision 4: Authorization Enforcement (Phase 2)
- **Chose:** Modular middleware (`requireRole` and `requireResourceOwnership`).
- **Rejected:** Checking roles and ownership manually inside every route handler.
- **Why:** The instructions stress that we must never trust the frontend for roles or ownership. If these checks are manual in every endpoint, one developer forgetting to add the check introduces a critical vulnerability. Middleware makes authorization declarative and difficult to skip.
