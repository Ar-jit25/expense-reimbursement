# Decisions

Log the decisions that actually shaped this codebase - the ones where a real alternative existed and
you picked one. For each: what you chose, what you rejected, and why. At least one entry must be a
decision you later reversed - see the **Later reversed** note on Decision 3.

---

## Decision 1: ORM Choice - Prisma over raw SQL or Knex

- **Chose:** Prisma ORM with a schema-first `schema.prisma` file as the single source of truth for all models, relations, enums, and migrations.
- **Rejected:** Writing raw parameterized SQL via `pg` directly, or using a lightweight query builder like Knex.
- **Why:** Prisma generates a fully-typed client from the schema, meaning a typo in a field name is a compile-time error, not a runtime surprise. Migrations are tracked in Git alongside the schema, so the database state is always reproducible. The one place where Prisma was insufficient - sorting by a derived aggregate `SUM(amount)` across a relation - was handled by a single targeted `$queryRaw` call on an already-vetted list of IDs, keeping raw SQL strictly contained.

---

## Decision 2: Never Store a Derived `total` Column

- **Chose:** Calculating `total` dynamically on every fetch as `report.lines.reduce((sum, line) => sum + Number(line.amount), 0)` in Node, rather than persisting it to the database.
- **Rejected:** Adding a `total` column to `ExpenseReport` and updating it whenever a line is added, edited, or removed.
- **Why:** A stored total is a denormalized value that can silently drift out of sync. If a line is deleted and the update to `total` fails mid-transaction, the stored value lies. By computing on demand, the value is always exactly correct, and the logic is in one place. The performance cost is negligible for expense reports of realistic size.

---

## Decision 3: Profile Auto-Provisioning in Auth Middleware

- **Chose (originally):** Auto-create a user profile in the `User` table the first time a valid Supabase JWT is seen, using `prisma.user.upsert` inside the `requireAuth` middleware. This let any Supabase Auth registrant gain access without manual seeding.
- **Rejected:** Requiring pre-seeded user records in the database before anyone can log in.
- **Why:** Reduced setup friction during early development. Any token that passed JWT verification would automatically bootstrap a profile.

**Later reversed:** This decision was reversed in Phase 12 (Production Auth). The auto-provisioning was removed entirely. A valid Supabase JWT that has no matching record in the application `User` table is now rejected with `403 Forbidden`. The reason: this is an internal expense portal, not a self-service signup product. Supabase Auth and the application's authorization system are separate concerns. Proving identity (AuthN) does not grant access (AuthZ) - that is determined exclusively by whether a pre-provisioned record exists in the database with an assigned role. Auto-provisioning bypassed that boundary entirely.

---

## Decision 4: Explicit State-Transition Endpoints over a Generic PATCH

- **Chose:** Dedicated endpoints for each lifecycle event: `POST /api/reports/:id/submit`, `/approve`, `/reject`, `/pay`, `/reset`.
- **Rejected:** A single `PATCH /api/reports/:id` endpoint that accepts `{ status: 'APPROVED' }` from the client.
- **Why:** A generic update trusts the client to know which transitions are legal. The state machine rules (e.g., you can only approve a SUBMITTED report, you cannot approve your own report) live entirely in the backend. Explicit endpoints make each transition a first-class action: the backend checks the current state, validates authorization, updates the status, stamps a timestamp, and writes an immutable history entry - all in a single `prisma.$transaction`. A generic PATCH endpoint would require the client to send the right combination of fields, and would inevitably drift.

---

## Decision 5: Automatic Category-Based Approver Routing over Manual Assignment

- **Chose:** On submission, the backend automatically aggregates line items by category, identifies the primary category (highest total spend), and assigns the report to the designated approver for that category. If the designated approver is the report's owner, the system swaps to the other approver.
- **Rejected:** Keeping the original "Global Queue + Assign to Me" flow where approvers manually claimed reports from a shared inbox.
- **Why:** Manual claiming introduces a race condition (two approvers grabbing the same report simultaneously), creates uneven workload distribution, and has no conflict-of-interest enforcement. The routing rules are deterministic, auditable, and consistent. The anti-self-approval swap closes a structural loophole without requiring a separate admin role or explicit policy enforcement at the UI level.

---

## Decision 6: Soft-Delete Archiving over Hard Delete

- **Chose:** An `isArchived: Boolean` flag on `ExpenseReport`, with separate Active and Archived views in the dashboard and a dedicated Restore action.
- **Rejected:** Permanently deleting reports or having no archive mechanism at all.
- **Why:** Expense reports are financial records. Hard deleting them would destroy audit history and potentially violate financial record-keeping requirements. The `isArchived` flag keeps the record intact and immutable while removing it from active workflows, queue counts, and stale alert calculations. Restore is provided to make archiving reversible and safe to use without fear.

---

## Decision 7: Client Polling over WebSockets for Stale Alerts

- **Chose:** Frontend polls `GET /api/analytics/alerts` every 5 hours via `setInterval` inside a `useEffect`, with a manual Refresh button for on-demand checks.
- **Rejected:** A persistent WebSocket connection or server-sent events (SSE) to push stale alert notifications to the browser in real time.
- **Why:** Stale alerts are not time-critical to the second - a report that has been sitting for 5 days can tolerate a 5-hour notification delay. WebSockets require persistent connections and server-side state management that adds significant infrastructure complexity for no meaningful UX benefit at this scale. Polling is simple, stateless, and works correctly behind any reverse proxy or CDN without configuration.