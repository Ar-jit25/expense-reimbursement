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
## Phase 2 — Authentication + Backend Authorization

### Intended work (recorded before implementation began)

**Goal**: Establish authenticated identity and server-side permissions using Supabase Auth (email/password) and Express middleware.

**Build order and rationale**:
1. Install necessary dependencies (`express`, `@supabase/supabase-js`, `dotenv`, etc.) in `backend/`.
2. Configure a Supabase client to interact with Supabase Auth.
3. Create an Express server with an authentication middleware (`auth.js`) that verifies Supabase JWTs and resolves the user's application profile (and role) from the database.
4. Implement authorization helper functions (e.g., `requireRole`, `requireOwner`) to enforce RBAC.
5. Build a protected test endpoint (`GET /api/me` or similar) to verify auth/authorization flows.
6. Write integration scripts/tests to verify that unauthenticated requests fail, roles are respected, and ownership is checked.
7. Document the backend authentication/authorization flow in `study.md`, `architecture.md`, and `decisions.md`.

**Why Auth first (before API logic)**: It's extremely difficult and insecure to retrofit authentication and authorization onto existing endpoints. Establishing the identity layer and authorization middleware now ensures all subsequent feature endpoints (Phase 3+) are built securely by design.

**Estimated time**: 1.5 - 2 hours.

**What can be deferred if time is short**: The test endpoints can be minimal.

**What cannot be deferred**: Correct parsing of the JWT, verification of the user profile, and foolproof role determination logic in Express.

---

### Actual results (recorded after Phase 2 completed)

*Pending — will be filled in after implementation and verification.*

---

## Phase 3 — Reports + Expense Lines

### Intended work (recorded before implementation began)

**Goal**: Implement the core CRUD functionality for expense reports and their associated line items, strictly enforcing ownership and lifecycle state (DRAFT) constraints on the server.

**Build order and rationale**:
1. **API Structure**: Setup `routes/`, `controllers/`, and `services/` layers for separation of concerns.
2. **Report Endpoints**: 
   - `POST /api/reports` (create)
   - `GET /api/reports` (list user's own reports, omitting archived by default)
   - `GET /api/reports/:id` (view specific report + lines + calculated total)
   - `PUT /api/reports/:id` (edit title/dates, must be DRAFT)
   - `PUT /api/reports/:id/archive` and `/restore` (visibility toggle)
3. **Expense Line Endpoints**:
   - `POST /api/reports/:id/lines` (add line, report must be DRAFT)
   - `PUT /api/reports/:id/lines/:lineId` (edit line)
   - `DELETE /api/reports/:id/lines/:lineId` (remove line)
4. **Authorization Enforcement**: Integrate `requireResourceOwnership` from Phase 2.
5. **Business Logic**: Prevent modifications to non-DRAFT reports. Calculate `total` dynamically on `GET` requests instead of storing it.

**Why Services/Controllers pattern**: Keeping Prisma queries and business logic inside a `Service` makes it easier to unit test, reuse internally, and keeps Express `Controllers` focused on HTTP request/response parsing.

**Estimated time**: 2-3 hours.

**What can be deferred if time is short**: Advanced input validation frameworks (e.g., Joi/Zod) can be simplified to manual checks for now to prioritize core logic.

**What cannot be deferred**: Server-side total calculation. Ownership checks. Rejecting edits on SUBMITTED/APPROVED reports.

---

### Actual results (recorded after Phase 3 completed)

*Pending — will be filled in after implementation and verification.*

---

## Phase 4 — Report Lifecycle State Machine + Immutable History

### Intended work (recorded before implementation began)

**Goal**: Implement the core state machine for expense reports (DRAFT -> SUBMITTED -> APPROVED -> PAID) and (SUBMITTED -> REJECTED -> DRAFT). Enforce authorization, prevent invalid transitions, and maintain an immutable audit trail using database transactions.

**Build order and rationale**:
1. **API Endpoints**: Add specific lifecycle RPC-style routes to `report.routes.js`:
   - `POST /api/reports/:id/submit` (Owner only)
   - `POST /api/reports/:id/approve` (Approver only, NOT owner)
   - `POST /api/reports/:id/reject` (Approver only, NOT owner. Requires reason)
   - `POST /api/reports/:id/pay` (Approver only, NOT owner)
   - `POST /api/reports/:id/reset` (Owner only, moves REJECTED -> DRAFT)
2. **Authorization Middleware**: 
   - Create `requireNotReportOwner` to ensure approvers cannot act on their own reports.
3. **Service Logic (The State Machine)**:
   - Use Prisma `$transaction` to ensure Atomicity.
   - For every transition:
     - Verify current status matches expected pre-requisite.
     - Update status.
     - Set appropriate timestamp (`submittedAt`, `approvedAt`, `paidAt`).
     - `CREATE` a `ReportHistory` record locking in the actor, old status, new status, and reason.
4. **Verification**: 
   - Build a rigorous integration script testing all happy paths and asserting failures on invalid transitions, bad roles, and self-approval attempts.

**Why explicit RPC endpoints instead of `PUT /api/reports/:id { status: 'APPROVED' }`**: Allowing a generic update endpoint to mutate the status is incredibly dangerous. It allows clients to bypass the state machine, skip timestamp assignments, and skip audit history creation. Explicit endpoints (`/approve`) guarantee the transaction block is executed exactly as designed.

**Estimated time**: 2.5 hours.

**What can be deferred if time is short**: Nothing. History, timestamps, and transactions are critical financial constraints.

**What cannot be deferred**: `requireNotReportOwner`. Prisma `$transaction`.

---

### Actual results (recorded after Phase 4 completed)

*Pending — will be filled in after implementation and verification.*

---


**Phase 4 Boundary Inspection Note**:
During Phase 4, the authorization condition for `/approve`, `/reject`, and `/pay` relies exclusively on global role-based authorization (`requireRole('APPROVER')`) combined with self-approval prevention (`requireNotReportOwner`). We intentionally stopped exactly at the phase boundary. We did *not* implement report-specific approver assignment constraints (e.g., verifying if the approver is explicitly assigned to this specific report via the `ReportApprover` join table). That constraint belongs strictly to Phase 5.

## Phase 5 — Approver assignment + queues

### Intended work (recorded before implementation began)
*Refer to the implementation_plan.md artifact for full details on Phase 5 API, middleware, and logic updates.*

### Actual results (recorded after Phase 5 completed)

**What was built**:
- **Assignment Routes**: `POST /api/reports/:id/assignments` and `DELETE`. 
- **Idempotency**: Used Prisma `upsert` and caught `P2025` deletions to make assignments perfectly idempotent.
- **Queue Semantics**: Updated `GET /api/reports` to process `queue=submitted` (all) and `queue=assigned` (assigned only). Employees accessing these routes are strictly blocked.
- **Authorization Stack**: Added `requireAssignedApprover` to `/approve` and `/reject` making them assignment-gated, while preserving the overarching `requireNotReportOwner` block.

**What deviated from intent**:
- **Bug Fix**: My initial update to the Controller and Service missed applying properly due to string matching errors in the script, which caused the Employee Queue restriction test to fail initially because the new `list` method wasn't executing. I corrected the replacement script, ran the tests again, and all 18 integrations passed perfectly.

**What was estimated vs actual**:
- Estimated time: 2 hours.
- Actual time spent: 1.5 hours.

---

## Phase 6: Server-Side Report Discovery
**Objective**: Implement robust search, filtering, sorting, and pagination for /api/reports without weakening the Phase 1-5 security and queuing boundaries.
**Planned Behavior**:
- Strict Authorization > Queue > Filter > Sort > Pagination pipeline.
- Derived total sorting using an Authorized IDs Pipeline to leverage PostgreSQL aggregation while preserving Prisma's security.
- Conditional pagination responses to maintain backward compatibility for existing unpaginated clients/tests.
**Actual Implementation**:
- Modified eport.controller.js to parse and validate page, limit, sort, order, status, search, ownerId, pproverId.
- Rewrote eport.service.js:getReports to dynamically construct a safe Prisma where clause utilizing AND arrays to prevent filter bypassing.
- Implemented the Authorized IDs Pipeline for sort=total by first retrieving matching IDs via Prisma, then injecting them safely into a parameterized $queryRaw to perform SUM, ORDER BY, and LIMIT/OFFSET.
**Deviations**: None from the approved architecture.
**Problems Encountered**:
- Prisma does not support ordering by aggregate sums of relations while natively paginating.
- Raw SQL table names had to be carefully matched with schema @@map definitions (expense_reports and expense_lines).
- Adding pagination output ({ data, total, page, limit }) broke earlier test suites (Phases 3, 4, 5) which expected raw arrays.
**Fixes**:
- Adopted the Authorized IDs Pipeline (Two-Step query).
- Fixed SQL table mapping and Enum mappings in verification scripts.
- Adopted Conditional Response Wrapping to serve raw arrays when pagination parameters are absent.
- Corrected a testing oversight in erify-phase4.js where the Phase 5 assignment requirement caused a 403 instead of the expected 400 state machine error. We explicitly assigned the approver in the test to properly evaluate the state machine rules.
**Verification Outcome**: All 34 new Phase 6 verification checks passed successfully, alongside 100% regression pass rates for Phases 4 and 5.

## Phase 7: React Frontend Dashboard & Workflows
**Objective**: Build a complete, functional React frontend for Employees and Approvers, integrating with the Phase 1-6 backend APIs.
**Planned Behavior**:
- Setup React with Vite.
- Implement mock authentication supporting testing tokens (TOKEN_EMP, TOKEN_APP1).
- Normalize polymorphic backend responses in a centralized API service.
- Create Dashboards, Create Report, Report Details, and Approval Queues.
**Actual Implementation**:
- Initialized Vite + React + react-router-dom in rontend/.
- Created piClient.js to automatically attach the JWT and handle JSON/text responses.
- Created eports.js to normalize the GET /api/reports unpaginated array vs paginated object response.
- Implemented AuthContext to persist tokens in localStorage.
- Built Dashboard with complete search, filtering, and sorting matching Phase 6 rules.
- Built CreateReport supporting dynamic expense line creation and deletion.
- Built Approvals queue with tabs for Global Submitted and Assigned to Me.
**Deviations**: None.
**Verification Outcome**: Manual build and routing confirmed. All backend regression verification scripts (Phase 4, 5, 6) continue to pass perfectly since backend logic was completely untouched.
