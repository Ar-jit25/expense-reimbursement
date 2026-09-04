require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { requireAuth } = require('./middleware/auth');

const app = express();

// CORS: allow local Vite dev and the deployed Vercel frontend.
// FRONTEND_URL is set as an env var on Render for production.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173', // vite preview
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// ==========================================
// /api/me - Returns authenticated user profile + role
// Role comes EXCLUSIVELY from the application User table, never the client.
// ==========================================
app.get('/api/me', requireAuth, (req, res) => {
  const { id, email, name, role } = req.user;
  res.json({ id, email, name, role });
});

// ==========================================
// API Routes
// ==========================================
const reportRoutes = require('./routes/report.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const alertRoutes = require('./routes/alert.routes');

app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
