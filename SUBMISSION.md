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
