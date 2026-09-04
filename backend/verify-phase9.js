const request = require('supertest');
const express = require('express');
const app = express();
app.use(express.json());
const analyticsRoutes = require('./src/routes/analytics.routes');
app.use('/api/analytics', analyticsRoutes);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MOCK_IDENTITIES } = require('./src/config/mock-identities');

async function seedData() {
  await prisma.comment.deleteMany();
  await prisma.reportHistory.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.reportApprover.deleteMany();
  await prisma.expenseReport.deleteMany();

  const emp = MOCK_IDENTITIES.employeeId;
  const app1 = MOCK_IDENTITIES.approverId;
  const app2 = MOCK_IDENTITIES.approver2Id; // Ensure app2 does not own any to test visibility properly

  const now = new Date();
  
  // R1: SUBMITTED, owned by EMP, assigned to APP1
  const r1 = await prisma.expenseReport.create({
    data: {
      title: 'Analytics 1',
      dateFrom: now, dateTo: now,
      status: 'SUBMITTED', ownerId: emp, submittedAt: now,
      lines: { create: [{ amount: 100, category: 'TRAVEL', description: 'desc', date: now }] },
      approvers: { create: [{ approverId: app1 }] }
    }
  });

  // R2: APPROVED, owned by APP2, assigned to APP1 (so APP1 can see it globally anyway since it's approved)
  const r2 = await prisma.expenseReport.create({
    data: {
      title: 'Analytics 2',
      dateFrom: now, dateTo: now,
      status: 'APPROVED', ownerId: app2, approvedAt: now, submittedAt: now,
      lines: { create: [{ amount: 200, category: 'MEALS', description: 'desc', date: now }] }
    }
  });

  // R3: PAID, owned by EMP, paid this week
  const r3 = await prisma.expenseReport.create({
    data: {
      title: 'Analytics 3',
      dateFrom: now, dateTo: now,
      status: 'PAID', ownerId: emp, paidAt: now, submittedAt: now, approvedAt: now,
      lines: { create: [{ amount: 300, category: 'TRAVEL', description: 'desc', date: now }] }
    }
  });
}

async function runTests() {
  console.log('-> Seeding database for Phase 9 verification...');
  await seedData();

  console.log('-> 1. Verifying Employee Analytics Visibility');
  const empRes = await request(app).get('/api/analytics').set('Authorization', 'Bearer TOKEN_EMP');
  if (empRes.status !== 200) throw new Error('Employee Analytics failed');
  const empAnalytics = empRes.body;
  if (empAnalytics.awaitingApproval !== 1) throw new Error('Employee awaitingApproval mismatch');
  if (empAnalytics.reimbursementsDue !== 0) throw new Error('Employee reimbursementsDue mismatch'); // R2 is owned by app2
  if (empAnalytics.paidThisWeek !== 1) throw new Error('Employee paidThisWeek mismatch');
  
  console.log('-> 2. Verifying Approver Analytics Visibility');
  const appRes = await request(app).get('/api/analytics').set('Authorization', 'Bearer TOKEN_APP1');
  if (appRes.status !== 200) throw new Error('Approver Analytics failed');
  const appAnalytics = appRes.body;
  if (appAnalytics.awaitingApproval !== 1) throw new Error('Approver awaitingApproval mismatch'); // Can see R1
  if (appAnalytics.reimbursementsDue !== 200) throw new Error('Approver reimbursementsDue mismatch'); // Can see R2
  if (appAnalytics.paidThisWeek !== 1) throw new Error('Approver paidThisWeek mismatch'); // Can see R3
  if (appAnalytics.statusBreakdown.SUBMITTED !== 1) throw new Error('Approver status breakdown SUBMITTED mismatch');
  if (appAnalytics.statusBreakdown.APPROVED !== 1) throw new Error('Approver status breakdown APPROVED mismatch');
  if (appAnalytics.statusBreakdown.PAID !== 1) throw new Error('Approver status breakdown PAID mismatch');
  if (appAnalytics.categoryBreakdown.TRAVEL !== 400) throw new Error('Approver category breakdown TRAVEL mismatch');
  if (appAnalytics.categoryBreakdown.MEALS !== 200) throw new Error('Approver category breakdown MEALS mismatch');

  console.log('-> 3. Verifying Eight-Week Trend Calculation');
  if (appAnalytics.eightWeekTrend.length !== 8) throw new Error('Eight week trend array should be 8 items long');
  const currentWeekBucket = appAnalytics.eightWeekTrend[appAnalytics.eightWeekTrend.length - 1];
  if (currentWeekBucket.total !== 300) throw new Error('Eight week trend current bucket total mismatch');

  console.log('\n✅ ALL PHASE 9 VERIFICATIONS PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

