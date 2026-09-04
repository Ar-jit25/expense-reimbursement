/**
 * verify-phase12-realauth.js
 * 
 * Tests the complete production authentication chain against the real Supabase database.
 * Uses real JWT tokens (not mock tokens).
 * 
 * Distinguishes clearly: this is a REAL SUPABASE AUTHENTICATION test, not a mock test.
 */
process.env.MOCK_AUTH = undefined;
delete process.env.MOCK_AUTH;

const request = require('supertest');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// Must have real Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('FAIL: Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Build test app (no MOCK_AUTH)
const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors());
const { requireAuth } = require('./src/middleware/auth');
app.get('/api/me', requireAuth, (req, res) => {
  const { id, email, name, role } = req.user;
  res.json({ id, email, name, role });
});
const reportRoutes = require('./src/routes/report.routes');
const alertRoutes = require('./src/routes/alert.routes');
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);

async function run() {
  console.log('\n=== Phase 12: Real Supabase Authentication E2E Tests ===');
  console.log('Authentication method: supabase.auth.signInWithPassword()');
  console.log('Note: These tests use REAL Supabase credentials, NOT mock tokens.\n');

  // === EMPLOYEE TESTS ===
  console.log('--- EMPLOYEE (emp@example.com) ---');
  
  const { data: empAuth, error: empError } = await supabaseClient.auth.signInWithPassword({
    email: process.env.DEMO_EMP_EMAIL,
    password: process.env.DEMO_EMP_PASSWORD,
  });
  if (empError) throw new Error(`Employee Supabase login failed: ${empError.message}`);
  const empToken = empAuth.session.access_token;
  console.log('[1] PASS: Employee authenticated with Supabase successfully');
  console.log(`       Supabase UID: ${empAuth.user.id}`);

  const meEmp = await request(app).get('/api/me').set('Authorization', `Bearer ${empToken}`).expect(200);
  console.log(`[2] PASS: /api/me resolved -> role=${meEmp.body.role}, id=${meEmp.body.id}`);
  if (meEmp.body.role !== 'EMPLOYEE') throw new Error(`Expected EMPLOYEE role, got: ${meEmp.body.role}`);
  if (meEmp.body.id !== empAuth.user.id) throw new Error('UUID mismatch: /api/me id != Supabase UID');
  console.log('[3] PASS: Role=EMPLOYEE confirmed from application database (not frontend)');
  console.log('[4] PASS: Supabase UUID matches application User record');

  const empReports = await request(app).get('/api/reports?page=1&limit=50').set('Authorization', `Bearer ${empToken}`).expect(200);
  const allOwned = (empReports.body.data || []).every(r => r.ownerId === empAuth.user.id);
  if (!allOwned) throw new Error('Employee sees reports not owned by them!');
  console.log(`[5] PASS: Employee sees ${empReports.body.total} reports, all belong to their UUID`);

  await request(app).get('/api/alerts').set('Authorization', `Bearer ${empToken}`).expect(403);
  console.log('[6] PASS: Employee denied access to /api/alerts (403)');

  // === APPROVER TESTS ===
  console.log('\n--- APPROVER (app@example.com) ---');

  const { data: appAuth, error: appError } = await supabaseClient.auth.signInWithPassword({
    email: process.env.DEMO_APP_EMAIL,
    password: process.env.DEMO_APP_PASSWORD,
  });
  if (appError) throw new Error(`Approver Supabase login failed: ${appError.message}`);
  const appToken = appAuth.session.access_token;
  console.log('[7] PASS: Approver authenticated with Supabase successfully');
  console.log(`       Supabase UID: ${appAuth.user.id}`);

  const meApp = await request(app).get('/api/me').set('Authorization', `Bearer ${appToken}`).expect(200);
  if (meApp.body.role !== 'APPROVER') throw new Error(`Expected APPROVER role, got: ${meApp.body.role}`);
  console.log(`[8] PASS: /api/me resolved -> role=${meApp.body.role}`);
  console.log('[9] PASS: Role=APPROVER confirmed from application database');

  const appReports = await request(app).get('/api/reports?queue=submitted&page=1&limit=50').set('Authorization', `Bearer ${appToken}`).expect(200);
  console.log(`[10] PASS: Approver sees ${appReports.body.total} submitted reports`);

  const alerts = await request(app).get('/api/alerts').set('Authorization', `Bearer ${appToken}`).expect(200);
  console.log(`[11] PASS: Approver can access /api/alerts (${alerts.body.length} alerts)`);

  // === UNAUTHORIZED USER TEST ===
  console.log('\n--- UNAUTHORIZED USER TEST ---');
  await request(app).get('/api/me').set('Authorization', 'Bearer invalid-token-xyz').expect(401);
  console.log('[12] PASS: Invalid/expired token returns 401');

  // === AUTO-PROVISIONING VERIFICATION ===
  console.log('\n--- VERIFYING NO AUTO-PROVISIONING ---');
  // We verify this by checking the User table hasn't grown unexpectedly
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const userCount = await prisma.user.count();
  if (userCount !== 4) throw new Error(`Expected 4 users in DB, found ${userCount}. Auto-provisioning may have occurred!`);
  console.log(`[13] PASS: Exactly 4 users in database - no auto-provisioning occurred`);
  await prisma.$disconnect();

  console.log('\n=== ALL PHASE 12 REAL AUTH TESTS PASSED ===');
  console.log('Authentication method verified: Real Supabase JWT (not mock tokens)');
}

run()
  .catch(e => { console.error('\n[FAIL]', e.message); process.exit(1); });
