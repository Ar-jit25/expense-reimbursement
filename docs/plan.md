# Plan

This document records intended work before each phase and actual results after each phase.
It is a sequential historical record, not a summary written at the end.

---

## Phase 1 — Database Architecture

### Intended work (recorded before implementation began)

**Goal**: Establish the PostgreSQL + Prisma relational foundation that supports all 10 required
assignment goals. No application logic is built in this phase — only schema.

**Build order and rationale**:

1. Create `backend/` project directory and initialize npm — needed before Prisma can be installed.
2. Install Prisma and configure `datasource` to point at Supabase PostgreSQL via `.env`.
3. Design and write `prisma/schema.prisma` covering all required domain models:
   User (profile), ExpenseReport, ExpenseLine, ReportApprover (join), ReportHistory,
   Comment, StaleAlert. All enums, foreign keys, indexes, and constraints decided here so
   that later phases do not require destructive schema changes.
4. Run `prisma db push` to create the tables in the hosted database.
5. Verify tables, foreign keys, and constraints are correct.
6. Update docs/schema.md, docs/architecture.md, docs/decisions.md.
7. Update PERSONAL/study.md with comprehensive database fundamentals tied to the implementation.
8. Record actual results and commit.

**Why schema first**: Every API endpoint in every subsequent phase reads or writes to these
tables. Gaps here require migrations later, which is disruptive. It is faster and safer to
design the complete schema once than to add columns repeatedly.

**Estimated time**: 2–3 hours total including documentation.

**What can be deferred if time is short**: Additional indexes can be added via a migration in a
later phase without breaking anything. study.md entries can be expanded incrementally.

**What cannot be deferred**: Every model. Every foreign key. Every enum. A missing model
discovered in Phase 3 means a migration and potentially revisiting schema decisions already
documented.

---

### Actual results (recorded after Phase 1 completed)

**What was built**: 
- Constructed the `schema.prisma` file incorporating seven core tables: `User`, `ExpenseReport`, `ExpenseLine`, `ReportApprover`, `ReportHistory`, `Comment`, and `StaleAlert`.
- Applied migrations (using `prisma migrate dev --name init`) to the Supabase Postgres instance instead of just `db push` to align with professional deployment standards.

**What deviated from intent**:
- **Prisma Versioning Issue**: Attempted to install Prisma but received the newly-released v8 Developer Platform CLI and v7 Client. Prisma v7 has breaking changes to `schema.prisma` configuration (`url` inside `datasource` no longer supported).
- **Fix**: Downgraded to a stable Prisma `v5.11.0` environment to maintain compatibility with a single-file, traditional Prisma configuration strategy. This is documented in `docs/decisions.md`.
- **Database Push**: Rather than `db push` (which overrides database state), utilized `migrate dev` as per the updated execution rules to maintain proper Git-tracked migration histories.

**What was estimated vs actual**: 
- Estimated time: 2-3 hours.
- Actual time spent was considerably less in active development, although diagnosing the Prisma CLI/Client mismatch consumed additional debugging cycles.

---
