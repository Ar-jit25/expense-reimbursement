require('dotenv').config();
const prisma = require('./src/config/prisma');
const express = require('express');
const { requireAuth } = require('./src/middleware/auth');
const { requireRole } = require('./src/middleware/roles');
const request = require('supertest');

// MOCK SUPABASE FOR TESTING (due to live rate limits on signups)
const supabase = require('./src/config/supabase');
const mockSupabaseUserId = '00000000-0000-0000-0000-000000000001';
const mockSupabaseUserId2 = '00000000-0000-0000-0000-000000000002';

supabase.auth.getUser = async (token) => {
  if (token === 'VALID_EMPLOYEE_TOKEN') {
    return { data: { user: { id: mockSupabaseUserId, email: 'employee@example.com' } }, error: null };
  }
  if (token === 'VALID_APPROVER_TOKEN') {
    return { data: { user: { id: mockSupabaseUserId2, email: 'approver@example.com' } }, error: null };
  }
  return { data: { user: null }, error: { message: 'Invalid token' } };
};

// Setup an Express app just for this test
const app = express();
app.use(express.json());
app.get('/api/test/me', requireAuth, (req, res) => res.json({ user: req.user }));
app.get('/api/test/employee', requireAuth, requireRole('EMPLOYEE'), (req, res) => res.json({ ok: true }));
app.get('/api/test/approver', requireAuth, requireRole('APPROVER'), (req, res) => res.json({ ok: true }));

async function runTests() {
  console.log("Starting Auth & Authorization Integration Tests (Mocked Supabase due to Rate Limits)...\n");

  // Clean up previous test users
  await prisma.user.deleteMany({ where: { id: { in: [mockSupabaseUserId, mockSupabaseUserId2] } } });

  console.log("1. Testing /api/test/me (Employee)...");
  let res = await request(app).get('/api/test/me').set('Authorization', `Bearer VALID_EMPLOYEE_TOKEN`);
  if (res.status !== 200) throw new Error(`Auth failed: ${res.text}`);
  console.log(`   OK! Profile synced to Prisma with ID: ${res.body.user.id}, Role: ${res.body.user.role}`);

  console.log("2. Promoting Approver in Prisma...");
  await request(app).get('/api/test/me').set('Authorization', `Bearer VALID_APPROVER_TOKEN`);
  await prisma.user.update({
    where: { id: mockSupabaseUserId2 },
    data: { role: 'APPROVER' }
  });
  console.log("   OK! Approver role updated.");

  console.log("3. Testing Role Authorization (EMPLOYEE accessing /approver)...");
  res = await request(app).get('/api/test/approver').set('Authorization', `Bearer VALID_EMPLOYEE_TOKEN`);
  if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  console.log("   OK! Employee correctly blocked from approver endpoint.");

  console.log("4. Testing Role Authorization (APPROVER accessing /approver)...");
  res = await request(app).get('/api/test/approver').set('Authorization', `Bearer VALID_APPROVER_TOKEN`);
  if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
  console.log("   OK! Approver correctly granted access.");

  console.log("5. Testing Unauthenticated Request...");
  res = await request(app).get('/api/test/me');
  if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
  console.log("   OK! Unauthenticated request correctly blocked.");

  // Clean up
  await prisma.user.deleteMany({ where: { id: { in: [mockSupabaseUserId, mockSupabaseUserId2] } } });

  console.log("\n✅ ALL PHASE 2 VERIFICATIONS PASSED!");
  process.exit(0);
}

runTests().catch(e => {
  console.error("❌ TEST FAILED:", e.message);
  process.exit(1);
});
