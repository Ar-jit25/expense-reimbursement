# Plan

This document records intended work before each phase and actual results after each phase.
It is a sequential historical record, not a summary written at the end.

---

## Phase 1 - Database Architecture

### Intended work
Establish the PostgreSQL and Prisma relational foundation supporting all domain requirements. No application logic is built in this phase - only schema.
1. Initialize backend project and dependencies.
2. Configure Prisma datasource to point at Supabase PostgreSQL.
3. Design and write schema covering all core models: User, ExpenseReport, ExpenseLine, ReportApprover, ReportHistory, Comment, StaleAlert.
4. Apply migrations and verify relations, indexes, and constraints.

### Actual results
- Constructed schema.prisma with seven core tables: User, ExpenseReport, ExpenseLine, ReportApprover, ReportHistory, Comment, StaleAlert.
- Standardized on Prisma 5.11.0 to avoid breaking changes in newer Prisma v7/v8 config formats.
- Applied migrations using prisma migrate dev to ensure reproducible migration history.

---

## Phase 2 - Authentication & Backend Authorization

### Intended work
Establish authenticated identity and server-side permissions using Supabase Auth and Express middleware.
1. Configure Supabase client and JWT verification middleware.
2. Implement role-based access control (requireRole) and resource ownership enforcement (requireResourceOwnership).
3. Verify unauthenticated requests are rejected and user roles (EMPLOYEE, APPROVER) are correctly resolved.

### Actual results
- Built requireAuth middleware validating bearer JWTs and resolving user profile from the database.
- Implemented requireRole for endpoint authorization and requireResourceOwnership for object-level security.
- Tested unauthenticated, employee, and approver access patterns with automated integration tests.

---

## Phase 3 - Reports & Expense Lines

### Intended work
Implement core CRUD functionality for expense reports and expense lines, strictly enforcing ownership and DRAFT lifecycle constraints.
1. Implement report endpoints: creation, listing, details view, update, archive/restore.
2. Implement expense line endpoints: add, edit, remove.
3. Enforce server-side dynamic calculation of total spend (never stored as a mutable column).
4. Restrict line item modifications exclusively to DRAFT reports.

### Actual results
- Built report and line controllers and services with strict ownership validation.
- Implemented dynamic total calculation using reduce on line amounts, avoiding state desynchronization.
- Enforced DRAFT-only mutations: updates to lines or report metadata on non-DRAFT reports return 400 Bad Request.

---

## Phase 4 - Report Lifecycle State Machine & Immutable History

### Intended work
Implement the state machine (DRAFT -> SUBMITTED -> APPROVED -> PAID, and SUBMITTED -> REJECTED -> DRAFT) with atomic transactions and immutable audit trails.
1. Add dedicated lifecycle RPC endpoints: /submit, /approve, /reject, /pay, /reset.
2. Implement requireNotReportOwner middleware preventing approvers from acting on their own submissions.
3. Wrap all state transitions and ReportHistory insertions inside Prisma transactions.
4. Require non-empty rejection reasons on rejection.

### Actual results
- Implemented explicit lifecycle endpoints with transition validation and timestamp updates.
- Encapsulated every status change and audit record insertion within prisma.$transaction blocks.
- Enforced rejection reason requirements and prevented self-approval at the controller/middleware layer.
- Validated lifecycle happy and failure paths across all states.

---

## Phase 5 - Approver Assignment & Queues

### Intended work
Implement approver assignment mechanisms and segregated workflow queues.
1. Create assignment management endpoints (POST/DELETE /api/reports/:id/assignments).
2. Implement query filtering for queues: queue=submitted (all submitted) and queue=assigned (assigned to approver).
3. Gate approval and rejection behind assigned-approver checks.

### Actual results
- Built idempotent approver assignment using upsert and graceful deletion handling.
- Implemented queue segregation in report.service.js: list query supports queue=submitted and queue=assigned, blocking employee access.
- Added requireAssignedApprover middleware to approval actions.

---

## Phase 6 - Server-Side Report Discovery

### Intended work
Implement search, filtering, sorting, and pagination without weakening security or queue boundaries.
1. Parse query parameters: page, limit, sort, order, status, search, ownerId, approverId.
2. Construct safe Prisma where clauses with AND arrays.
3. Build two-step query pipeline for sorting by derived total amounts.
4. Support conditional pagination wrapping for backward compatibility.

### Actual results
- Implemented robust multi-field filtering and full-text search across titles and descriptions.
- Built Authorized IDs Pipeline: fetches authorized IDs via Prisma, aggregates line sums via targeted parameterized SQL, and applies ordering/pagination.
- Maintained backward compatibility by returning raw arrays when pagination parameters are omitted.

---

## Phase 7 - React Frontend Dashboard & Workflows

### Intended work
Build a responsive React frontend for Employees and Approvers integrating with backend APIs.
1. Initialize Vite + React frontend with routing and authentication context.
2. Build unified API client handling token injection and response normalization.
3. Implement Dashboard, Create/Edit Report, and Approvals queue views.

### Actual results
- Initialized React application with client-side routing, modular components, and dark theme design system.
- Implemented apiClient with automatic Bearer token injection and error handling.
- Built comprehensive dashboards for employees and approvers with status badges, line items management, and filter controls.

---

## Phase 8 - Bulk Actions & CSV Export

### Intended work
Add bulk approval/rejection workflows and data export capabilities.
1. Implement POST /api/reports/bulk-approve and POST /api/reports/bulk-reject with per-item error handling.
2. Implement GET /api/reports/export-csv reusing service-layer authorization and filtering.

### Actual results
- Built bulk decision endpoints processing each report in isolated transactions, returning structured success and error summaries.
- Created CSV export endpoint streaming escaped RFC 4180 CSV data matching active filter criteria.
- Verified bulk actions and export permissions with automated integration tests.

---

## Phase 9 - Dashboard Analytics

### Intended work
Provide aggregate business metrics and spending trends for approvers.
1. Implement AnalyticsService computing KPIs, category breakdowns, and monthly spend history.
2. Visualize data in the frontend using chart components.

### Actual results
- Implemented GET /api/analytics returning total spend, pending review volume, category distribution, and trend series.
- Integrated Recharts visual components in AnalyticsOverview, ensuring employee requests receive proper authorization blocks.

---

## Phase 10 - Stale Report Detection & Alerts

### Intended work
Detect reports idling in SUBMITTED state and notify approvers.
1. Implement background calculation identifying reports submitted beyond the aging threshold.
2. Store alerts and expose endpoints for approvers to list and dismiss alerts.

### Actual results
- Created StaleAlert evaluation engine tracking unreviewed submitted reports.
- Added GET /api/alerts and POST /api/alerts/:id/dismiss endpoints with approver-only access.
- Integrated alert bell icon and notification list in the frontend.

---

## Phase 11 - Final Polish & E2E Audit

### Intended work
Comprehensive audit of functional requirements, data isolation, and user experience.
1. Audit validation rules across forms (date ordering, mandatory fields, enum alignment).
2. Polish Login page and navigation layouts.
3. Execute end-to-end authorization and privacy test suite.

### Actual results
- Standardized ExpenseCategory choices across frontend and backend.
- Added client-side date range validation and action guard states.
- Executed full test suite verifying employee data isolation and approver permissions.

---

## Phase 12 - Production Auth & Deployment

### Intended work
Finalize production authentication, strict authorization boundaries, and deployment configurations.
1. Remove auto-provisioning middleware to enforce strict RBAC.
2. Transition frontend from mock tokens to real Supabase Auth sessions.
3. Prepare production seed scripts and environment configs.

### Actual results
- Replaced auto-provisioning with strict 403 checks for unmapped identities.
- Swapped frontend authentication to supabase.auth.signInWithPassword with /api/me role resolution.
- Configured dynamic API URL environment handling and verified live end-to-end flows.

---

## Phase 13 - Category Auto-Assignment & Self-Approval Prevention Engine

### Intended work
Automatically route reports on submission based on category spend and prevent self-approval.
1. Aggregate line item spend by category during report submission.
2. Route report to designated approver based on highest spending category.
3. Automatically swap approvers if the assigned approver is also the report owner.

### Actual results
- Implemented deterministic category routing: Approver A handles Travel, Meals, Equipment; Approver B handles Accommodation, Supplies, Software, Other.
- Added conflict-of-interest swap ensuring report owners can never approve their own submissions.
- Added draft editing support enabling report updates prior to submission.

---

## Phase 14 - Global Submitted Queue with Action Restrictions

### Intended work
Provide approvers global visibility of all pending submissions while restricting decision rights to assigned reports.
1. Update queue=submitted to list all unarchived submitted reports across all submitters.
2. Restrict approve/reject actions exclusively to assigned approvers.

### Actual results
- Updated queue query to provide approvers full visibility of organization-wide submitted reports.
- Enforced action gating: non-assigned reports remain read-only with assignment badges in the UI.

---

## Phase 15 - Soft-Delete Archiving & Dedicated Restore Lifecycle

### Intended work
Allow non-destructive archiving of inactive expense reports with restore functionality.
1. Support isArchived flag on ExpenseReport.
2. Provide dedicated Active and Archived views in the frontend.
3. Exclude archived reports from active queues and stale alert computations.

### Actual results
- Added archiving and restore endpoints updating isArchived status.
- Built separate Active and Archived tabs in the dashboard with one-click restore.
- Filtered archived reports out of active queues, KPI analytics, and alert pipelines.

---

## Phase 16 - Stale Alert Recurrence Engine & Periodic Polling

### Intended work
Configure 5-day aging threshold for stale reports, 5-hour redisplay window after dismissal, and 5-hour client polling.
1. Configure STALE_THRESHOLD_DAYS=5 and REDISPLAY_THRESHOLD_HOURS=5 in environment settings.
2. Implement recurrence logic in alert evaluation.
3. Configure periodic client-side polling with manual refresh capability.

### Actual results
- Configured 5-day stale threshold and 5-hour redisplay window in backend services.
- Updated frontend alerts polling to 5 hours (18,000,000 ms) with manual Refresh button.
- Populated database seeds demonstrating aging calculations and recurring alert notifications.
