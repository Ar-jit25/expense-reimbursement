require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { requireAuth } = require('./middleware/auth');
const { requireRole } = require('./middleware/roles');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// Phase 2: Protected Test Endpoints
// ==========================================

// 1. Authenticated Identification Test
// Verifies `requireAuth` works and resolves the correct Prisma profile
app.get('/api/test/me', requireAuth, (req, res) => {
  res.json({
    message: 'Authentication successful',
    user: req.user
  });
});

// 2. Role Authorization Test (EMPLOYEE)
app.get('/api/test/employee-only', requireAuth, requireRole('EMPLOYEE'), (req, res) => {
  res.json({ message: 'Welcome, Employee!' });
});

// 3. Role Authorization Test (APPROVER)
app.get('/api/test/approver-only', requireAuth, requireRole('APPROVER'), (req, res) => {
  res.json({ message: 'Welcome, Approver!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
