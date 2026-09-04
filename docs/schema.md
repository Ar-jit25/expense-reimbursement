# Schema

Answer each of these, in your own words.

- Table by table: what columns and types does each one have?
  - `User`: 
    - `id` (String, PK): Matches the Supabase Auth UUID.
    - `email` (String, unique): User's email address.
    - `name` (String, optional): Display name (e.g., "Alice (Employee)").
    - `role` (Role enum): Either `EMPLOYEE` or `APPROVER`.
    - `createdAt` (DateTime): Record creation timestamp.
  - `ExpenseReport`: 
    - `id` (Int, PK, autoincrement): Internal report ID.
    - `title` (String): Brief description.
    - `dateFrom`, `dateTo` (DateTime): Period covered.
    - `status` (ReportStatus enum): `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, or `PAID`.
    - `isArchived` (Boolean): Soft deletion flag.
    - `submittedAt`, `approvedAt`, `paidAt` (DateTime, optional): Lifecycle timestamps for analytics.
    - `createdAt`, `updatedAt` (DateTime): Standard record keeping.
    - `ownerId` (String): Foreign key to `User.id` (who owns the report).
  - `ExpenseLine`: 
    - `id` (Int, PK, autoincrement): Internal line item ID.
    - `reportId` (Int): Foreign key to `ExpenseReport.id`.
    - `date` (DateTime): Date of the expense.
    - `amount` (Decimal): Monetary value.
    - `category` (ExpenseCategory enum): `TRAVEL`, `MEALS`, `ACCOMMODATION`, `SUPPLIES`, `SOFTWARE`, `EQUIPMENT`, `OTHER`.
    - `description` (String): Line item detail.
    - `createdAt`, `updatedAt` (DateTime): Standard record keeping.
  - `ReportApprover`: 
    - `reportId` (Int): Foreign key to `ExpenseReport.id`.
    - `approverId` (String): Foreign key to `User.id`.
    - `assignedAt` (DateTime): Assignment timestamp.
    - *Note:* Composite Primary Key on `reportId` + `approverId`.
  - `ReportHistory`: 
    - `id` (Int, PK, autoincrement): History record ID.
    - `reportId` (Int): Foreign key to `ExpenseReport.id`.
    - `actorId` (String): Foreign key to `User.id` (who made the change).
    - `fromStatus` (ReportStatus, optional): Previous state.
    - `toStatus` (ReportStatus): New state.
    - `reason` (String, optional): Explanation for the change (e.g., rejection reason).
    - `createdAt` (DateTime): History entry timestamp.
  - `Comment`:
    - `id` (Int, PK, autoincrement): Comment ID.
    - `reportId` (Int): Foreign key to `ExpenseReport.id`.
    - `authorId` (String): Foreign key to `User.id`.
    - `text` (String): The comment body.
    - `createdAt` (DateTime): Comment timestamp.
  - `StaleAlert`:
    - `id` (Int, PK, autoincrement): Alert ID.
    - `reportId` (Int): Foreign key to `ExpenseReport.id`.
    - `approverId` (String): Foreign key to `User.id`.
    - `dismissedAt` (DateTime, optional): When the approver dismissed the alert.

- Where are the relations? E.g. what has a foreign key to what?
  - `ExpenseReport.ownerId` -> `User.id` (One-to-Many: User has many Reports).
  - `ExpenseLine.reportId` -> `ExpenseReport.id` (One-to-Many: Report has many Lines).
  - `ReportApprover.reportId` -> `ExpenseReport.id` and `ReportApprover.approverId` -> `User.id` (Many-to-Many relationship between Reports and Approvers).
  - `ReportHistory.reportId` -> `ExpenseReport.id` and `ReportHistory.actorId` -> `User.id` (One-to-Many: History links a report and an actor).
  - `Comment.reportId` -> `ExpenseReport.id` and `Comment.authorId` -> `User.id` (One-to-Many: Comment links a report and an author).
  - `StaleAlert.reportId` -> `ExpenseReport.id` and `StaleAlert.approverId` -> `User.id` (One-to-Many).

- How does the database guarantee that `ReportHistory.fromStatus` is actually the state that the report was in, before it was changed to `toStatus`?
  - The database itself does not guarantee this at the schema level because `fromStatus` and `toStatus` are just columns recorded at insertion time. The guarantee is enforced at the **Application/Service Layer**. When the service changes a report's status, it uses a transactional Prisma operation (``) to read the old status, update the `ExpenseReport` record, and create the `ReportHistory` record simultaneously, ensuring the values recorded in `fromStatus` strictly reflect the old state of the report.

- Look at the relationship between `ExpenseReport` and `ReportApprover`. Is it possible for a report to have no approver? Or to have 2 approvers? Where is that constrained?
  - **Yes**, it is structurally possible for a report to have 0 or 2 approvers. The Prisma schema defines a one-to-many relationship from `ExpenseReport` to `ReportApprover`, which intrinsically allows any number of approver assignments. 
  - The constraint is enforced in the **Service Layer** (e.g., `report.service.js`) during report submission. The business logic maps rules (like randomly selecting an approver or picking the employee's manager) and creates exactly one (or multiple) `ReportApprover` records during the `` that shifts the report to `SUBMITTED`.

- Is it possible for an `ExpenseLine` to be created without an `ExpenseReport`? Where is that constrained?
  - **No**, it is not possible. In the Prisma schema, `ExpenseLine` defines `reportId` as a required (non-nullable) integer field `reportId Int`. The database schema enforces a foreign key constraint, making it impossible to insert an `ExpenseLine` without a valid, existing `ExpenseReport` ID.
