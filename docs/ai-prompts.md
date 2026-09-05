# AI prompts

The prompts you actually used, in the order you used them, grouped by what you were trying to achieve. For each significant one: what you asked, what you got back, and what you had to correct.

Include at least one prompt that produced something wrong, and what you did about it.

If you did not use AI at all, say so here, and describe your process instead.

# Documentation was assisted with AI as well
---

## 1. Initial Database Schema & ORM Foundation

### Prompt
Initialize the backend project and design a complete schema.prisma file representing all core entities for an expense reimbursement system: Users with roles (EMPLOYEE, APPROVER), ExpenseReports with lifecycle statuses (DRAFT, SUBMITTED, APPROVED, REJECTED, PAID), itemized ExpenseLines with monetary amounts and categories, ReportApprover join table, immutable ReportHistory audit log, Comments, and StaleAlerts. Use Supabase PostgreSQL.

### What you got
The AI scaffolded the schema and attempted to install the latest Prisma CLI/Client packages (v7/v8), while including a persisted `total` column directly on `ExpenseReport`.

### What you corrected
Prisma v7 introduced breaking configuration changes with `url` in datasource blocks. We downgraded to stable Prisma v5.11.0. Crucially, the persisted `total` column was removed from `ExpenseReport` to enforce the architectural rule that report totals must always be dynamically computed on read from line items to eliminate data desynchronization.

---

## 2. Authentication & Role-Based Middleware

### Prompt
Implement backend authentication middleware in Express that validates Supabase bearer JWTs, loads the application profile from the database, and exposes role-check helpers (requireRole, requireResourceOwnership) to gate endpoints.

### What you got
An Express middleware (`auth.js`) that called Supabase auth to verify tokens and used `prisma.user.upsert` to auto-create user profiles on the fly if their ID wasn't already in the database.

### What you corrected
While convenient for initial local testing, auto-provisioning completely bypassed organizational access control. Later in Phase 12, we reversed this: users not pre-seeded in the database are rejected with `403 Forbidden`, ensuring uninvited users cannot self-register.

---

## 3. Core Report & Expense Line CRUD Services

### Prompt
Build RESTful CRUD endpoints for ExpenseReports and child ExpenseLines using a layered Route-Controller-Service architecture. Restrict all modifications exclusively to DRAFT reports.

### What you got
Working CRUD operations with Prisma transactions, but line creation and updates allowed arbitrary string categories and floating-point math for expense amounts.

### What you corrected
Enforced strict PostgreSQL enum validation for `ExpenseCategory` (TRAVEL, MEALS, ACCOMMODATION, etc.) and converted all currency handling to `Decimal(12, 2)` to prevent IEEE 754 floating-point inaccuracies. Added explicit checks preventing line modifications once status advances past DRAFT.

---

## 4. State Machine Lifecycle RPC Endpoints & Atomic Audit Trail

### Prompt
Implement the financial lifecycle state machine with explicit RPC endpoints (/submit, /approve, /reject, /pay, /reset) rather than a generic PATCH endpoint. Enforce atomic updates and an immutable ReportHistory audit trail. Require a non-empty reason when rejecting.

### What you got
The AI implemented the endpoints and checked status preconditions, but each database operation was executed in separate queries (`update` followed by `create` in ReportHistory).

### What you corrected
Wrapped each state transition and audit insertion into a single `prisma.$transaction` block so that failures in writing audit logs roll back the status update. Enforced `requireNotReportOwner` so approvers cannot approve their own claims.

---

## 5. Approver Assignment & Segregated Queues

### Prompt
Implement approver assignment management endpoints and add queue query filtering to /api/reports: queue=submitted for all pending submissions, and queue=assigned for reports assigned to the calling approver. Ensure employees cannot access approver queues.

### What you got
The AI created the endpoints and queue filters, but repeated assignments caused duplicate key errors, and employees passing `?queue=submitted` received an empty list instead of a security rejection.

### What you corrected
Switched assignment insertion to an idempotent `upsert` and handled `P2025` errors on unassignment. Added explicit role-check gates that return `403 Forbidden` if an employee attempts to query approver queues.

---

## 6. Server-Side Filtering, Discovery & Derived-Total Sorting

### Prompt
Implement server-side search, filtering, and pagination on /api/reports. Include sorting by derived report total amount without storing a total column in the database.

### What you got (The "Wrong" Output)
The AI initially attempted to do `orderBy: { lines: { _sum: { amount: 'desc' } } }` inside Prisma, which failed with runtime errors because Prisma does not support ordering by aggregate sums across relations during paginated queries.

### What you corrected
Designed the **Authorized IDs Pipeline**: a two-step query where Prisma first retrieves the authorized report IDs matching current filter criteria, followed by a targeted parameterized raw SQL query (`$queryRaw`) that performs `SUM(lines.amount)`, `ORDER BY`, and `LIMIT/OFFSET` strictly within those vetted IDs.

---

## 7. React Frontend Architecture & Client-Side Routing

### Prompt
Scaffold the React frontend with Vite, Tailwind-free vanilla CSS design system, client-side routing (react-router-dom), and an ApiClient that injects auth tokens into all outbound requests.

### What you got
A Vite setup with functional routing, but API responses were handled inconsistently because unpaginated endpoints returned arrays while paginated endpoints returned `{ data, total, page, limit }`.

### What you corrected
Built a response normalizer inside `reports.js` that standardizes polymorphic backend payloads into a consistent data structure, preventing undefined errors across dashboard views.

---

## 8. Bulk Approval & Bulk Rejection with Isolated Errors

### Prompt
Implement /api/reports/bulk-approve and /api/reports/bulk-reject allowing approvers to process multiple reports simultaneously. Ensure that a failure on one report (e.g., self-approval conflict) does not abort the entire batch.

### What you got
The AI wrapped the entire array loop inside a single database transaction, causing the entire batch to fail if even one report was invalid.

### What you corrected
Refactored the loop to process each report in its own independent `try/catch` block with a per-item transaction, collecting structured success and failure arrays (`{ successIds: [], failedIds: [{ id, reason }] }`) so valid reports succeed while invalid ones report clear error feedback.

---

## 9. RFC 4180 CSV Report Export

### Prompt
Add a backend endpoint /api/reports/export-csv that streams expense reports and itemized lines as a CSV download, strictly reusing existing service authorization and filters.

### What you got
A basic CSV generator that concatenated strings without escaping commas, quotes, or newlines in descriptions.

### What you corrected
Implemented an RFC 4180 compliant escaping routine that wraps fields containing commas, double quotes, or newlines in quotes, and escapes embedded quotes as `""`. Configured appropriate HTTP response headers (`Content-Type: text/csv`, `Content-Disposition`).

---

## 10. Approver Analytics Dashboard & Aggregations

### Prompt
Create an AnalyticsService and frontend view (using Recharts) to display KPI summary metrics, category spend distribution, and historical monthly trends for approvers.

### What you got
The AI returned analytics calculations, but the endpoint was left accessible to employees, and the frontend pie chart cycled duplicate colors across different categories.

### What you corrected
Gated the analytics endpoint strictly behind `requireRole('APPROVER')`. In the frontend, hid the Analytics component entirely for employee logins and mapped unique, fixed visual hex colors per category (e.g. pink for Equipment, black for Other) so categories remain clearly distinguishable.

---

## 11. Stale Alert Evaluation & Recurrence Engine

### Prompt
Build a stale alert detection system for unreviewed submitted reports older than 5 days, with an approver dismissal feature and a 5-hour recurrence window. Add client-side polling every 5 hours.

### What you got (The "Wrong" Output)
The AI originally attempted to add an `isStale: Boolean` column to `ExpenseReport` updated by a nightly cron job, and suggested pushing alerts via WebSockets.

### What you corrected
Completely rejected persistent mutable boolean flags and WebSockets. Created a dedicated `StaleAlert` table with composite key `[reportId, approverId]` and `dismissedAt`. Evaluated staleness dynamically based on `submittedAt` and `redisplayThreshold`. Configured the frontend with a 5-hour polling timer and a manual Refresh button.

---

## 12. Dynamic Category-Based Approver Routing

### Prompt
Implement automatic routing upon report submission: calculate which category has the highest total expenditure, assign Approver A if Travel/Meals/Equipment, or Approver B if Accommodation/Supplies/Software/Other.

### What you got
The logic assigned the designated approver, but if an approver submitted their own expense report and the category pointed to them, they were assigned to their own report.

### What you corrected
Implemented an automatic conflict-of-interest swap: if the designated approver is identical to the report owner, the system automatically swaps assignment to the alternate approver, preserving self-approval boundaries without user intervention.

---

## 13. Global Submitted Queue with Action Gating

### Prompt
Update the approver queue so that all approvers have complete visibility over all submitted reports in the organization, but can only approve or reject reports specifically assigned to them.

### What you got
The backend query returned all submitted reports, but the frontend detail view crashed with `ReferenceError: showRejectInput is not defined` when interacting with queue action buttons.

### What you corrected
Fixed missing state variable definitions in the React component. Added clear UI badges distinguishing assigned reports from unassigned reports, and disabled review action buttons on unassigned reports with explanatory tooltips.

---

## 14. Soft-Delete Archiving & Dedicated Restore Lifecycle

### Prompt
Implement a non-destructive archiving mechanism for expense reports with separate Active and Archived dashboard views and a one-click restore action.

### What you got
The AI suggested setting status to a new enum value `ARCHIVED`, which collided with the financial state machine (e.g., losing whether an archived report was originally PAID or DRAFT).

### What you corrected
Added an independent boolean flag `isArchived` to `ExpenseReport`. Archived reports retain their original lifecycle status (e.g., PAID), are excluded from active queues and alert calculations, and can be safely restored via `PUT /api/reports/:id/restore`.

---

## 15. Form Validation, Date Ordering & Enum Synchronization

### Prompt
Audit frontend forms and fix input validation gaps on CreateReport and EditReport. Ensure date ranges are logically consistent and category enums match the backend exactly.

### What you got
Frontend dropdowns used legacy values like `OFFICE_SUPPLIES`, which caused database insert rejections because the Prisma enum only accepted `SUPPLIES`. Date inputs also allowed `dateTo` to precede `dateFrom`.

### What you corrected
Synchronized the dropdown options with the Prisma `ExpenseCategory` enum. Added client-side and server-side validation ensuring `dateFrom <= dateTo` and disabled submission buttons when mandatory fields or line items are missing.

---

## 16. Production Supabase Auth Migration & Strict Identity Verification

### Prompt
Transition the application from local mock development tokens to real Supabase Auth email/password login and wire up the /api/me role resolution endpoint.

### What you got
After deploying to production, login attempts failed with `403 Forbidden: Access denied: your account is not authorized to access this application` because the seed script had inserted mock UUIDs rather than the real Supabase Auth user IDs.

### What you corrected
Created `seed-production.js` which queries the live Supabase Auth service (or accepts real user UUIDs) and populates the database records to match the real authentication identities, establishing a clean bridge between Supabase AuthN and application AuthZ.

---

## 17. Production CORS & Environment Variable Configuration

### Prompt
Configure Express CORS handling and Vite client API environment variables for multi-platform deployment on Render and Vercel.

### What you got
The backend threw `Error: Not allowed by CORS at origin` when accessed from the Vercel deployment URL, and an accidental trailing backslash in the configured URL caused origin mismatch.

### What you corrected
Rewrote the CORS origin validator to parse allowed domains dynamically from `FRONTEND_URL`, stripping trailing slashes and supporting local dev environments simultaneously. Configured `VITE_API_URL` across client builds.

---

## 18. Elimination of Non-ASCII and Control Characters from Documentation

### Prompt
Audit the documentation files (architecture.md, study.md, submission.md, etc.) for corrupted characters (such as "piClient.js" instead of "apiClient.js", malformed bullets, or invisible BOM markers) and fix them.

### What you got
Automated regex scripts stripped some characters, but PowerShell UTF-8 encoding wrote invisible 3-byte UTF-8 Byte Order Marks (BOM) and non-breaking spaces into several markdown files.

### What you corrected
Wrote dedicated Node.js cleanup scripts to inspect files byte-by-byte, strip UTF-8 BOM markers (`0xEF, 0xBB, 0xBF`), replace typographical symbols with pure standard ASCII (hyphens, regular quotes), and verify 0 non-ASCII occurrences.

---

## 19. Seed Alert Recurrence & Polling Interval Adjustments

### Prompt
Update the stale alert engine intervals: initially set to 5 minutes for rapid testing, then adjust to production specifications (5 days for report aging, 5 hours for alert recurrence, and 5 hours for client polling).

### What you got
The backend environment variables were updated, but the frontend components (`AlertsBadge.jsx`, `Alerts.jsx`) still had hardcoded 15-second polling intervals left over from debugging.

### What you corrected
Aligned both frontend timer intervals and backend threshold constants to 5 hours (`18,000,000 ms`), and added a manual "Refresh" button to the Alerts interface so users can trigger an immediate database re-check without waiting for the timer.

---

## 20. Production Hygiene & Repository Cleanliness

### Prompt
Clean up temporary files, test scripts, and scratch artifacts from the repository before final submission, ensuring only clean source code and required documentation are tracked.

### What you got
Earlier git pushes inadvertently included temporary testing scripts (`verify-phase*.js`, `test-*.js`) and local scratch folders that were not intended for the production repository.

### What you corrected
Removed non-essential test and fix scripts from the git index, updated `.gitignore` to exclude temporary directories and debug artifacts, and verified that only the official application code, Prisma migrations, and documentation remain tracked.
