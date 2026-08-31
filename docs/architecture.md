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
