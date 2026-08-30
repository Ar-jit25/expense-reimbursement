# Architecture

Answer each of these, in your own words, once the system has taken real shape.

- What are the moving pieces, and how do they talk to each other?
  - **Database:** Supabase PostgreSQL instance, interacting with the backend via Prisma ORM over connection pooler (port 6543).
  - *(Frontend and Backend components to be added in later phases).*

- Where does each piece run?
  - **Database:** Hosted remotely on Supabase (AWS ap-southeast-1).
  - *(Frontend and Backend runtime environments to be detailed later).*

- What is the request path for one representative user action, end to end?
  - *(To be documented in Phase 3/4)*

- What did you decide *not* to build, and why?
  - For the database schema, I decided *not* to use a NoSQL or document-based approach. Expense reports have strict relational needs (reports have lines, reports have statuses and history logs). Referential integrity enforced at the database level using Postgres foreign keys ensures orphan records are impossible.
  - I decided *not* to track expense `total` in the DB. It is computed dynamically to avoid out-of-sync state.
