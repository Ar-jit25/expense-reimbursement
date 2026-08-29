# Plan — Expense Reimbursement

## Overview

**Start date:** August 29, 2026  
**Hard deadline (code + deployment complete):** September 5, 2026  
**Total calendar days:** 7  
**Daily time budget:** ~3–4 hours per day (higher than the assignment's suggested 2h/day to account for learning curve on a brand-new stack)  
**Total estimated hours:** ~22–26 hours  

Stack chosen: React + Vite (frontend), Node.js + Express (backend), PostgreSQL (database), Prisma (ORM), JWT + bcrypt (auth), Tailwind CSS (UI), Recharts (charts), deployed to Vercel + Render + Supabase.

All 10 goals in the brief are in scope. No stretch goals are planned — every hour goes toward completing the 10 solidly.

---

## Why this order?

The build order follows dependency chains, not complexity or excitement:

1. **Environment first** — You cannot write any code until you know what tools you have and how they fit together. A wasted hour here saves four wasted hours later.
2. **Database schema before any API** — Every endpoint either reads or writes to a table. Designing the schema first means APIs never need to be rewritten because a column is missing.
3. **Auth before any other API** — Almost every route needs to know who is calling it and what role they have. Auth middleware, once working, can be reused everywhere.
4. **Backend before frontend** — The frontend is just a consumer of the API. Building APIs first lets you test them with curl/Postman without needing a UI, and means the frontend never blocks on a missing endpoint.
5. **Core CRUD before advanced features** — Reports and lines must work before lifecycle transitions, which must work before bulk actions, which must work before the dashboard.
6. **Frontend last** — React pages wire up to finished API endpoints. There is nothing worse than building a form and then discovering the endpoint it calls does not exist yet.
7. **Deployment last** — Deploying a half-built app wastes time. Deploy once everything runs locally, then fix environment-specific issues.

---

## Phase 1 — Environment Setup + Stack Orientation
**Date:** August 29–30  
**Estimated time:** 4–5 hours  
**Goal:** Every tool installed, every "Hello World" running, every concept understood well enough to use.

### Session 1A — Install everything (Aug 29, ~2h)

**What to do:**
1. Install Node.js (LTS, v20+) from nodejs.org — this also installs npm.
2. Verify: `node -v` and `npm -v` both print version numbers.
3. Install Git if not already present. Verify: `git --version`.
4. Create the public GitHub repository now (empty, with a README). Push any commit immediately so the timeline starts.
5. Clone the repo locally and move the existing `docs/` folder and starter files into it.
6. Install VS Code extensions: Prettier, ESLint, Prisma, Tailwind CSS IntelliSense.
7. Create a free Supabase account at supabase.com. Create a new project. Note down the database connection string (from Project Settings → Database → Connection String → URI mode). You will need both the pooled string (port 6543, Transaction mode) and the direct string (port 5432). These go in your `.env` later.
8. Create a free Render account at render.com (for the backend).
9. Create a free Vercel account at vercel.com (for the frontend).

**What to understand during this session:**
- Why Node.js: JavaScript on the server, same language as the browser.
- Why Supabase: Free managed PostgreSQL with a web UI to browse tables, no need to install PostgreSQL locally.
- Why Vercel and Render: Free hosting with zero-config deploys from GitHub.

**Commit message:** `chore: add initial docs stubs and project structure`

---

### Session 1B — Learn the stack concepts (Aug 29–30, ~2h)

Spend this time reading (not coding). For each technology, read just enough to understand what it does and why this project uses it. Do not try to memorise APIs — that comes when you write code.

**Node.js + Express (30 min)**
- Node.js runs JavaScript outside the browser. It handles HTTP requests.
- Express is a thin wrapper that makes it easy to define routes like `GET /api/reports`.
- Read: express.js.com "Getting started" Hello World example. Run it locally. Understand: `app.get()`, `req`, `res`, `res.json()`, middleware.

**Prisma + PostgreSQL (30 min)**
- PostgreSQL is a relational database. Tables, rows, columns, foreign keys.
- Prisma is an ORM — instead of writing SQL, you write JavaScript/TypeScript and Prisma translates it.
- Read: prisma.io/docs Quickstart. Understand: `schema.prisma`, `model`, `prisma migrate`, `prisma.findMany()`.

**JWT + bcrypt auth (20 min)**
- bcrypt hashes passwords — stores a scrambled version so you never store plain text.
- JWT (JSON Web Token) is a signed string the server gives the client on login. The client sends it on every future request. The server checks the signature to know who the caller is without hitting the database.
- Understand: why you cannot store passwords as plain text. What "stateless auth" means.

**React + Vite (30 min)**
- React: a library for building UIs out of reusable "components" (functions that return HTML-like JSX).
- Vite: a fast development server and build tool. Replaces Create React App.
- Read: react.dev Quick Start. Understand: `useState`, `useEffect`, `props`, component tree.

**Tailwind CSS (10 min)**
- Utility-first CSS: instead of writing `.card { padding: 16px }`, you write `className="p-4"`.
- Every class does one thing. You compose them.

**Recharts (10 min)**
- A charting library built on top of React. You pass data arrays to components like `<LineChart>` and it renders SVG charts.

**Commit message:** `docs: update plan.md with phase 1 details`

---

### Estimated vs actual (fill in after the session)
| Session | Estimated | Actual |
|---------|-----------|--------|
| 1A — Setup | 2h | |
| 1B — Orientation | 2h | |

---

## Phase 2 — Database Schema + Project Scaffolding + Auth
**Date:** August 30–31  
**Estimated time:** 5–6 hours  
**Goal:** A running backend with a seeded database, user registration and login working and tested.

### Session 2A — Backend scaffold + Prisma schema (Aug 30, ~2.5h)

**What to do:**

1. Scaffold the backend:
   ```
   mkdir backend && cd backend
   npm init -y
   npm install express prisma @prisma/client bcryptjs jsonwebtoken cors dotenv
   npm install --save-dev nodemon
   npx prisma init
   ```

2. Create the folder structure:
   ```
   backend/
   ├── prisma/
   │   └── schema.prisma
   ├── src/
   │   ├── index.js
   │   ├── middleware/
   │   │   └── auth.js
   │   ├── routes/
   │   │   ├── auth.js
   │   │   ├── reports.js
   │   │   ├── lines.js
   │   │   ├── approvers.js
   │   │   ├── dashboard.js
   │   │   └── alerts.js
   │   └── controllers/
   │       ├── auth.js
   │       ├── reports.js
   │       ├── lines.js
   │       ├── approvers.js
   │       ├── dashboard.js
   │       └── alerts.js
   ├── .env
   └── package.json
   ```

3. Write the Prisma schema. The core models are:
   - `User` — id, email, passwordHash, role (EMPLOYEE | APPROVER), createdAt
   - `ExpenseReport` — id, title, dateFrom, dateTo, status (DRAFT | SUBMITTED | APPROVED | REJECTED | PAID), ownerId (FK to User), isArchived, createdAt, updatedAt
   - `ExpenseCategory` — enum: TRAVEL, MEALS, ACCOMMODATION, SUPPLIES, SOFTWARE, OTHER
   - `ExpenseLine` — id, reportId (FK), date, amount (Decimal), category (enum), description, createdAt
   - `ReportApprover` — reportId, approverId (composite PK) — the join table for the many-to-many relationship
   - `AuditEntry` — id, reportId (FK), actorId (FK to User), fromStatus, toStatus, reason, comment, createdAt
   - `StaleAlert` — id, reportId (FK), approverId (FK), dismissedAt, createdAt

4. Set `DATABASE_URL` in `.env` to your Supabase direct connection string (port 5432).
5. Run `npx prisma db push` to create the tables.
6. Open Supabase → Table Editor to verify the tables exist.

**Why these models, explained:**
- `isArchived` is a boolean on `ExpenseReport`, not a separate status, because archived is not a lifecycle stage — it is a visibility toggle. A report can be Approved AND archived.
- `AuditEntry` is append-only by design. There is no update or delete route for it, ever.
- `StaleAlert` stores when an alert was dismissed so the system knows when to re-show it.
- `total` is NOT stored on `ExpenseReport`. It is always computed as SUM(lines.amount) in a query. Storing it would create a sync problem.
- `ReportApprover` is a join table (many-to-many). A report can have multiple assigned approvers. An approver can be assigned to many reports.

**Commit message:** `feat: add prisma schema with all models`

---

### Session 2B — Auth API (Aug 31, ~2.5h)

**What to do:**

1. Write `src/index.js` — Express app with cors, `express.json()`, and route mounts.
2. Write `src/middleware/auth.js` — reads the `Authorization: Bearer <token>` header, verifies the JWT signature, attaches `req.user = { id, email, role }` to the request, calls `next()` if valid or returns 401 if not.
3. Write `src/routes/auth.js` and `src/controllers/auth.js`:
   - `POST /api/auth/register` — validate email/password, hash password with bcrypt (cost factor 12), create user, return JWT.
   - `POST /api/auth/login` — find user by email, `bcrypt.compare()` the password, return JWT if match or 401 if not.
   - `GET /api/auth/me` — protected route, returns the logged-in user's profile from `req.user`.
4. Add package.json scripts: `"dev": "nodemon src/index.js"`.
5. Test every route with Postman or curl. Verify that:
   - Registering with a duplicate email returns an error.
   - Logging in with wrong password returns 401.
   - Calling `/api/auth/me` without a token returns 401.
   - Calling `/api/auth/me` with a valid token returns your user.

**Why bcrypt and not MD5/SHA?**
MD5 and SHA are fast hash functions — good for checksums, bad for passwords because a GPU can try billions per second. bcrypt is slow by design (cost factor 12 means ~100ms per hash) which makes brute-force attacks impractical.

**Why JWT and not sessions?**
Sessions store state on the server (in memory or a database). JWT is stateless — the server does not need to remember anything. This makes it trivial to scale to multiple backend instances later.

**Commit message:** `feat: auth register, login, and me routes with JWT + bcrypt`

---

### Estimated vs actual
| Session | Estimated | Actual |
|---------|-----------|--------|
| 2A — Schema | 2.5h | |
| 2B — Auth API | 2.5h | |

---

## Phase 3 — Core Backend: Reports, Lines, Lifecycle
**Date:** September 1  
**Estimated time:** 5–6 hours  
**Goal:** Full CRUD for expense reports and lines, complete lifecycle state machine, audit entries, assigned approvers.

### Session 3A — Reports CRUD + Line Items (Sep 1, ~3h)

**What to do:**

1. Write report routes and controllers:
   - `GET /api/reports` — list reports the caller can see (employee sees only their own; approver sees all non-archived), with server-side search (`?search=`), filter (`?status=`, `?ownerId=`, `?approverId=`), sort (`?sort=submittedAt|status|total`, `?order=asc|desc`), and pagination (`?page=`, `?limit=`). Return `{ data, total, page, limit }`.
   - `POST /api/reports` — create a new DRAFT report for the logged-in user.
   - `GET /api/reports/:id` — get one report with its lines, audit timeline, and assigned approvers. Enforce ownership (employee can only fetch their own).
   - `PATCH /api/reports/:id` — edit title and date range. Only allowed if status is DRAFT and caller is owner.
   - `PATCH /api/reports/:id/archive` — toggle isArchived. Only allowed if caller is owner.
   - `DELETE /api/reports/:id` — delete a DRAFT report. Only DRAFT reports can be deleted.

2. Write line item routes and controllers:
   - `POST /api/reports/:id/lines` — add a line. Only if status is DRAFT and caller is owner.
   - `PATCH /api/reports/:id/lines/:lineId` — edit a line. Same guards.
   - `DELETE /api/reports/:id/lines/:lineId` — remove a line. Same guards.

3. For every write that succeeds, verify the caller's access rights at the top of the controller function, before touching the database. Never trust the frontend to enforce rules.

**The server-side filtering query (important to understand):**

The `GET /api/reports` endpoint builds a Prisma `where` object dynamically. If the user is an employee, `ownerId` is always forced to their own id. Filters from query params are added on top. The query runs two operations in a transaction: `findMany` with skip/take for pagination, and `count` with the same `where` to get the total. Both results go back in one response so the frontend knows how many pages there are.

**Commit message:** `feat: reports CRUD and expense line CRUD with server-side guards`

---

### Session 3B — Lifecycle state machine + Audit + Assigned approvers (Sep 1, ~2.5h)

**What to do:**

1. Write `PATCH /api/reports/:id/submit`:
   - Guard: caller must be the owner. Status must be DRAFT.
   - Transition: set status to SUBMITTED.
   - Write an AuditEntry: `{ fromStatus: DRAFT, toStatus: SUBMITTED, actorId: caller.id }`.

2. Write `PATCH /api/reports/:id/approve`:
   - Guard: caller must have role APPROVER. Status must be SUBMITTED.
   - **Self-approval guard**: if `report.ownerId === caller.id`, return 403 with the message "Approvers cannot approve their own reports."
   - Transition: set status to APPROVED.
   - Write AuditEntry.

3. Write `PATCH /api/reports/:id/reject`:
   - Guard: APPROVER, SUBMITTED, not own report.
   - Require `reason` in request body. If missing, return 400.
   - Transition: status back to DRAFT.
   - Write AuditEntry with reason.

4. Write `PATCH /api/reports/:id/mark-paid`:
   - Guard: APPROVER, status must be APPROVED (not SUBMITTED — cannot skip ahead).
   - Transition: PAID.
   - Write AuditEntry.

5. Write `POST /api/reports/:id/approvers` — assign an approver to a report (create a ReportApprover row). Guard: caller is APPROVER or owner.
6. Write `DELETE /api/reports/:id/approvers/:approverId` — remove assignment.
7. Write `POST /api/reports/:id/comments` — comments are AuditEntry rows with `fromStatus = null` and `toStatus = null` (they are not transitions, just notes).

**Why transitions write AuditEntry inside the same database transaction as the status update:**
If the status update succeeds but the audit entry fails (e.g., network blip), you have a status change with no record of who did it. Prisma's `$transaction()` ensures both writes happen or neither does.

**Commit message:** `feat: report lifecycle transitions and immutable audit timeline`

---

### Session 3C — Bulk actions + CSV export (Sep 1, ~0.5h estimate but may slip to Sep 2)

1. Write `POST /api/reports/bulk-approve` — body: `{ reportIds: [1, 2, 3] }`. Loop over each, run the same approve guard individually, collect results into `{ success, selfOwned, alreadyActioned, notFound }`. Return the full per-report breakdown.
2. Write `POST /api/reports/bulk-reject` — same pattern, require `reason` in body.
3. Write `GET /api/reports/export-csv` — query all APPROVED reports not yet PAID, format as CSV rows (id, title, owner email, total, approved date), set `Content-Type: text/csv` and `Content-Disposition: attachment; filename="reimbursements-due.csv"` headers.

**Commit message:** `feat: bulk approve/reject with per-report result and CSV export`

---

### Estimated vs actual
| Session | Estimated | Actual |
|---------|-----------|--------|
| 3A — Reports + Lines CRUD | 3h | |
| 3B — Lifecycle + Audit | 2.5h | |
| 3C — Bulk + CSV | 1h | |

---

## Phase 4 — Dashboard API + Stale Alerts + Seed Data
**Date:** September 2  
**Estimated time:** 3–4 hours  
**Goal:** Dashboard aggregation endpoint, stale alert system, demo seed script.

### Session 4A — Dashboard API (Sep 2, ~1.5h)

Write `GET /api/dashboard`:
- `awaitingApproval`: count WHERE status = SUBMITTED
- `totalReimbursementsDue`: SUM(lines.amount) WHERE report status = APPROVED
- `approvedThisWeek`: count WHERE status = APPROVED AND updatedAt >= start of current week
- `paidThisWeek`: count WHERE status = PAID AND updatedAt >= start of current week
- `byStatus`: group count of all reports by status
- `byCategory`: GROUP BY category across all expense lines with SUM per category
- `paidPerWeek`: for each of the last 8 weeks (ISO week), SUM of lines.amount of PAID reports whose status changed to PAID that week

All of this is one endpoint, one query set. Do it in a single Prisma `$transaction` to ensure the numbers are consistent at the same point in time.

**Commit message:** `feat: dashboard aggregation endpoint`

---

### Session 4B — Stale alert system (Sep 2, ~1h)

**Design:**
- A report is "stale" if: `status = SUBMITTED` AND `updatedAt < now() - STALE_THRESHOLD_DAYS`.
- `STALE_THRESHOLD_DAYS` is stored in an environment variable (default: 3 days for demo purposes, so you can actually see alerts without waiting weeks).
- A `StaleAlert` row is created the first time the system detects staleness. It stores `reportId`, `approverId`, and `dismissedAt` (null by default).
- An alert is visible if: `dismissedAt IS NULL` OR `dismissedAt < now() - REDISPLAY_THRESHOLD_DAYS`.

**Routes:**
- `GET /api/alerts` — returns stale reports for the calling approver. Logic: find submitted reports older than threshold, cross-reference with that approver's ReportApprover assignments, filter out those with non-expired dismissals.
- `GET /api/alerts/count` — returns just the count (used by the nav badge).
- `POST /api/alerts/:reportId/dismiss` — sets `dismissedAt = now()` on the StaleAlert row for this approver + report combination. Creates the row if it does not exist yet.

**Commit message:** `feat: stale-approval alert system with dismiss and re-alert logic`

---

### Session 4C — Seed script (Sep 2, ~1h)

Write `prisma/seed.js`. Create:
- 2 employees (employee1@demo.com / password123, employee2@demo.com / password123)
- 2 approvers (approver1@demo.com / password123, approver2@demo.com / password123)
- 1 approver who is also an employee and has their own reports (to demo the self-approval block)
- ~15 expense reports in various statuses (DRAFT, SUBMITTED, APPROVED, REJECTED, PAID)
- 3–5 expense lines per report with realistic amounts and categories
- Audit entries for every status transition
- At least 2 reports assigned to approver1
- At least 1 report that is stale (submitted more than 3 days ago)
- At least 8 weeks of PAID reports so the dashboard chart shows real data

Add to `package.json`: `"seed": "node prisma/seed.js"`.

Run: `npm run seed`. Verify in Supabase table editor.

**Commit message:** `feat: seed script with realistic demo data covering all statuses`

---

### Session 4D — Approver queue route (Sep 2, ~0.5h)

Write `GET /api/approvers/queue`:
- Returns all SUBMITTED reports (full queue for any approver).
- Accepts `?assigned=true` to filter to only reports where the calling approver is in the ReportApprover join table.

**Commit message:** `feat: approver queue endpoint with optional assignment filter`

---

### Estimated vs actual
| Session | Estimated | Actual |
|---------|-----------|--------|
| 4A — Dashboard API | 1.5h | |
| 4B — Stale alerts | 1h | |
| 4C — Seed script | 1h | |
| 4D — Approver queue | 0.5h | |

---

## Phase 5 — Frontend (React + Vite + Tailwind)
**Date:** September 3  
**Estimated time:** 6–7 hours  
**Goal:** All pages built and wired to the backend. Every user-facing feature functional.

### Session 5A — Frontend scaffold (Sep 3, ~1h)

```
cd ..
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install axios react-router-dom recharts
```

Set up Tailwind (follow tailwindcss.com/docs/installation/using-vite).

Folder structure:
```
frontend/src/
├── api/
│   └── client.js
├── context/
│   └── AuthContext.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx
│   ├── ReportsPage.jsx
│   ├── ReportDetailPage.jsx
│   ├── NewReportPage.jsx
│   └── ApproverQueuePage.jsx
├── components/
│   ├── Layout.jsx
│   ├── ProtectedRoute.jsx
│   ├── StatusBadge.jsx
│   ├── ReportCard.jsx
│   └── AuditTimeline.jsx
└── App.jsx
```

Wire up React Router in `App.jsx`. Every page behind `/dashboard`, `/reports`, etc. is wrapped in `<ProtectedRoute>`.

**Commit message:** `chore: scaffold frontend with Vite, Tailwind, React Router`

---

### Session 5B — Auth pages + API client (Sep 3, ~1h)

1. Write `api/client.js` — Axios instance with `baseURL = import.meta.env.VITE_API_URL`. Add a request interceptor that reads the JWT from localStorage and adds `Authorization: Bearer <token>` to every request automatically. Add a response interceptor that catches 401 responses and redirects to `/login`.

2. Write `AuthContext.jsx` — React context with `login(email, password)`, `logout()`, and `user` (decoded JWT payload). On mount, check if a token exists in localStorage and pre-populate `user`.

3. Write `LoginPage.jsx` — form with email/password, calls `POST /api/auth/login`, stores token, redirects to `/dashboard`.

4. Write `RegisterPage.jsx` — same but calls `POST /api/auth/register`.

5. Write `ProtectedRoute.jsx` — checks `AuthContext.user`. If null, redirects to `/login`. Also accepts a `roles={['APPROVER']}` prop to enforce role-based redirect.

**Commit message:** `feat: auth pages, API client with interceptors, protected routes`

---

### Session 5C — Reports list page + Report detail page (Sep 3, ~2h)

1. Write `ReportsPage.jsx`:
   - Fetch `GET /api/reports` on mount and on filter/sort/page change.
   - Render a search input, status filter dropdown, sort buttons, and a paginated list of ReportCard components.
   - Show "New Report" button that navigates to `/reports/new`.
   - For approvers, show a "Export CSV" button that calls `GET /api/reports/export-csv` and triggers a browser download.

2. Write `ReportDetailPage.jsx`:
   - Fetch `GET /api/reports/:id`.
   - Show report metadata (title, date range, status badge, total).
   - Show line items table with add/edit/delete (only if DRAFT and owner).
   - Show `<AuditTimeline>` component (list of audit entries, newest first).
   - Show action buttons conditionally:
     - Owner + DRAFT: "Submit" button
     - Approver + SUBMITTED + not own: "Approve" and "Reject" buttons
     - Approver + APPROVED + not own: "Mark Paid" button
   - Show assigned approvers list with add/remove UI.
   - Show comment box (anyone can add a comment).

3. Write `NewReportPage.jsx` — form to create a new report (title, dateFrom, dateTo). On submit, calls `POST /api/reports` and navigates to the new report's detail page.

4. Write `<AuditTimeline>` — renders a vertical timeline of AuditEntry records. For each entry: actor name, timestamp, old/new status (or "Comment"), and reason if present.

5. Write `<StatusBadge>` — color-coded pill: DRAFT=gray, SUBMITTED=blue, APPROVED=green, REJECTED=red, PAID=purple.

**Commit message:** `feat: reports list page, report detail page with full action buttons`

---

### Session 5D — Dashboard + Approver Queue (Sep 3, ~2h)

1. Write `DashboardPage.jsx`:
   - Fetch `GET /api/dashboard`.
   - Render 4 metric cards (headline numbers).
   - Render a PieChart (Recharts) for breakdown by status.
   - Render a BarChart for breakdown by category.
   - Render a LineChart for reimbursements paid per week over last 8 weeks.
   - Make this the landing page after login (`/dashboard`).

2. Write `ApproverQueuePage.jsx` (only shown to approvers):
   - Fetch `GET /api/approvers/queue`.
   - Toggle between "All Submitted" and "Assigned to Me" tabs.
   - Checkbox on each row. "Bulk Approve" and "Bulk Reject" buttons appear when any are checked.
   - On bulk action, call the endpoint and show a per-report result summary (which succeeded, which were skipped because self-owned, etc.).

3. Write `Layout.jsx`:
   - Top navigation bar with logo, links (Dashboard, My Reports, Approver Queue if role=APPROVER), and user menu (logout).
   - Alert badge next to "Approver Queue" nav item: calls `GET /api/alerts/count` and shows a red bubble if > 0.
   - `<Outlet>` from React Router renders the page content below the nav.

**Commit message:** `feat: dashboard with Recharts, approver queue with bulk actions, nav with alert badge`

---

### Session 5E — Alerts panel (Sep 3, ~0.5h)

Add an alerts panel accessible from the nav badge. Calls `GET /api/alerts`. Shows a list of stale reports with "Dismiss" button on each. Dismissing calls `POST /api/alerts/:reportId/dismiss` and removes the item from the list.

**Commit message:** `feat: stale alerts panel with dismiss`

---

### Estimated vs actual
| Session | Estimated | Actual |
|---------|-----------|--------|
| 5A — Frontend scaffold | 1h | |
| 5B — Auth pages | 1h | |
| 5C — Reports pages | 2h | |
| 5D — Dashboard + Queue | 2h | |
| 5E — Alerts panel | 0.5h | |

---

## Phase 6 — Integration Testing + Deployment + Documentation
**Date:** September 4–5  
**Estimated time:** 4–5 hours  
**Goal:** Everything works end-to-end locally, deployed and live, docs filled in.

### Session 6A — End-to-end testing (Sep 4, ~1.5h)

Run through these scenarios manually in the browser:

1. Register as employee. Create a report. Add 3 lines. Submit it. Verify status = SUBMITTED.
2. Log in as approver. See the report in the queue. Try to approve your own report (if approver also has a report) — verify the server blocks it with a 403 error.
3. Reject a report without a reason — verify the server returns 400.
4. Reject a report with a reason — verify it goes back to DRAFT and the rejection reason appears in the audit timeline.
5. Edit the rejected report, resubmit it.
6. Approve it. Mark it as Paid.
7. Check the dashboard — verify all 4 metric cards show correct numbers.
8. Check the 8-week chart — if seed data is set up correctly, it shows data.
9. Test bulk approve with a mix of own and other reports — verify per-report result is returned.
10. Download CSV — verify it opens in Excel/Google Sheets with correct columns.
11. Archive a report — verify it disappears from the default list but can be found with an "include archived" filter.
12. Check the alert badge — verify stale reports appear. Dismiss one. Verify it disappears.
13. Test pagination — if you have 15+ reports in seed, verify page 2 shows different reports.

Fix any bugs found. Commit each fix separately.

---

### Session 6B — Deployment (Sep 4–5, ~2h)

**Order: Database → Backend → Frontend**

**1. Database (Supabase) — already done in Phase 2.**
- Run `npx prisma db push` if schema changed since Phase 2.
- Run `npm run seed` against the production database.

**2. Backend (Render):**
1. Push backend code to GitHub.
2. Create a new Render "Web Service". Connect GitHub repo. Root directory: `backend`.
3. Build command: `npm install && npx prisma generate`
4. Start command: `node src/index.js`
5. Add environment variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV=production`.
6. Deploy. Wait for it to go green. Test `GET /api/auth/me` at the Render URL — should return 401 (no token), which confirms the API is live.

**3. Frontend (Vercel):**
1. Push frontend code to GitHub.
2. Create a new Vercel project. Connect the same GitHub repo. Root directory: `frontend`.
3. Add environment variable: `VITE_API_URL = https://your-app.onrender.com/api`.
4. Deploy. Test login in the browser.

**Common issues to watch for:**
- CORS: Add the Vercel domain to the backend's CORS allowed origins.
- Render free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30–60 seconds. Note this in `SUBMISSION.md`.
- Environment variables set in Render/Vercel only take effect after a redeploy.

**Commit message:** `chore: add deployment configuration and environment variable docs`

---

### Session 6C — Fill in all docs (Sep 5, ~1h)

Fill in every docs file. Do not leave any questions unanswered.

- `docs/architecture.md` — describe the frontend/backend/database split, how they communicate (REST over HTTPS), and trace the lifecycle of submitting an expense report end to end.
- `docs/schema.md` — list every table, column, type, constraint. Answer every question in the stub.
- `docs/decisions.md` — write at least 5 entries. Suggested entries: (1) why PostgreSQL over MongoDB, (2) why JWT over sessions, (3) why Prisma over raw SQL, (4) why a computed total versus a stored total, (5) one decision you reversed (e.g., you originally planned to store report total as a DB column and reversed it when you realized it would go out of sync with line edits).
- `docs/plan.md` — fill in the Actual columns in every phase's table.
- `docs/ai-prompts.md` — log every AI conversation used.
- `SUBMISSION.md` — fill in all links, credentials, stack table, goal checklist.

**Commit message:** `docs: complete all required documentation`

---

### Estimated vs actual
| Session | Estimated | Actual |
|---------|-----------|--------|
| 6A — E2E testing | 1.5h | |
| 6B — Deployment | 2h | |
| 6C — Docs | 1h | |

---

## Total time summary

| Phase | Description | Estimated | Actual |
|-------|-------------|-----------|--------|
| 1 | Environment + Orientation | 4–5h | |
| 2 | Schema + Auth | 5–6h | |
| 3 | Core backend (Reports, Lines, Lifecycle, Bulk) | 6.5h | |
| 4 | Dashboard + Alerts + Seed | 4h | |
| 5 | Full frontend | 6.5h | |
| 6 | Testing + Deployment + Docs | 4.5h | |
| **Total** | | **~31h** | |

> Note: The assignment suggests 12 hours. This plan budgets more because the stack is entirely new. The extra hours are front-loaded in learning (Phase 1) and backend correctness (Phases 2–4). The frontend moves faster because by then the patterns are familiar.

---

## What was cut and why

> Fill in this section as scope decisions are made during the work.

- **Stretch goals:** All stretch goals (receipt OCR, mileage calculator, multi-currency, etc.) are cut entirely. The 10 required goals are the only target. Doing 8 goals well beats doing 10 goals badly.
- **Email notifications:** No email sent on status changes. The audit timeline and dashboard give visibility without email infrastructure.
- **Role management UI:** Roles are set at registration (or via the seed script). There is no admin panel to change a user's role after the fact. This is a deliberate scope cut — the brief does not require it.
- **Automated tests:** No unit or integration test suite. Time pressure and a new stack make this impractical. Manual end-to-end testing (Phase 6A) covers the critical paths instead.

---

## Git discipline

Every session ends with at least one commit. The commit message starts with a conventional-commits prefix:
- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — setup, config, scripts
- `docs:` — documentation only

Never commit `.env` files. Never force-push to main after the first commit.
