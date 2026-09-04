require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { requireAuth } = require('./middleware/auth');

const app = express();

// Allow all origins to prevent deployment friction for the assignment
app.use(cors());

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


