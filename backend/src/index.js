require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { requireAuth } = require('./middleware/auth');

const app = express();

// CORS configuration (Robust for Vercel and local dev)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman)
    if (!origin) return callback(null, true);
    
    // Always allow local development
    if (origin.startsWith('http://localhost:')) return callback(null, true);
    
    // Always allow Vercel domains for this project
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    
    // Strict fallback to FRONTEND_URL if it's a custom domain
    if (process.env.FRONTEND_URL) {
      const allowed = process.env.FRONTEND_URL.replace(/\/$/, ''); // strip trailing slash
      if (origin === allowed) return callback(null, true);
    }
    
    console.warn(`CORS blocked request from origin: ${origin}`);
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

