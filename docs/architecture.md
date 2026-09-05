# Architecture

Answer each of these, in your own words, once the system has taken real shape.

- What are the moving pieces, and how do they talk to each other?
  - **Database:** Supabase PostgreSQL instance, interacting with the backend via Prisma ORM over connection pooler (port 6543).
  - **Backend (API):** A Node.js Express server acting as the sole security boundary. It connects to Supabase Auth to verify JSON Web Tokens (JWTs) and executes queries via Prisma.
  - *(Frontend to be added in later phases).*

- Where does each piece run?
  - **Database:** Hosted remotely on Supabase (AWS ap-southeast-1).
  - **Backend:** Runs on Node.js (locally for now via `nodemon`).

- What is the request path for one representative user action, end to end?
  - *(To be documented in Phase 3/4)*

- What did you decide *not* to build, and why?
  - For the database schema, I decided *not* to use a NoSQL or document-based approach. Expense reports have strict relational needs (reports have lines, reports have statuses and history logs).
  - I decided *not* to track expense `total` in the DB. It is computed dynamically to avoid out-of-sync state.
  - I decided *not* to implement custom JWTs, Bcrypt hashing, or session cookies. Using Supabase Auth offloads password security and standardizes Bearer token authentication, which perfectly serves the Express API.

### Representative Request Path (Phase 3: Adding an Expense Line)
1. **Client** sends `POST /api/reports/1/lines` with a valid JWT in the `Authorization` header.
2. **`requireAuth` middleware** verifies the JWT with Supabase, fetches the Prisma `User`, and attaches `req.user`.
3. **`requireReportOwner` middleware** queries Prisma to verify Report #1 exists and its `ownerId` matches `req.user.id`. It also stashes the report's status on the request object.
4. **`requireDraftReport` middleware** verifies the stashed status is `DRAFT`. If it were `SUBMITTED`, it would reject the request with a 400 Bad Request.
5. **`LineController`** parses the `req.body` ensuring date, amount, category, and description are present.
6. **`LineService`** executes the `prisma.expenseLine.create` query.
7. **Controller** returns `201 Created` with the new expense line data.

### Representative Request Path (Phase 4: Approving a Report)
1. **Client (Approver)** sends `POST /api/reports/1/approve` with a valid JWT.
2. **`requireAuth`** verifies identity (User is John).
3. **`requireRole('APPROVER')`** verifies John is an Approver.
4. **`requireNotReportOwner`** verifies John did *not* create Report #1. (If he did, request is rejected).
5. **`ReportController.approve`** catches the request.
6. **`ReportService._transitionState`** opens a Prisma `$transaction`:
   - Checks if Report #1 is currently `SUBMITTED`. If not, aborts.
   - Updates `status` to `APPROVED` and sets `approvedAt = now()`.
   - Inserts into `ReportHistory` recording John's ID, `SUBMITTED -> APPROVED`.
   - Commits transaction.
7. **Controller** returns `200 OK`.

### The Authorization Layers (Phase 5)
Our Express middleware utilizes three distinct layers of authorization before reaching the business logic:
1. **Role-Based Access Control (RBAC)**: `requireRole('APPROVER')`. Are you a manager?
2. **Attribute-Based Access Control (ABAC)**: `requireNotReportOwner`. Are you trying to review your own work?
3. **Resource-Specific Access Control**: `requireAssignedApprover`. Were you specifically assigned to this exact report?

### Representative Request Path (Phase 6: Paginated Discovery)
1. **Client** sends GET /api/reports?search=flight&sort=total&limit=10.
2. **Controller** extracts, validates parameters (e.g., limit cap at 100, sort enum validation), and blocks specialized queue access if user is an Employee.
3. **Service (Authorization/Filter)** dynamically builds a safe Prisma where clause. It guarantees Employee ownership or Approver queue boundaries, then layers the search filter on top.
4. **Service (Authorized IDs Pipeline)**: Because sort=total is requested, it queries Prisma for *only* the matching ids.
5. **Service (PostgreSQL Aggregation)**: It passes the safe array of IDs into a parameterized $queryRaw query, which joins expense_lines, calculates the SUM(amount), applies ORDER BY, and utilizes database-level LIMIT 10 OFFSET 0.
6. **Service (Hydration)**: Prisma takes the 10 final sorted IDs, fetches the full records (with lines and history), and Node.js maps them back into the exact database-determined order.
7. **Controller** wraps the response in { data, total, page, limit } and returns 200 OK.

### Frontend Architecture (React + Vite)
- **Routing:** eact-router-dom manages client-side navigation. ProtectedRoute wrapper components restrict /approvals routes to the APPROVER role using Context.
- **State Management:** AuthContext provides global user identity. Local state (useState) handles individual page states, forms, and loading indicators.
- **Service Layer:** piClient.js intercepts all outbound fetch requests to inject the Authorization: Bearer <token> header, and standardizes error throwing by parsing the backend's JSON error messages.
- **Data Fetching:** Standard useEffect hooks trigger etchReports methods from the eports.js service, updating local state variables and triggering re-renders.


## Phase 8: Bulk Operations & Export
- **Bulk API**: Endpoints accept arrays of IDs. The controller iterates through them, manually asserting authorization rules, and calls the service layer. Results are accumulated into `successful` and `failed` arrays to ensure partial successes do not roll back valid transitions.
- **CSV Export**: The endpoint directly calls `reportService.getReports` with `isPaginated: false`, generating CSV streams dynamically without risking data leaks via separate queries.

### Phase 9: Analytics Dashboard
- Added GET /api/analytics endpoint returning DTO populated by AnalyticsService.
- Enforced robust visibility bounded exactly by eport.service.js query generators.
- Replaced mock KPI cards with AnalyticsOverview React component populated dynamically using echarts.

## Phase 10: Stale Alerts and Seed Data

### Stale Alerts Design
- **Eligibility:** A report is stale if it is SUBMITTED, older than a configurable threshold (STALE_THRESHOLD_DAYS, default 5), and is assigned to the current approver.
- **Dismissal & Redisplay:** Alerts are dismissed per approver. A StaleAlert record is upserted with the current timestamp on dismissal. If the report remains unresolved past the REDISPLAY_THRESHOLD_DAYS (default 3), Prisma filters ignore the StaleAlert record, bringing it back to the approver's attention.
- **Trade-offs:** We recalculate report totals in Node rather than SQL views to maintain strict adherence to our Node-driven architecture.

### Seed Data
- Uses Prisma to deterministically populate realistic data reflecting multiple edge cases (DRAFT, SUBMITTED, APPROVED, REJECTED, PAID), history entries, categories for analytics, and specific age rules to trigger stale alerts immediately upon initialization.

## Phase 12: Production Authentication
- **Authentication vs Authorization:**
  - **Identity (AuthN):** Handled entirely by Supabase Auth (supabase.auth.signInWithPassword). The frontend receives a JWT and passes it to the backend.
  - **Authorization (AuthZ):** The backend middleware (equireAuth) verifies the JWT against Supabase's keys, extracts the UUID, and strictly checks if that UUID exists in the application's User table. If not, access is rejected. Roles are stored exclusively in the application database.
- **Session Management:** The frontend AuthContext uses Supabase's native session management (supabase.auth.getSession() and onAuthStateChange) to restore and refresh tokens, mapping them to the internal app profile fetched via /api/me.
- **Deployment Topology:** 
  - Backend: Node.js/Express deployed to Render, communicating with Supabase PostgreSQL (via transaction pooler port 6543).
  - Frontend: React/Vite deployed to Vercel, communicating with the Render backend and Supabase Auth.


## Phase 13: Rule-Based Multi-Approver Assignment & Self-Approval Prevention Engine
- **Engine Logic**: Upon report submission, line items are grouped by category and their amounts totaled. The category with the highest total is designated the primary category.
- **Routing Rules**:
  - `TRAVEL`, `MEALS`, `EQUIPMENT` ➔ Approver A (`app@example.com`)
  - `ACCOMMODATION`, `SUPPLIES`, `SOFTWARE`, `OTHER` ➔ Approver B (`app2@example.com`)
  - Category ties default to Approver B (`app2@example.com`).
- **Conflict of Interest Prevention**: If the assigned approver is the owner of the report, the system automatically assigns the other approver, guaranteeing that no approver can ever review or approve their own expense report.

## Phase 14: Global Queue vs Assigned Approver Boundaries
- **Global Visibility**: The `/api/reports?queue=submitted` endpoint delivers all submitted reports across the organization.
- **Strict Authorization Boundary**: Approvers can only open, view details, approve, or reject reports that are assigned to them. Reports assigned to other approvers are view-only in the list, preventing unauthorized interference.

## Phase 15: Soft-Delete Archiving and Restore Lifecycle
- **Implementation**: Uses `isArchived: Boolean` on `ExpenseReport`.
- **Visibility**: The dashboard provides two distinct views: "Active Reports" and "Archived".
- **Restoration**: Archived reports cannot be modified or submitted, but include a "Restore" action that restores them to the active workflow. Archived reports are excluded from active queues and stale alert calculations.

## Phase 16: Stale Alert Recurrence Engine (5 Days Stale, 5 Hours Recurrence / Polling)
- **Stale Detection**: Identifies submitted, unarchived reports older than 5 days (`STALE_THRESHOLD_DAYS=5`).
- **Recurrence Lifecycle**: When dismissed, alerts remain hidden for 5 hours (`REDISPLAY_THRESHOLD_HOURS=5`), after which they recur if the report is still awaiting decision.
- **Periodic Database Check**: Frontend components (`AlertsBadge` and `Alerts`) poll the backend every 5 hours (`5 * 60 * 60 * 1000` ms), triggering database recalculations on a predictable cycle.
