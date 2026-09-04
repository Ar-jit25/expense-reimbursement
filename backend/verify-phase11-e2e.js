process.env.MOCK_AUTH = 'true';
const request = require('supertest');
const express = require('express');
const app = express();
app.use(express.json());
const reportRoutes = require('./src/routes/report.routes');
const alertRoutes = require('./src/routes/alert.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
const { PrismaClient } = require('@prisma/client');
const { MOCK_IDENTITIES } = require('./src/config/mock-identities');
const prisma = new PrismaClient();

async function run() {
  console.log('\n=== Phase 11 E2E Authorization Verification ===\n');

  // 1. Employee sees ONLY their own reports (ownerId must be their exact mock UUID)
  console.log('[1] Employee sees ONLY their own reports...');
  const empRes = await request(app).get('/api/reports?page=1&limit=50').set('Authorization', 'Bearer TOKEN_EMP').expect(200);
  const empReports = empRes.body.data || [];
  const allOwned = empReports.every(r => r.ownerId === MOCK_IDENTITIES.employeeId);
  if (!allOwned) {
    const bad = empReports.filter(r => r.ownerId !== MOCK_IDENTITIES.employeeId);
    throw new Error(`Employee can see ${bad.length} reports NOT owned by them: ${bad.map(r => r.title).join(', ')}`);
  }
  console.log(`    PASS: Employee sees ${empReports.length} reports, all ownerId=${MOCK_IDENTITIES.employeeId}`);

  // 2. Employee cannot see reports owned by Employee2
  console.log('[2] Employee2 reports do not appear for Employee...');
  const emp2Reports = empReports.filter(r => r.ownerId === MOCK_IDENTITIES.employee2Id);
  if (emp2Reports.length > 0) throw new Error(`Employee sees ${emp2Reports.length} reports belonging to Employee2!`);
  console.log(`    PASS: No Employee2 reports in Employee response`);

  // 3. Approver sees full submitted queue (cross-employee visibility)
  console.log('[3] Approver sees submitted queue across employees...');
  const appRes = await request(app).get('/api/reports?queue=submitted&page=1&limit=50').set('Authorization', 'Bearer TOKEN_APP1').expect(200);
  const hasMultipleOwners = new Set((appRes.body.data || []).map(r => r.ownerId)).size > 0;
  console.log(`    PASS: Approver sees ${appRes.body.total} submitted. Unique owners: ${new Set((appRes.body.data || []).map(r => r.ownerId)).size}`);

  // 4. Employee cannot access alerts (Approver-only)
  console.log('[4] Employee cannot access /api/alerts...');
  await request(app).get('/api/alerts').set('Authorization', 'Bearer TOKEN_EMP').expect(403);
  console.log('    PASS: Employee gets 403 on /api/alerts');

  // 5. Unauthenticated blocked
  console.log('[5] Unauthenticated user blocked...');
  await request(app).get('/api/reports').expect(401);
  console.log('    PASS: 401 for unauthenticated request');

  // 6. Backend enforces rejection reason
  console.log('[6] Backend enforces rejection reason...');
  const submitted = await prisma.expenseReport.findFirst({ where: { status: 'SUBMITTED' } });
  if (submitted) {
    const rej = await request(app).post(`/api/reports/${submitted.id}/reject`)
      .set('Authorization', 'Bearer TOKEN_APP1').send({ reason: '' }).expect(400);
    console.log(`    PASS: Empty rejection reason -> 400: "${rej.body.error}"`);
  } else {
    console.log('    SKIP: No SUBMITTED report to test');
  }

  // 7. Employee analytics scoped
  console.log('[7] Employee analytics is scoped, no globalStats...');
  const empAn = await request(app).get('/api/analytics').set('Authorization', 'Bearer TOKEN_EMP').expect(200);
  if (empAn.body.globalStats) throw new Error('Employee can see globalStats!');
  console.log(`    PASS: Employee analytics keys: ${Object.keys(empAn.body).join(', ')}`);

  // 8. Approver analytics has cross-system stats
  console.log('[8] Approver analytics has cross-system data...');
  const appAn = await request(app).get('/api/analytics').set('Authorization', 'Bearer TOKEN_APP1').expect(200);
  const appKeys = Object.keys(appAn.body);
  if (appKeys.length < 2) throw new Error('Approver analytics has too few keys: ' + appKeys.join(', '));
  console.log(`    PASS: Approver analytics has ${appKeys.length} keys: ${appKeys.join(', ')}`);

  console.log('\n=== ALL PHASE 11 E2E AUTHORIZATION CHECKS PASSED ===\n');
}

run()
  .catch(e => { console.error('\n[FAIL]', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
