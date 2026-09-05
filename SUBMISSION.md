# Submission

## Deployment Status
**Note:** The application is fully prepared for deployment, but manual deployment has not yet occurred as it requires access to the Render and Vercel dashboards.

Below are the exact steps remaining to deploy the application:

### Backend Deployment (Render)
1. Log in to Render.com and create a new **Web Service**.
2. Connect the GitHub repository.
3. Set the **Root Directory** to ackend.
4. Set the **Build Command** to: 
pm install && npx prisma generate
5. Set the **Start Command** to: 
ode src/index.js
6. Add the following environment variables (values from .env):
   - DATABASE_URL
   - DIRECT_URL
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - PORT=3001
   - FRONTEND_URL (set to the Vercel URL once known)
   - *(Ensure MOCK_AUTH is NOT set)*

### Frontend Deployment (Vercel)
1. Log in to Vercel.com and create a new **Project**.
2. Connect the GitHub repository.
3. Set the **Root Directory** to rontend.
4. The Build Command should auto-detect as 
pm run build and Output Directory as dist.
5. Add the following environment variables:
   - VITE_API_URL (set to the Render backend URL: e.g., https://your-backend.onrender.com/api)
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

## Live URLs
- **Frontend:** [Deployment Pending Vercel Setup]
- **Backend API:** [Deployment Pending Render Setup]

## Demo Credentials
The database has been seeded with real Supabase Auth identities. Use these to log in once deployed:

| Role | Email | Password |
|------|-------|----------|
| Employee | emp@example.com | Employee1 |
| Employee 2 | emp2@example.com | Employee2 |
| Approver | pp@example.com | Approver1 |
| Approver 2 | pp2@example.com | Approver2 |

## Features Summary

### 1. Zero-Trust Role-Based Access Control & Real Supabase Auth
- Strict separation between Employees (`EMPLOYEE`) and Approvers (`APPROVER`).
- Real Supabase Auth JWT verification against Supabase cryptographic public keys.
- Application roles are enforced exclusively by the backend database (`prisma.user`), never trusted from the client.

### 2. Full Report & Expense Line Lifecycle
- Complete state machine: `DRAFT` ➔ `SUBMITTED` ➔ `APPROVED` / `REJECTED` ➔ `PAID`.
- Editable reports in draft status prior to submission.
- Rejection requires an explicit reason and returns the report to `DRAFT` for correction and resubmission.
- Report totals calculated dynamically (`SUM(amount)`) on the fly, eliminating state desynchronization.

### 3. Automated Category-Based Routing Engine & Anti-Self-Approval
- Line items are aggregated by category; the category with the highest total amount determines the primary category.
- Primary Approver mapping:
  - Approver A (`app@example.com`): `TRAVEL`, `MEALS`, `EQUIPMENT`
  - Approver B (`app2@example.com`): `ACCOMMODATION`, `SUPPLIES`, `SOFTWARE`, `OTHER` (and ties)
- Automatic conflict-of-interest swap: If the primary approver created the report, it is automatically assigned to the alternate approver.
- Approvers can also submit their own expense reports as employees.

### 4. Global Submitted Queue vs. Assigned Approver Isolation
- Approvers have a global view of all submitted reports across the organization.
- Approvers can only open, view details, approve, or reject reports explicitly assigned to them.
- Unassigned reports display an assignment badge and remain view-only.

### 5. Soft-Delete Archiving and Restore Lifecycle
- Reports can be archived to declutter active workspaces.
- Dedicated "Active Reports" and "Archived" tabs in the Dashboard.
- Restoring seamlessly returns reports to active status while preserving full audit history.
- Archived reports are excluded from active workflows and stale alert calculations.

### 6. Stale Alert Recurrence Engine (5 Days / 5 Hours)
- Flags reports awaiting decision past 5 days (`STALE_THRESHOLD_DAYS=5`).
- Dismissed alerts remain suppressed for 5 hours (`REDISPLAY_THRESHOLD_HOURS=5`), after which they recur if the report remains submitted.
- Client polling interval is set to 5 hours (`5 * 60 * 60 * 1000` ms), with manual Refresh available on demand.
