# Schema

Answer each of these, in your own words.

- Table by table: what columns and types does each one have?
  - `User`: id (UUID, Supabase Auth), email (String, unique), name (String?), role (Role enum: EMPLOYEE/APPROVER), createdAt (DateTime).
  - `ExpenseReport`: id (Int), title (String), dateFrom/dateTo (DateTime), status (ReportStatus enum), isArchived (Boolean), submittedAt/approvedAt/paidAt (DateTime?), createdAt/updatedAt (DateTime), ownerId (String, FK to User).
  - `ExpenseLine`: id (Int), reportId (Int, FK to ExpenseReport), date (DateTime), amount (Decimal 12,2), category (ExpenseCategory enum), description (String), createdAt/updatedAt.
  - `ReportApprover`: reportId (Int), approverId (String), assignedAt (DateTime). Composite PK on reportId + approverId.
  - `ReportHistory`: id (Int), reportId (Int), actorId (String), fromStatus (ReportStatus?), toStatus (ReportStatus), reason (String?), createdAt.
  - `Comment`: id (Int), reportId (Int), authorId (String), content (String), createdAt.
  - `StaleAlert`: id (Int), reportId (Int), approverId (String), dismissedAt (DateTime?), createdAt. Unique constraint on reportId + approverId.

- Which relationships are one-to-many, and which are many-to-many?
  - One-to-many: User-to-Reports, Report-to-Lines, Report-to-History, Report-to-Comments.
  - Many-to-many: Report-to-Approvers (User), modeled through the `ReportApprover` join table.

- Which constraints are enforced by the database, and which by application code — and why did you draw the line there?
  - Database enforces structural integrity: Foreign keys, uniqueness (email, stale alerts), valid enums (status, categories), composite PKs (no duplicate approvers).
  - Application code enforces business logic: State machine transitions (e.g., only DRAFT lines can be edited), approver eligibility (role=APPROVER), reasons for rejection. I drew the line here because complex cross-table constraints in Postgres require triggers, which are harder to version, test, and maintain than Express middleware logic.

- What did you deliberately denormalise?
  - I did *not* store a `total` column on `ExpenseReport`. Totals are always computed from `SUM(ExpenseLine.amount)`. Storing it would risk desynchronization.
  - The lifecycle timestamps (`submittedAt`, `approvedAt`, `paidAt`) are explicitly stored on `ExpenseReport` instead of requiring a join/subquery against `ReportHistory` for every dashboard query. This allows efficient indexing and stale-alert threshold queries.

- What would break first if this had 100x the data?
  - Computing the report total on the fly for thousands of reports at once (e.g., in a company-wide analytical query) would slow down. A materialized view or a strict trigger-based denormalized total might become necessary.
  - The `ReportHistory` table will grow the fastest since it is append-only.
