# Architecture

Answer each of these, in your own words, once the system has taken real shape.

---

## What are the moving pieces, and how do they talk to each other?

The system is a classic three-tier web application composed of four distinct pieces:

**Database - Supabase PostgreSQL**
The single source of truth for all application data: users, expense reports, expense lines, approval assignments, history logs, and stale alert records. The backend never talks to it directly over raw TCP - it goes through Prisma ORM, which provides type-safe queries and schema migrations. The connection uses Supabase's transaction pooler (port 6543) rather than a direct connection, which is required when running behind a serverless-style environment.

**Auth Provider - Supabase Auth**
Supabase Auth handles password hashing, session issuance, and JWT signing. It is a separate service from the database itself. When a user logs in, the frontend calls Supabase Auth directly and receives a signed JWT. All subsequent API requests carry that JWT as a Bearer token. The backend then verifies the JWT against Supabase's public keys without ever holding passwords.

**Backend API - Node.js / Express**
The sole security boundary of the system. It exposes a RESTful API at `/api/*` and is responsible for every authorization decision. No client is trusted. The backend verifies every incoming JWT, resolves the caller's role from the application database (not from the token), and enforces ownership and assignment rules in middleware before business logic is ever reached. It follows a strict Route -> Controller -> Service layered architecture.

**Frontend - React / Vite**
A single-page application that renders the UI and coordinates data fetching. It holds no privileged secrets and enforces no access control - that is entirely the backend's job. The frontend authenticates via Supabase Auth, then passes the JWT to the backend on every request via `apiClient.js`, which injects the `Authorization: Bearer <token>` header automatically. State is managed via React Context for auth and `useState`/`useEffect` for page-level data.

**How they talk to each other:**

```
Browser (React/Vite)
  |
  +-- Supabase Auth          (login / session refresh -- direct HTTPS)
  |
  +-- Express API (Render)   (all data operations -- HTTPS + JWT)
        |
        +-- Supabase PostgreSQL via Prisma  (queries -- pooler port 6543)
        +-- Supabase Auth public keys       (JWT verification -- HTTPS)
```

---

## Where does each piece run?

| Piece | Environment |
|---|---|
| **Database** | Supabase managed PostgreSQL, hosted on AWS `ap-southeast-1` |
| **Auth** | Supabase Auth (same Supabase project, managed cloud) |
| **Backend API** | Node.js/Express deployed to **Render** (Web Service) |
| **Frontend** | React/Vite static bundle deployed to **Vercel** |

During local development, the backend runs via `nodemon` on `localhost:3001` and the frontend runs via Vite's dev server on `localhost:5173`. The database and auth remain cloud-hosted (Supabase) in all environments, including local - there is no local database instance.

The backend uses `MOCK_AUTH=true` with a header-based identity mechanism (`x-mock-user-id`) during early development to bypass real JWT verification. This flag is never set in production.

---

## What is the request path for one representative user action, end to end?

**Scenario: An approver rejects an expense report.**

1. **Browser** - The approver clicks "Reject" and types a rejection reason in the inline UI field. The frontend calls `POST /api/reports/:id/reject` with `{ reason: "Over policy limits" }` and an `Authorization: Bearer <jwt>` header.

2. **`requireAuth` middleware** - The Express server receives the request. It extracts the JWT, verifies its signature against Supabase's public keys, decodes the `sub` (UUID), and queries `prisma.user.findUnique` to confirm that UUID exists in the application's own User table. If found, `req.user` is populated with the full user record including their role. If not, the request is rejected with `401 Unauthorized`.

3. **`requireRole('APPROVER')` middleware** - Checks `req.user.role`. If not `APPROVER`, returns `403 Forbidden`.

4. **`requireAssignedApprover` middleware** - Queries `prisma.reportApprover` to confirm this specific approver is assigned to this specific report. If not assigned, returns `403 Forbidden`. This prevents one approver from acting on another's queue.

5. **`ReportController.reject`** - Parses and validates the request body (ensures `reason` is non-empty).

6. **`ReportService._transitionState`** - Opens a Prisma `$transaction`:
   - Verifies the report's current status is `SUBMITTED`. Any other status aborts with a `409 Conflict`.
   - Updates `status` to `REJECTED` and writes `rejectionReason` to the record.
   - Inserts a `ReportHistory` entry: `actorId = req.user.id`, `toStatus = 'REJECTED'`, `reason = "Over policy limits"`.
   - Commits the transaction atomically.

7. **Controller** returns `200 OK` with the updated report object.

8. **Frontend** - `ReportDetails.jsx` receives the response, updates local state, and immediately renders a red rejection banner displaying the reason - visible to the employee on their next view.

---

## What did you decide *not* to build, and why?

**No stored `total` field on expense reports.**
Totals are calculated dynamically as `SUM(amount)` over the report's line items on every fetch. Storing a denormalized total would inevitably drift out of sync when lines are added, edited, or removed - a class of bug that is eliminated entirely by computing on demand.

**No custom authentication (bcrypt, sessions, cookies).**
Supabase Auth handles password hashing, JWT signing, and session refresh. Building this from scratch would add significant surface area for security vulnerabilities with no product benefit. The backend only performs authorization - it never stores or touches passwords.

**No NoSQL / document database.**
Expense reports have strict relational structure: reports contain lines, lines belong to categories, reports have history, history references users. A relational schema with foreign key constraints enforces this integrity at the database level. NoSQL would trade that correctness for flexibility that isn't needed here.

**No frontend-side role enforcement.**
The frontend reads the user's role to decide what UI to render (e.g., show the approvals sidebar link), but every privileged action is independently validated on the backend. A user who manually calls the API or tampers with the token payload gets rejected at `requireAuth` - the UI is irrelevant.

**No "Assign to Me" / manual queue assignment.**
The original design allowed approvers to manually claim reports from a global queue. This was replaced by automatic category-based routing at submission time: the system deterministically selects the correct approver based on the report's primary expense category, with a built-in conflict-of-interest swap if the selected approver is the report's owner. This is more predictable, auditable, and eliminates the race condition of two approvers claiming the same report simultaneously.

**No dedicated notification service.**
Stale alert delivery is handled by the frontend polling the `GET /api/analytics/alerts` endpoint on a 5-hour interval. A proper push notification system (WebSockets, email, Slack) would require additional infrastructure. Polling is sufficient for the current scale and scope.