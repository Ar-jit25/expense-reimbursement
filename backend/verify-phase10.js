const request = require('supertest');
const express = require('express');
const app = express();
app.use(express.json());

const alertRoutes = require('./src/routes/alert.routes');
const { requireAuth } = require('./src/middleware/auth');
app.use('/api/alerts', alertRoutes);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MOCK_IDENTITIES } = require('./src/config/mock-identities');

async function runTests() {
  console.log('-> Resetting database for Phase 10 verification...');
  await prisma.staleAlert.deleteMany();
  await prisma.reportHistory.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.reportApprover.deleteMany();
  await prisma.expenseReport.deleteMany();

  const emp = MOCK_IDENTITIES.employeeId;
  const app1 = MOCK_IDENTITIES.approverId;
  const now = new Date();
  
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 1. Fresh submitted report (1 day old) - should NOT be stale
  await prisma.expenseReport.create({
    data: {
      title: 'Fresh Report', dateFrom: daysAgo(2), dateTo: daysAgo(1),
      status: 'SUBMITTED', ownerId: emp, submittedAt: daysAgo(1),
      approvers: { create: [{ approverId: app1 }] }
    }
  });

  // 2. Stale report (6 days old) - should BE stale
  const rStale = await prisma.expenseReport.create({
    data: {
      title: 'Stale Report', dateFrom: daysAgo(10), dateTo: daysAgo(9),
      status: 'SUBMITTED', ownerId: emp, submittedAt: daysAgo(6),
      approvers: { create: [{ approverId: app1 }] }
    }
  });

  // 3. Recently Dismissed (7 days old, dismissed 1 day ago) - should NOT be stale
  const rDismissedRecent = await prisma.expenseReport.create({
    data: {
      title: 'Dismissed Recent', dateFrom: daysAgo(10), dateTo: daysAgo(9),
      status: 'SUBMITTED', ownerId: emp, submittedAt: daysAgo(7),
      approvers: { create: [{ approverId: app1 }] }
    }
  });
  await prisma.staleAlert.create({
    data: { reportId: rDismissedRecent.id, approverId: app1, dismissedAt: daysAgo(1) }
  });

  // 4. Redisplayed (10 days old, dismissed 4 days ago) - should BE stale again
  const rRedisplay = await prisma.expenseReport.create({
    data: {
      title: 'Redisplay Report', dateFrom: daysAgo(15), dateTo: daysAgo(14),
      status: 'SUBMITTED', ownerId: emp, submittedAt: daysAgo(10),
      approvers: { create: [{ approverId: app1 }] }
    }
  });
  await prisma.staleAlert.create({
    data: { reportId: rRedisplay.id, approverId: app1, dismissedAt: daysAgo(4) }
  });

  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/alerts', alertRoutes);

  console.log('-> 1. Testing GET /api/alerts visibility rules...');
  const res = await request(testApp).get('/api/alerts').set('Authorization', 'Bearer TOKEN_APP1').expect(200);
  
  const alerts = res.body.alerts;
  if (alerts.length !== 2) {
    console.error('Expected exactly 2 alerts, got:', alerts.length);
    console.log(alerts.map(a => a.title));
    throw new Error('Alert count mismatch');
  }

  const titles = alerts.map(a => a.title);
  if (!titles.includes('Stale Report') || !titles.includes('Redisplay Report')) {
    throw new Error('Expected specific alerts to be active');
  }

  console.log('-> 2. Testing POST /api/alerts/:id/dismiss...');
  await request(testApp).post(`/api/alerts/${rStale.id}/dismiss`).set('Authorization', 'Bearer TOKEN_APP1').expect(200);

  const resAfter = await request(testApp).get('/api/alerts').set('Authorization', 'Bearer TOKEN_APP1').expect(200);
  if (resAfter.body.alerts.length !== 1) {
    throw new Error('Dismissal failed to hide the alert');
  }
  if (resAfter.body.alerts[0].title !== 'Redisplay Report') {
    throw new Error('Wrong alert was dismissed');
  }

  console.log('\n✅ ALL PHASE 10 VERIFICATIONS PASSED!\n');
}

runTests()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
