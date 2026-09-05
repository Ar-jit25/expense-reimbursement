# Expense Reimbursement System — Master Architectural Study Guide

---

## 🎯 Executive Summary & Problem Domain

### The Real-World Scenario
In many corporate environments, expense management breaks down through informal channels: spreadsheets sent via email threads, receipts attached as loose images, manual math calculations by finance teams, and managers accidentally approving their own reimbursement requests. Rejected reports vanish into inboxes, and finance has zero real-time visibility into outstanding reimbursement liability.

### The System Solution
This application replaces that broken workflow with a single, highly governed, full-stack platform:
1. **Zero Trust Role-Based Access Control**: Strict segregation between Employees and Approvers.
2. **Deterministic State Machine**: Lifecycle transitions from `DRAFT` ➔ `SUBMITTED` ➔ `APPROVED` / `REJECTED` ➔ `PAID`.
3. **Automated Rule-Based Category Routing Engine**: Determines the report's primary category based on the highest expense amount and assigns the responsible approver, with automated self-approval prevention.
4. **Global vs. Assigned Queue Paradigm**: A unified submitted queue gives approvers complete organizational visibility while strictly forbidding opening or acting on reports assigned to another approver.
5. **Soft-Delete Archive & Restore Lifecycle**: Keeps primary views uncluttered while retaining immutable audit trails.
6. **Stale Approval Alert Engine**: Automatically alerts approvers to reports pending decision for more than 5 days, recalculating on a 5-hour recurrence and polling cycle.
7. **Production Cloud Integration**: Real Supabase PostgreSQL database and real Supabase Auth JWT cryptographic verification.

---

## 🏗️ Core Architecture & Moving Parts

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                           │
│  - React Router (Protected Routes)                                      │
│  - AuthContext (Supabase Auth Client + /api/me Role Verification)      │
│  - Centralized API Client (Bearer Token Interceptor)                   │
│  - Dashboard (Active / Archived Tabs, Analytics for Approvers)         │
│  - Approvals (Assigned Queue vs Global Read-Only Queue)                 │
│  - Stale Alerts Badge & Page (5-Day Stale Detection, 5-Hour Polling)   │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ HTTP / JSON (Bearer JWT)
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend API                             │
│  - Pipeline: requireAuth ➔ requireRole ➔ requireReportOwner /          │
│              requireNotReportOwner ➔ Controller ➔ Service               │
│  - Business Services: ReportService, LineService, AlertService         │
│  - Routing Engine: Category sum evaluation, approver assignment        │
│  - Authorized IDs Pipeline: Two-step aggregation and dynamic filtering │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │ Prisma ORM                       │ Supabase Admin API
                   ▼                                  ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│       Supabase PostgreSQL DB          │ │    Supabase Auth Server      │
│  - User, ExpenseReport, ExpenseLine   │ │  - User Identity Management  │
│  - ReportApprover, ReportHistory      │ │  - JWT Issuance & Cryptographic│
│  - StaleAlert, Comment                │ │    Signature Verification    │
└───────────────────────────────────────┘ └──────────────────────────────┘
```

---

## 📚 Detailed Breakdown: Phases 1 Through 16

---

### Phase 1: Database Architecture & Schema Design (Postgres + Prisma)

#### 1. Why Relational Databases?
Financial applications require strict data integrity. If an expense report is deleted, all child line items must be removed cleanly (`CASCADE`), and foreign keys must prevent orphaned records.
- **Strict Data Integrity**: Every table is mapped with explicit foreign key relationships.
- **Prisma 5.11.0 Engine**: Provides type-safe database queries and migration management.

#### 2. The Schema Blueprint
- **`User`**: Mapped directly to Supabase Auth UUID (`id String @id`).
- **`ExpenseReport`**: Contains lifecycle timestamps (`submittedAt`, `approvedAt`, `paidAt`), foreign key `ownerId`, and `isArchived Boolean @default(false)`.
- **The "Missing Total Column" Design Pattern**: Deliberately omitted a persisted `total` column. Storing a precomputed total creates a risk of desynchronization if line items are added, updated, or removed concurrently. Totals are computed on-the-fly (`SUM(amount)`).
- **`ReportHistory`**: Append-only audit log recording actor ID, state transitions (`fromStatus` ➔ `toStatus`), timestamps, and rejection reasons.
- **`ReportApprover`**: Explicit join table mapping reports to assigned approvers (`reportId`, `approverId`).
- **`StaleAlert`**: Tracks dismissed alerts with compound unique constraint `@@unique([reportId, approverId])`.

---

### Phase 2: Authentication & Backend Authorization (Express + Supabase)

#### 1. Authentication (AuthN) vs. Authorization (AuthZ)
- **AuthN (Who are you?)**: Handled by Supabase Auth, which validates email/password and signs standard JWTs.
- **AuthZ (What can you do?)**: Handled strictly by the Express backend. The client cannot dictate or inject roles.

#### 2. The Verification Pipeline
1. `requireAuth`: Extracts `Bearer <token>`, calls `supabase.auth.getUser(token)` to cryptographically verify the JWT against Supabase's public keys, queries `prisma.user.findUnique({ where: { id: supabaseUser.id } })`, and attaches `req.user`.
2. `requireRole('APPROVER')`: Validates role from database record.
3. Zero-Trust Access: If a valid Supabase user has no matching row in `prisma.user`, access is denied (`403 Forbidden`).

---

### Phase 3: Reports & Expense Lines (REST API & 3-Tier Pattern)

#### 1. Separation of Concerns
- **Routes (`report.routes.js`)**: Maps URLs to controllers and applies middleware chains.
- **Controllers (`report.controller.js`)**: Handles HTTP status codes, request parsing, and error serialization.
- **Services (`report.service.js`)**: Executes business logic and database queries independently of HTTP headers.

#### 2. Immutability Rules
- Expense lines can only be created, modified, or deleted when a report is in `DRAFT` status.
- Once submitted, lines are locked to prevent tampering during review.

---

### Phase 4: State Machine & Workflow Transitions

#### 1. Lifecycle Rules
```
                 ┌───────────────┐
                 │     DRAFT     │◀──────────────┐
                 └───────┬───────┘               │
                         │ Owner Submit          │ Reject (requires reason)
                         ▼                       │
                 ┌───────────────┐               │
       ┌─────────┤   SUBMITTED   ├───────────────┘
       │         └───────┬───────┘
       │                 │ Non-Owner Approver
       │                 ▼
       │         ┌───────────────┐
       │         │   APPROVED    │
       │         └───────┬───────┘
       │                 │ Approver Mark Paid
       │                 ▼
       │         ┌───────────────┐
       │         │     PAID      │
       │         └───────────────┘
```

#### 2. Atomic Transitions (`Prisma.$transaction`)
State changes and audit history creation are executed within an atomic database transaction. If the audit log insertion fails, the status update is rolled back.

---

### Phase 5: Policy Limits & Self-Approval Prevention

#### 1. The Anti-Self-Approval Principle
A manager who holds the `APPROVER` role can still incur business expenses and create reports. However, the server strictly forbids any approver from approving, rejecting, or deciding on their own expense report (`requireNotReportOwner`).

#### 2. Reason Requirement on Rejection
Rejection requires a non-empty `reason`. The report returns to `DRAFT` status so the employee can correct and resubmit it.

---

### Phase 6: Dynamic Queries, Scoping & Pagination

#### 1. Base Authorization Scoping
The `getAuthorizationFilter(user, queue)` service method is the single source of truth:
- For `EMPLOYEE`: Automatically forces `{ ownerId: user.id }`.
- For `APPROVER`: Allows queue-based views (`pending`, `history`, `submitted`, `archived`).

#### 2. The Authorized IDs Pipeline
Prisma cannot sort by the `SUM` of related line items combined with `take`/`skip`. The solution is a two-step pipeline:
1. Prisma resolves the authorized report IDs based on role and filters.
2. A parameterized `$queryRaw` query joins `expense_lines`, calculates `SUM(amount)`, sorts, and applies `LIMIT` and `OFFSET`.
3. Prisma hydrates the full object models for the resulting IDs.

---

### Phase 7: React Frontend & API Client Architecture

#### 1. Centralized API Interceptor (`apiClient.js`)
Pulls the JWT from `localStorage`, injects the `Authorization: Bearer <token>` header, and standardizes error responses.

#### 2. Protected Client Routing
`ProtectedRoute` restricts access to views like `/approvals` based on the authenticated role retrieved from `/api/me`.

---

### Phase 8: Bulk Operations & Partial Success
Bulk approval and rejection endpoints accept arrays of report IDs. The backend evaluates each item independently:
- Valid reports are transitioned.
- Invalid attempts (e.g., self-approval attempts or invalid status) are collected in a `failed` array with error messages.
- Returns `200 OK` with `{ successful: [...], failed: [...] }`.

---

### Phase 9: Analytics & Time-Series Aggregations
- Approvers view cross-system analytics (pending approvals, total due, recent approvals).
- Employees view their own personal reimbursement metrics.
- Uses `recharts` for 8-week historical trend lines.

---

### Phase 10: Stale Alerts Core & Dismissal Models
- Detects reports pending decision past a defined age threshold.
- Dismissals are recorded per-approver in `StaleAlert`.
- When an approver dismisses an alert, it is suppressed until the redisplay threshold expires, at which point it recurs.

---

### Phase 11: UI Polish & Form Validation
- Client-side date range verification (`dateFrom <= dateTo`).
- Category validation matching Prisma schema (`TRAVEL`, `MEALS`, `EQUIPMENT`, `ACCOMMODATION`, `SUPPLIES`, `SOFTWARE`, `OTHER`).
- In-flight request disabling (`isProcessing`) to eliminate double-click race conditions.

---

### Phase 12: Production Supabase Auth & Deployment Readiness
- Migrated from mock authentication to real Supabase Auth tokens.
- Secure environment configuration via `.env`.
- Connection pooling configured over Supabase pooler (port 6543) and session pooler (port 5432).

---

### Phase 13: Category-Based Auto-Assignment & Self-Approval Prevention Engine

#### 1. Business Logic
When an employee submits an expense report:
1. The backend sums line item amounts by category.
2. The category with the highest total amount becomes the **Primary Category**.
3. Approver mapping:
   - **Approver A** (`app@example.com`): `TRAVEL`, `MEALS`, `EQUIPMENT`
   - **Approver B** (`app2@example.com`): `ACCOMMODATION`, `SUPPLIES`, `SOFTWARE`, `OTHER`
   - In case of ties, defaults to **Approver B**.
4. **Self-Approval Prevention Swap**: If the assigned approver is the owner of the report, the engine automatically swaps the assignment to the alternate approver.
5. Approvers are fully authorized to create and submit their own reports as employees.

```javascript
// Dynamic Assignment Logic (report.service.js)
const categoryTotals = {};
for (const line of report.lines) {
  categoryTotals[line.category] = (categoryTotals[line.category] || 0) + Number(line.amount);
}
// Sort by highest amount
let primaryCategory = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a])[0];

let assignedEmail = APPROVER_A_CATEGORIES.includes(primaryCategory) ? 'app@example.com' : 'app2@example.com';
if (report.owner.email === assignedEmail) {
  assignedEmail = (assignedEmail === 'app@example.com') ? 'app2@example.com' : 'app@example.com';
}
```

---

### Phase 14: Global Queue vs. Assigned Approver Workflow

#### 1. The Global Submitted Queue
Approvers have a global overview of all pending organizational liability.
- **Visibility**: The `submitted` queue returns all submitted reports across the company.
- **Enforced Action Restriction**: Approvers can only open, view details, approve, or reject reports **explicitly assigned to them**.
- In the UI, reports assigned to other approvers display an assignment badge and are non-clickable, preventing unauthorized review.
- On the backend, `requireAssignedApprover` middleware validates `ReportApprover` records before executing any decision endpoint.

---

### Phase 15: Soft-Delete Archiving & Restoration Lifecycle

#### 1. Archiving Requirements
Employees and approvers need to declutter active lists without losing audit history.
- **Implementation**: `isArchived: Boolean @default(false)` on `ExpenseReport`.
- **Dashboard Separation**: Two tabs: **Active Reports** and **Archived Reports**.
- **Lifecycle**:
  - Clicking **Archive** marks `isArchived = true` and removes the report from active queues.
  - In the Archived tab, reports cannot be edited or submitted, but display a **Restore** button.
  - Clicking **Restore** sets `isArchived = false`, returning the report to its active workflow state.
  - Archived reports are strictly excluded from stale alert calculations.

---

### Phase 16: Stale Alert Recurrence Engine (5 Days Stale, 5 Hours Recurrence & Polling)

#### 1. Exact Threshold Rules
- **Stale Threshold**: A report is stale if `status === 'SUBMITTED'`, `isArchived === false`, and `submittedAt < now - 5 days`.
- **Recalculation & Recurrence**: When an approver dismisses an alert, `dismissedAt` is stamped. The alert is suppressed for 5 hours. After 5 hours, if the report remains submitted, the alert **recurs** and reappears in the approver's alert list and badge.
- **Periodic Database Check (Polling)**:
  - Both `AlertsBadge.jsx` and `Alerts.jsx` poll `/api/alerts` every **5 hours** (`5 * 60 * 60 * 1000` ms).
  - Each poll hits the database, running the Prisma relation filter:
  ```javascript
  alerts: {
    none: {
      approverId,
      dismissedAt: { gte: redisplayDate } // 5 hours ago
    }
  }
  ```
- **Manual Refresh**: A manual refresh button on `/alerts` allows immediate recalculation on demand.

---

## 💼 Master Technical Interview Q&A

### Architecture & Security
**Q: How do you guarantee an Approver cannot approve their own expense report?**
*A: Defense-in-depth across three layers: First, during submission, our routing engine checks if the primary approver equals the report owner and automatically reassigns the report to an alternate approver. Second, in the Approvals UI, reports not assigned to the logged-in approver are non-clickable. Third and most importantly, the backend Express middleware `requireNotReportOwner` and `requireAssignedApprover` query the database on every approval attempt and reject self-approval attempts with a 403 Forbidden error.*

**Q: Why omit the `total` column from the database?**
*A: Storing computed aggregates creates data synchronization risks. If an expense line is deleted or updated concurrently and the server fails before updating the parent total, data becomes permanently corrupted. By calculating the total dynamically via SQL `SUM(amount)` or Node.js reduction across lines, the total is mathematically guaranteed to be accurate at read time.*

**Q: How does the Stale Alert dismissal and recurrence logic work in PostgreSQL?**
*A: We use a `StaleAlert` table with a composite unique key on `[reportId, approverId]`. When an approver dismisses an alert, we upsert `dismissedAt = now()`. The alert query looks for reports submitted > 5 days ago where `approvers` contains the user, and `alerts` has `none` where `approverId == user.id AND dismissedAt >= now - 5 hours`. If 5 hours pass, `dismissedAt >= redisplayDate` becomes false, meaning the `none` condition is satisfied again, and the alert recurs cleanly.*

**Q: How is pagination handled when sorting by a calculated aggregate like report total?**
*A: We designed an "Authorized IDs Pipeline". Prisma first resolves the authorized report IDs according to the user's role and search parameters. We then feed those IDs into a parameterized `$queryRaw` query that joins `expense_lines`, computes `SUM(amount)`, sorts, and applies database-level `LIMIT` and `OFFSET`. Finally, Prisma hydrates the full models. This keeps authorization logic in the ORM while offloading mathematical aggregation to PostgreSQL.*

---