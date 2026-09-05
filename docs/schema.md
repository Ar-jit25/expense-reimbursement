# Schema

## 1. Table by table: what columns and types does each one have?

### `users` (Model: `User`)
Stores application profiles mapped 1:1 with Supabase Auth identities.
- `id` (`String` / `TEXT`, Primary Key): The Supabase Auth UUID. Avoids redundant surrogate keys and eliminates identity translation lookups.
- `email` (`String` / `TEXT`, Unique, Indexed): User's corporate email address.
- `name` (`String?` / `TEXT`, Nullable): User's full display name.
- `role` (`Role` enum: `EMPLOYEE` | `APPROVER`, Default: `EMPLOYEE`): User's authorization role within the expense portal.
- `createdAt` (`DateTime` / `TIMESTAMPTZ`, Default: `now()`)

### `expense_reports` (Model: `ExpenseReport`)
The primary entity representing an expense claim envelope.
- `id` (`Int` / `INTEGER`, Primary Key, Autoincrement): Internal report identifier.
- `title` (`String` / `TEXT`): Title describing the business trip or reimbursement purpose.
- `dateFrom` (`DateTime` / `TIMESTAMPTZ`): Start date of the expense window.
- `dateTo` (`DateTime` / `TIMESTAMPTZ`): End date of the expense window.
- `status` (`ReportStatus` enum: `DRAFT` | `SUBMITTED` | `APPROVED` | `REJECTED` | `PAID`, Default: `DRAFT`): Current state machine position.
- `isArchived` (`Boolean`, Default: `false`): Soft-delete visibility flag. Allows filtering inactive records without destroying audit logs.
- `submittedAt` (`DateTime?` / `TIMESTAMPTZ`, Nullable): Timestamp stamped when moving `DRAFT` -> `SUBMITTED`. Used for aging and stale alert calculations.
- `approvedAt` (`DateTime?` / `TIMESTAMPTZ`, Nullable): Timestamp stamped when moving `SUBMITTED` -> `APPROVED`.
- `paidAt` (`DateTime?` / `TIMESTAMPTZ`, Nullable): Timestamp stamped when moving `APPROVED` -> `PAID`.
- `createdAt` (`DateTime` / `TIMESTAMPTZ`, Default: `now()`)
- `updatedAt` (`DateTime` / `TIMESTAMPTZ`, Automatically updated)
- `ownerId` (`String` / `TEXT`, Foreign Key -> `users.id`): Identifies the employee who owns and submitted the claim.

### `expense_lines` (Model: `ExpenseLine`)
Individual receipts or itemized expenses belonging to a report.
- `id` (`Int` / `INTEGER`, Primary Key, Autoincrement): Line item ID.
- `reportId` (`Int` / `INTEGER`, Foreign Key -> `expense_reports.id`, Cascade Delete): Parent report link.
- `date` (`DateTime` / `TIMESTAMPTZ`): Date the expense was incurred.
- `amount` (`Decimal(12, 2)` / `NUMERIC(12,2)`): Exact financial monetary value. Avoids IEEE 754 binary floating-point rounding errors.
- `category` (`ExpenseCategory` enum: `TRAVEL` | `MEALS` | `ACCOMMODATION` | `SUPPLIES` | `SOFTWARE` | `EQUIPMENT` | `OTHER`): Standardized classification.
- `description` (`String` / `TEXT`): Item description or vendor detail.
- `createdAt` (`DateTime` / `TIMESTAMPTZ`, Default: `now()`)
- `updatedAt` (`DateTime` / `TIMESTAMPTZ`, Automatically updated)

### `report_approvers` (Model: `ReportApprover`)
Join table establishing many-to-many relationship between reports and assigned approvers.
- `reportId` (`Int` / `INTEGER`, Foreign Key -> `expense_reports.id`, Cascade Delete)
- `approverId` (`String` / `TEXT`, Foreign Key -> `users.id`, Cascade Delete)
- `assignedAt` (`DateTime` / `TIMESTAMPTZ`, Default: `now()`)
- Primary Key: Composite `[reportId, approverId]` preventing duplicate assignment rows.

### `report_history` (Model: `ReportHistory`)
Append-only immutable audit trail capturing every lifecycle state transition.
- `id` (`Int` / `INTEGER`, Primary Key, Autoincrement)
- `reportId` (`Int` / `INTEGER`, Foreign Key -> `expense_reports.id`, OnDelete: Restrict): Protected against accidental cascading report deletions.
- `actorId` (`String` / `TEXT`, Foreign Key -> `users.id`): The user who triggered the transition.
- `fromStatus` (`ReportStatus?` enum, Nullable): Starting status prior to the transition (null on initial creation).
- `toStatus` (`ReportStatus` enum): Resulting status following the transition.
- `reason` (`String?` / `TEXT`, Nullable): Explanatory note or mandatory rejection reason.
- `createdAt` (`DateTime` / `TIMESTAMPTZ`, Default: `now()`)

### `comments` (Model: `Comment`)
Freeform communication thread between report owners and reviewing approvers.
- `id` (`Int` / `INTEGER`, Primary Key, Autoincrement)
- `reportId` (`Int` / `INTEGER`, Foreign Key -> `expense_reports.id`, Cascade Delete)
- `authorId` (`String` / `TEXT`, Foreign Key -> `users.id`)
- `content` (`String` / `TEXT`): Message body.
- `createdAt` (`DateTime` / `TIMESTAMPTZ`, Default: `now()`)

### `stale_alerts` (Model: `StaleAlert`)
Approver-facing notification tracking unreviewed reports exceeding the staleness threshold.
- `id` (`Int` / `INTEGER`, Primary Key, Autoincrement)
- `reportId` (`Int` / `INTEGER`, Foreign Key -> `expense_reports.id`, Cascade Delete)
- `approverId` (`String` / `TEXT`, Foreign Key -> `users.id`, Cascade Delete)
- `dismissedAt` (`DateTime?` / `TIMESTAMPTZ`, Nullable): When the approver dismissed the alert. Null indicates an unread/active alert.
- `createdAt` (`DateTime` / `TIMESTAMPTZ`, Default: `now()`)
- Unique Constraint: `[reportId, approverId]` enabling clean idempotent upsert operations.

---

## 2. Which relationships are one-to-many, and which are many-to-many?

### One-to-Many Relationships (1:N)
- **`User` -> `ExpenseReport` (`ReportOwner`):** One employee owns zero or many expense reports. Each report has exactly one owner (`ownerId`).
- **`ExpenseReport` -> `ExpenseLine`:** One report contains zero, one, or many line items. Each line belongs strictly to one parent report (`reportId`).
- **`ExpenseReport` -> `ReportHistory`:** One report accumulates many immutable audit entries over its lifecycle.
- **`User` -> `ReportHistory`:** One user acts as the actor across many audit entries.
- **`ExpenseReport` -> `Comment`:** One report contains many comment entries.
- **`User` -> `Comment`:** One user authors many comments.
- **`ExpenseReport` -> `StaleAlert`:** One report can generate alerts across approvers.
- **`User` -> `StaleAlert`:** One approver receives alerts for multiple stale reports.

### Many-to-Many Relationships (M:N)
- **`ExpenseReport` <-> `User` (via `ReportApprover` join table):**
  - An expense report can have multiple designated approvers assigned over time or concurrently.
  - An approver user can be assigned to review multiple expense reports.
  - Implemented as a normalized relational join table (`report_approvers`) with foreign keys to both entities and a composite primary key `[reportId, approverId]`.

---

## 3. Which constraints are enforced by the database, and which by application code - and why did you draw the line there?

### Database-Enforced Constraints
- **Primary Keys and Uniqueness:**
  - Single-column PKs on all primary tables.
  - `User.email` is unique.
  - Composite primary key on `ReportApprover [reportId, approverId]` prevents duplicate approver assignments at the engine level.
  - Unique composite constraint on `StaleAlert [reportId, approverId]` ensures an alert row is unique per approver/report pair.
- **Foreign Key Referencing & Referential Integrity:**
  - Non-nullable foreign keys (`ExpenseLine.reportId`, `ExpenseReport.ownerId`) guarantee orphan lines or ownerless reports cannot exist.
  - Foreign key cascades on dependent operational rows (`ExpenseLine`, `Comment`, `StaleAlert`, `ReportApprover`).
  - Strict foreign key restrict on `ReportHistory.reportId` (`onDelete: Restrict`) prevents financial audit trails from being accidentally deleted.
- **Data Types and Precision:**
  - PostgreSQL `NUMERIC(12, 2)` strictly enforces currency bounds and forbids float inaccuracy.
  - PostgreSQL Enums (`Role`, `ReportStatus`, `ExpenseCategory`) reject invalid state or category values at the dialect level.

### Application-Enforced Constraints
- **State Machine Transitions:**
  - Transition validity (e.g. `DRAFT` -> `SUBMITTED`, `SUBMITTED` -> `APPROVED`, `REJECTED` -> `DRAFT`).
  - Mandatory rejection reason on `REJECTED` transition.
- **Role-Based Authorization & Self-Approval Prevention:**
  - Only users with role `APPROVER` can approve, reject, or pay.
  - Approver cannot be the report owner (`ownerId !== currentUserId`).
- **Dynamic Approver Routing:**
  - Aggregation of line items by category on submit to identify primary spend category and assign the designated approver, swapping if a conflict of interest occurs.
- **DRAFT-Only Mutations:**
  - Line additions, updates, or deletions are rejected if `status !== 'DRAFT'`.
- **Date Range Validation:**
  - Enforcing `dateFrom <= dateTo`.

### Why the line was drawn there
The database engine guarantees **structural integrity, referential consistency, and concurrency safety** (uniqueness, foreign keys, non-nulls, numeric precision). Complex **business logic, role policies, contextual authorization, and state transitions** belong in the application service layer because:
1. Business policies change faster than schemas; putting workflow rules in PostgreSQL stored procedures or complex triggers makes testing, debugging, and migration orchestration unnecessarily opaque.
2. Authorization context (like Supabase JWT claims, current session user, and role assignments) lives at the HTTP/application boundary.
3. Using atomic database transactions (`prisma.$transaction`) inside the service layer gives the best of both worlds: application logic inspects conditions, and the database guarantees all associated mutations succeed or fail together.

---

## 4. What did you deliberately denormalise?

### What was intentionally NOT denormalized: `ExpenseReport.total`
In many naive expense systems, a `total` column is added to the report table and updated via triggers or hooks. This codebase **deliberately rejected** storing a persisted total column.
- **Reason:** A stored aggregate is mutable state that can desynchronize if a line item is edited or removed outside a trigger.
- **Approach:** Total is computed dynamically on read from line items (`SUM(lines.amount)`). For sorting large sets by total, a targeted SQL aggregate subquery is executed over authorized IDs.

### What was deliberately denormalized:
1. **Lifecycle Timestamps on `ExpenseReport` (`submittedAt`, `approvedAt`, `paidAt`):**
   - Strictly speaking, every state change timestamp exists in the append-only `ReportHistory` audit table.
   - However, querying `ReportHistory` with subqueries or joins on every dashboard load, stale alert calculation, and analytics aggregation introduces substantial query overhead.
   - Stamping these timestamps directly onto `ExpenseReport` allows instant indexing (`@@index([status, submittedAt])`) and fast linear filters for aging calculations without scanning the audit log.
2. **User Identity Linking via Supabase Auth UUID:**
   - `User.id` directly stores the Supabase Auth UUID as a string primary key rather than creating an internal serial integer ID with a foreign key back to an auth table.
   - This eliminates an unnecessary join or translation lookup on every authenticated API request.

---

## 5. What would break first if this had 100x the data?

If the dataset scaled by 100x (e.g., millions of expense lines, hundreds of thousands of reports):

1. **In-Memory Total Calculation on List Endpoints:**
   - Currently, unpaginated report queries fetch all child lines into Node memory and compute the report total with `lines.reduce()`. At 100x scale, transferring hundreds of thousands of lines over the wire to calculate totals in Node process memory would cause severe memory pressure, garbage collection pauses, and network bottlenecks.
   - **Fix:** Move total calculation into a database-level view or SQL join (`SELECT r.*, COALESCE(SUM(l.amount), 0) AS total FROM expense_reports r LEFT JOIN expense_lines l ON ... GROUP BY r.id`).
2. **Sorting by Derived Total (Two-Step Authorized IDs Pipeline):**
   - The current sort-by-total mechanism selects matching report IDs in Prisma and passes them as an `IN (...)` array into a raw SQL aggregation query. At 100x scale, an `IN` clause containing tens of thousands of IDs will exhaust query parameter limits and cause severe database query planning degradation.
   - **Fix:** Convert to a single CTE (Common Table Expression) or indexed materialized view.
3. **Stale Alert Recalculation Engine:**
   - `alert.service.js` currently queries all `SUBMITTED` unarchived reports and reconciles them against existing `StaleAlert` rows on every alert fetch. At 100x volume, this full table scan across pending reports would create query latency spikes and lock contention.
   - **Fix:** Offload alert evaluation to an asynchronous scheduled worker (e.g. pg_cron or BullMQ job) that updates alert tables incrementally, rather than running recalculations inline on HTTP GET requests.
4. **Unpaginated Fallback Queries:**
   - The API currently maintains backward compatibility by returning an unpaginated raw array if `page` and `limit` query parameters are omitted. At 100x scale, any request without pagination would time out or crash the server.
   - **Fix:** Enforce a strict server-side hard ceiling (e.g., `limit = Math.min(limit || 50, 100)`) across all list endpoints.
