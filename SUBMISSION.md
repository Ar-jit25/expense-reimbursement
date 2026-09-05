# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/Ar-jit25/expense-reimbursement
- **Live application:** https://expense-reimbursement-eta.vercel.app/

## Notes for the reviewer

The backend is deployed on Render (free tier) and the frontend is hosted on Vercel. 
- Please note that on free tier instances, if the backend has been idle, the initial cold start request can take approximately 45-60 seconds to wake up. Subsequent requests respond immediately.
- The system uses real Supabase Auth identities for email/password authentication. The database has been pre-seeded with test accounts across both Employee and Approver roles.
- Some of the processes might take 20-30 seconds for completion, kindly be patient and allow the processes to complete.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Employee | emp@example.com | Employee1 |
| Employee 2 | emp2@example.com | Employee2 |
| Approver (Primary: Travel, Meals, Equipment) | app@example.com | Approver1 |
| Approver 2 (Primary: Accommodation, Supplies, Software, Other) | app2@example.com | Approver2 |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React (Vite), React Router, Recharts, Vanilla CSS | Fast HMR, clean client-side routing, responsive custom UI without heavy Tailwind dependencies, declarative charting for dashboard analytics. |
| Backend | Node.js, Express.js | Lightweight, fast HTTP middleware pipeline with straightforward asynchronous handling for atomic Prisma transactions and custom role guards. |
| Database | PostgreSQL (hosted on Supabase), Prisma ORM | Relational data integrity, schema-as-code migrations, exact monetary representation via DECIMAL(12,2), and compile-time type safety. |
| Hosting | Render (Backend API), Vercel (Frontend SPA) | Automated Git-driven continuous deployment, native environment variable configuration, and seamless SPA routing. |

## Goal checklist

Mark each honestly. Partial is fine - say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Supabase Auth email/password login. Strict backend RBAC separating EMPLOYEE and APPROVER roles. Enforced at API layer, never trusted from client. Approvers can submit their own claims but cannot approve their own. |
| 2 | Expense reports | Done | Reports belong to exactly one employee with title and date range. Full editing supported in DRAFT status. Non-destructive soft-delete archiving (isArchived) with dedicated Active and Archived dashboard views and one-click restore. |
| 3 | Expense lines | Done | Itemized lines with date, exact DECIMAL(12,2) amount, category enum, and description. Line additions, edits, and deletions are strictly restricted to DRAFT status. Report totals are computed dynamically on the server from line items and never stored. |
| 4 | Report lifecycle with rules | Done | Full state machine: DRAFT -> SUBMITTED -> APPROVED / REJECTED -> PAID, and REJECTED -> DRAFT for resubmission. Explicit RPC transition endpoints wrapped in atomic transactions with immutable history logging. Rejection requires a mandatory reason. Self-approval strictly forbidden. |
| 5 | Assigned approvers | Done | Many-to-many relationship via report_approvers join table with composite primary key. Automatic primary approver routing based on highest category expenditure, with automatic conflict-of-interest swap if submitter is the assigned approver. Segregated queues: global submitted queue and assigned-to-me queue. |
| 6 | Finding reports | Done | Full server-side search, filtering (status, owner, approver), sorting (date, status, and derived total spend), and pagination with total match counts. Utilizes Authorized IDs Pipeline for sorting by dynamic line totals. |
| 7 | Acting on many reports at once | Done | Dedicated bulk-approve and bulk-reject endpoints with independent per-report transaction processing. Detailed result payload identifying successful IDs and reports failed due to self-approval conflicts or state violations. RFC 4180 compliant CSV export for approved reimbursements awaiting payment. |
| 8 | A dashboard | Done | Approver landing dashboard displaying headline KPIs (awaiting approval, reimbursements due, approved this week, paid this week), category breakdown, status distribution, and 8-week trailing payment trends visualized using Recharts. Hidden for employee logins to preserve privacy. |
| 9 | History you cannot rewrite | Done | Append-only ReportHistory table recording previous status, new status, actor, timestamp, and rejection reason within atomic transactions. Separate immutable Comment table for user notes. Deletion and mutation strictly restricted (onDelete: Restrict). |
| 10 | Stale-approval alerts | Done | Background evaluation flagging SUBMITTED reports idling past 5 days. Navigation badge counter. Approvers can dismiss alerts for assigned reports. Alerts recur if the report remains unreviewed after a 5-hour window. Frontend polls periodically (every 5 hours) with manual refresh support. |


## Stretch Features Implemented

1. **A Mileage Calculator for Vehicle Expense Lines:**
   - Integrated directly into both the Create Report and Edit Report workflows via an interactive modal.
   - Calculates exact reimbursements based on distance driven and standard mileage rates ($0.67/mile).
   - Automatically populates the line item amount, sets category to `TRAVEL`, and appends route details and trip notes to the description.

2. **Per-Category Spending Limits & Policy Warnings:**
   - Configured company spending guidelines across categories (e.g. Meals $75, Accommodation $250, Travel $350, Software $200, Equipment $500, Supplies $100).
   - **For Employees:** When an entered amount exceeds the limit, displays an amber advisory warning: *"Exceeds $[limit] limit - Kindly document the reason in the description."*
   - **In Approver Queues & Dashboard:** Reports containing over-limit expenses display an explicit `[WARNING] Over Budget` badge beside the report title for instant triaging.
   - **In Report Details:** Prominently alerts approvers with a policy scrutiny banner and individual line-by-line compliance badges (`Exceeds limit` vs `Within Policy`).

## How much time did you actually spend?

Approximately 14-16 hours total, divided across incremental milestones: schema design & migrations, authentication & authorization middleware, core CRUD services, state machine & audit trails, React frontend & responsive UI polish, bulk operations & discovery engine, deployment configuration, and rigorous documentation & byte-level encoding audits.

## What would you do next, with another 12 hours?

1. **Direct Receipt Photo Uploads & OCR Extraction:** Integrate Supabase Storage bucket for receipt image uploads with automated OCR parsing (e.g. Google Cloud Vision API or Tesseract) to prefill expense line date, amount, and vendor.
2. **Materialized View / Database Views for Aggregations:** Transition dynamic total calculation and sort-by-total from the two-step Authorized IDs Pipeline into a PostgreSQL indexed view or CTE for sub-millisecond sorting across millions of records.
3. **Multi-Level Approval Chains & Escalation Thresholds:** Implement tiered approval policies (e.g., reports over $5,000 require secondary executive approval).
4. **Automated Worker Queue for Alert Evaluations:** Offload stale alert checks from HTTP request interceptors into a background scheduled job (using BullMQ or pg_cron).

## What are you least happy with in this codebase, and why?

The derived total sorting implementation on the server. Because report totals are dynamically calculated from child line items and never stored as a mutable column (to prevent state drift), Prisma cannot natively sort parent reports by an aggregate sum while applying pagination. To solve this securely, we built a two-step "Authorized IDs Pipeline" that selects matching report IDs in Prisma and passes them into a parameterized raw SQL aggregation query. While mathematically pure, robust, and safe for current volume, it introduces additional query complexity that would need to be replaced with a materialized database view or Common Table Expression at 100x scale.
