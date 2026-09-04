# AI prompts

The prompts you actually used, in the order you used them, grouped by what you were trying to achieve. For each significant one: what you asked, what you got back, and what you had to correct.

Include at least one prompt that produced something wrong, and what you did about it.

If you did not use AI at all, say so here, and describe your process instead.

## Backend Initialization and Express Setup
**Prompt:** Create a basic Express.js server with standard middleware (cors, json) and set up the initial routing structure for an expense reimbursement API.
**Result:** The AI provided a standard index.js file with express.json() and cors(). It set up placeholder routes for /api/reports and /api/auth.
**Correction:** I had to adjust the CORS configuration to properly accept both local Vite development URLs and later production URLs, as the AI initially provided an overly permissive pp.use(cors()).

## Prisma Schema Design
**Prompt:** Design a Prisma schema for an expense reimbursement system. It needs a User table with roles (EMPLOYEE, APPROVER), an ExpenseReport table with status (DRAFT, SUBMITTED, APPROVED, REJECTED, PAID), and ExpenseLine items with categories. It also needs a history table for tracking state changes.
**Result:** The AI generated a comprehensive Prisma schema with all the requested tables and enums. It correctly set up the relations between User, ExpenseReport, and ExpenseLine.
**Correction:** The AI added an mount field directly to ExpenseReport as well as on ExpenseLine. This violated the architectural rule that the total amount must only be computed from the line items. I removed the mount field from ExpenseReport and updated the backend services to calculate it on the fly.

## Stale Alerts Logic (The "Wrong" Output)
**Prompt:** Write a backend service function to fetch stale reports. A report is stale if it's SUBMITTED, assigned to the current approver, and older than 5 days. Include a feature where an approver can dismiss the alert, and it won't show up again.
**Result:** The AI wrote a function that added an isStale boolean column to the ExpenseReport table, which would be updated by a cron job every night, and a dismissedAlerts JSON column on the User table.
**Correction:** This was entirely wrong for the architecture. Adding stateful boolean flags for computed time-based data leads to desync, and modifying the User table for alert states is bad normalization. I corrected this by creating a separate StaleAlert table that links eportId and pproverId with a dismissedAt timestamp. The "staleness" is now computed dynamically in the query based on the submittedAt timestamp, avoiding cron jobs entirely.

## Production Supabase Auth Middleware
**Prompt:** Write an Express middleware that verifies a Supabase JWT and attaches the corresponding application user profile to req.user. If the user doesn't exist in the database, automatically create them.
**Result:** The AI wrote a functional middleware using @supabase/supabase-js that verified the token and used a Prisma upsert or create if the user was missing.
**Correction:** In Phase 12, I realized this violated the core requirement that the portal is invite-only. The automatic creation of users had to be removed. I modified the middleware to perform a strict indUnique check and return a 403 Forbidden error if the user was not already provisioned in the application database.
