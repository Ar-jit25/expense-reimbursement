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


## Decision 5: Controller-Service Architecture (Phase 3)
- **Chose:** A strict 3-tier architecture: Routes -> Controllers -> Services.
- **Rejected:** Fat Route Handlers (putting `prisma.query` directly inside `app.get()`).
- **Why:** While Fat Route Handlers are faster to write, they make unit testing impossible without mocking the entire HTTP request. Separating business logic into a `Service` class means we can theoretically call `ReportService.createReport()` from a background cron job, a script, or a WebSocket, without an Express `req` or `res` object existing.

## Decision 6: The "Total" Calculation Endpoint (Phase 3)
- **Chose:** Calculating the total during the Prisma `GET` query map: `reports.map(report => report.lines.reduce(sum, line))`.
- **Rejected:** Sending just the lines to the frontend and trusting the frontend to calculate the total.
- **Why:** The instructions were explicit: "Never trust a client-provided total" and "do not add a stored authoritative total". By calculating it on the server right before sending the JSON response, the frontend gets a clean, authoritative `$220.00` and doesn't need to write error-prone floating-point math.


## Decision 7: Explicit State Transitions vs. Generic Updates (Phase 4)
- **Chose:** Explicit endpoints (`POST /api/reports/:id/approve`).
- **Rejected:** Allowing clients to send `PUT /api/reports/:id { status: 'APPROVED' }`.
- **Why:** The State Machine. A generic update endpoint relies on the frontend knowing the rules, which violates the security model. By creating explicit transition endpoints, the backend strictly orchestrates the atomic transaction: checking the prerequisite state, changing the state, stamping the timestamp, and logging the history.

## Decision 8: Transaction Atomicity (Phase 4)
- **Chose:** `prisma.$transaction`.
- **Rejected:** Awaiting sequential `.update()` and `.create()` calls.
- **Why:** If the server crashes or the network drops after `.update()` completes but before the `ReportHistory.create()` completes, the audit log is permanently corrupted. A database transaction ensures both succeed, or neither succeeds.

## Decision 9: The Authorization Phase Boundary (Phase 4)
- **Chose:** To permit *any* global Approver (who is not the owner) to approve any submitted report during Phase 4.
- **Rejected:** Checking the `ReportApprover` table to restrict approval only to explicitly assigned approvers.
- **Why:** To respect the project's strict phase boundaries. Phase 4 is exclusively about the Lifecycle State Machine and Immutable History. Phase 5 handles "Assigned Approvers." It is crucial in iterative development not to prematurely assume or implement business rules (like assignment routing logic) before their designated phase, as requirements for those features often introduce complexities best handled in isolation. Phase 4's `requireNotReportOwner` middleware strictly implements the "never their own" requirement without crossing into Phase 5 territory.

## Decision 10: Phase 5 Assignment Management Authority
- **Chose:** Any authenticated user with the APPROVER role may manage eligible-approver assignments for reports currently in the SUBMITTED state. (This includes assigning one or multiple eligible approvers, and removing assignments). Employees who own the reports cannot manage assignments merely through ownership.
- **Rejected:** Creating an explicit Admin role, or allowing Employees to route their own reports.
- **Why:** The README and action plan mandated that assignments exist but completely omitted *who* holds the authority to manage them. Introducing a third "Admin" role would drastically expand the scope of the project and violate the constraint to stick to Employee/Approver roles. Allowing employees to pick their own approvers is a security anti-pattern (they could pick a lenient friend). Allowing any Approver to manage assignments allows for a self-organizing "queue triage" system (e.g., a manager claims a report by assigning it to themselves, or assigns it to a subordinate).

## Decision 11: Phase 6 Conditional Pagination Response Contract
- **Chose:** To return a paginated object { data, total, page, limit } *only* if page or limit parameters are explicitly supplied. Otherwise, return the legacy raw array [].
- **Rejected:** Unconditionally returning the paginated object for all requests.
- **Why:** Backward compatibility. Returning the object unconditionally broke all Phase 3, 4, and 5 integration tests (and hypothetically, existing frontend consumers) that explicitly expected an array. The conditional design safely introduces new capabilities without shattering the established API contract.

## Decision 12: Phase 6 Derived Total Sorting (Authorized IDs Pipeline)
- **Chose:** To resolve sort=total by first querying Prisma for all authorized IDs, then passing those IDs into a $queryRaw PostgreSQL query for aggregation, sorting, and pagination.
- **Rejected:** Hybrid in-memory sorting (pulling all full records into Node.js), a generic raw SQL query (recreating the authorization logic in SQL), or storing 	otal directly on the database column.
- **Why:** Prisma does not natively support skip/	ake combined with sorting on an aggregate relation sum. The Authorized IDs Pipeline keeps the complex, critical authorization logic strictly within Prisma, using raw SQL *only* for the math and sorting on an already-vetted list of IDs. Storing a 	otal column was explicitly rejected by project constraints to prevent out-of-sync state.

## Decision 13: Mock Authentication Architecture (Phase 7)
- **Chose:** To use a simple mock Login screen that injects static backend test tokens (TOKEN_EMP, TOKEN_APP1) into localStorage instead of integrating the real Supabase Auth UI.
- **Rejected:** Setting up real Supabase authentication with email/passwords.
- **Why:** The project constraints heavily prioritized demonstrating the backend logic and routing mechanisms quickly. Real auth would require database seeding of user records and email verifications, distracting from the core objective: the Expense Reimbursement workflow. By mocking the JWTs identically to the verification scripts, the frontend instantly interfaces with the rigid backend authorization layers perfectly.

## Decision 14: Client-Side Response Normalization (Phase 7)
- **Chose:** To normalize the Phase 6 polymorphic pagination response strictly within the eportsService.js client layer.
- **Rejected:** Forcing the UI components to check Array.isArray(res).
- **Why:** Separation of Concerns. The React components should only understand one data contract ({ data, total, page, limit }). By transforming the raw unpaginated backend array into this structure inside the service wrapper, the UI remains perfectly clean and resilient to future backend changes.


### Phase 8: Reused Express Middleware Logic for Bulk Actions
- **Context**: The existing /approve and /reject endpoints use Express middleware (`requireNotReportOwner`, `requireAssignedApprover`) to enforce rules based on `req.params.id`.
- **Decision**: Instead of duplicating business logic or trying to run middleware inside a loop, we extracted the Prisma queries from the middleware into a private controller helper `_checkApprovalAuthorization`. 
- **Consequences**: Safely allowed bulk operations to process reports independently (e.g. failing on self-approval while succeeding on others) without disrupting the single-report state machine.

### Phase 9: Recharts & Node-side Time Series Bucketing
- **Decision**: Node-side bucketing for 8-week trend.
- **Rationale**: Prisma aggregations by ISO week require complex raw SQL (DATE_PART or strftime) that varies significantly by database engine (SQLite vs Postgres). Retrieving the raw objects and bucketing in Node provides predictable, ORM-agnostic behavior, aligned with the constraint to avoid raw SQL.
- **Decision**: Using echarts for visualization.
- **Rationale**: Required minimal integration effort into the existing React components, fully supported by the README constraint 'Use any UI framework'.

## Phase 10: Stale Alerts and Seed Data

1. **Per-Approver Dismissal with Redisplay**
   - *Decision:* Used a StaleAlert model with a unique constraint on [reportId, approverId] and an upsert logic on dismissal to set dismissedAt. Prisma queries exclude reports where the StaleAlert was dismissed within the redisplay threshold.
   - *Rationale:* Ensures one approver's dismissal does not hide the alert for another. The Prisma 
one relation filter allows querying this cleanly without raw SQL.

2. **Seed Data Idempotency**
   - *Decision:* The Prisma seed script first deletes all existing data in reverse dependency order before inserting exact deterministic test data.
   - *Rationale:* Ensures reliable E2E tests, analytics, and stale alert visibility states can be repeatedly tested locally.
