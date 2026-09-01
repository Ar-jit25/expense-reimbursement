require('dotenv').config();
const prisma = require('./src/config/prisma');
const express = require('express');
const reportRoutes = require('./src/routes/report.routes');
const request = require('supertest');

// MOCK SUPABASE FOR TESTING (due to rate limits)
const supabase = require('./src/config/supabase');
const employeeId = '00000000-0000-0000-0000-000000000011';
const approverId = '00000000-0000-0000-0000-000000000022';
const approver2Id = '00000000-0000-0000-0000-000000000033';

supabase.auth.getUser = async (token) => {
  if (token === 'TOKEN_EMP') return { data: { user: { id: employeeId, email: 'emp@example.com' } }, error: null };
  if (token === 'TOKEN_APP') return { data: { user: { id: approverId, email: 'app@example.com' } }, error: null };
  if (token === 'TOKEN_APP2') return { data: { user: { id: approver2Id, email: 'app2@example.com' } }, error: null };
  return { data: { user: null }, error: { message: 'Invalid token' } };
};

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

async function runTests() {
  console.log("Starting Phase 4 Verification...");
  
  // Clean up
  await prisma.reportHistory.deleteMany({});
  await prisma.expenseReport.deleteMany({});
  await prisma.user.deleteMany({ where: { id: { in: [employeeId, approverId, approver2Id] } } });

  // Create users & set roles
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_EMP');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP2');
  
  await prisma.user.updateMany({
    where: { id: { in: [approverId, approver2Id] } },
    data: { role: 'APPROVER' }
  });

  // Step 1: Create a base report
  let res = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_EMP').send({
    title: 'Phase 4 Trip', dateFrom: '2026-09-01', dateTo: '2026-09-05'
  });
  const repId = res.body.id;

  // Verify generic update cannot change status
  console.log("-> Verifying generic updates cannot bypass state machine");
  await request(app).put(`/api/reports/${repId}`).set('Authorization', 'Bearer TOKEN_EMP').send({ status: 'APPROVED' });
  let check = await prisma.expenseReport.findUnique({ where: { id: repId }});
  if (check.status !== 'DRAFT') throw new Error('Status bypassed via generic update');

  // Verify Invalid Transition
  console.log("-> Verifying invalid transition (DRAFT -> APPROVED)");
  res = await request(app).post(`/api/reports/${repId}/approve`).set('Authorization', 'Bearer TOKEN_APP');
  if (res.status !== 400) throw new Error('Allowed invalid transition');

  // 1. DRAFT -> SUBMITTED
  console.log("-> Verifying DRAFT -> SUBMITTED");
  res = await request(app).post(`/api/reports/${repId}/submit`).set('Authorization', 'Bearer TOKEN_EMP');
  if (res.status !== 200 || res.body.status !== 'SUBMITTED') throw new Error('Submit failed');

  // Verify timestamp & history
  check = await prisma.expenseReport.findUnique({ where: { id: repId }, include: { history: true }});
  if (!check.submittedAt) throw new Error('submittedAt timestamp missing');
  if (check.history.length !== 1 || check.history[0].toStatus !== 'SUBMITTED') throw new Error('History entry missing');

  // Verify Draft restrictions
  console.log("-> Verifying edit restriction on submitted reports");
  res = await request(app).put(`/api/reports/${repId}`).set('Authorization', 'Bearer TOKEN_EMP').send({ title: 'Hacked' });
  if (res.status !== 400) throw new Error('Allowed editing submitted report');

  // Verify Self-Approval Blocked
  console.log("-> Verifying approver cannot approve own report");
  let selfRes = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_APP').send({
    title: 'App Trip', dateFrom: '2026-09-01', dateTo: '2026-09-05'
  });
  let selfRep = selfRes.body.id;
  await request(app).post(`/api/reports/${selfRep}/submit`).set('Authorization', 'Bearer TOKEN_APP');
  res = await request(app).post(`/api/reports/${selfRep}/approve`).set('Authorization', 'Bearer TOKEN_APP');
  if (res.status !== 403) throw new Error('Self approval not blocked');

  // 3. SUBMITTED -> REJECTED
  console.log("-> Verifying SUBMITTED -> REJECTED requires reason");
  res = await request(app).post(`/api/reports/${repId}/reject`).set('Authorization', 'Bearer TOKEN_APP');
  if (res.status !== 400) throw new Error('Rejected without reason');

  res = await request(app).post(`/api/reports/${repId}/reject`).set('Authorization', 'Bearer TOKEN_APP').send({ reason: 'Receipts missing' });
  if (res.status !== 200 || res.body.status !== 'REJECTED') throw new Error('Reject failed');

  // 5. REJECTED -> DRAFT
  console.log("-> Verifying REJECTED -> DRAFT");
  res = await request(app).post(`/api/reports/${repId}/reset`).set('Authorization', 'Bearer TOKEN_EMP');
  if (res.status !== 200 || res.body.status !== 'DRAFT') throw new Error('Reset failed');

  // Resubmit & 2. SUBMITTED -> APPROVED
  console.log("-> Verifying SUBMITTED -> APPROVED");
  await request(app).post(`/api/reports/${repId}/submit`).set('Authorization', 'Bearer TOKEN_EMP');
  res = await request(app).post(`/api/reports/${repId}/approve`).set('Authorization', 'Bearer TOKEN_APP');
  if (res.status !== 200 || res.body.status !== 'APPROVED') throw new Error('Approve failed');
  check = await prisma.expenseReport.findUnique({ where: { id: repId }, include: { history: true }});
  if (!check.approvedAt) throw new Error('approvedAt timestamp missing');

  // 4. APPROVED -> PAID
  console.log("-> Verifying APPROVED -> PAID");
  res = await request(app).post(`/api/reports/${repId}/pay`).set('Authorization', 'Bearer TOKEN_APP');
  if (res.status !== 200 || res.body.status !== 'PAID') throw new Error('Pay failed');
  check = await prisma.expenseReport.findUnique({ where: { id: repId }});
  if (!check.paidAt) throw new Error('paidAt timestamp missing');

  // Verify no backwards movement from PAID
  console.log("-> Verifying PAID report cannot move backwards");
  res = await request(app).post(`/api/reports/${repId}/submit`).set('Authorization', 'Bearer TOKEN_EMP');
  if (res.status !== 400) throw new Error('Paid report moved backwards');

  // Verify History
  console.log("-> Verifying immutable history log");
  check = await prisma.expenseReport.findUnique({ where: { id: repId }, include: { history: { orderBy: { id: 'asc' } } }});
  const statuses = check.history.map(h => h.toStatus);
  const expected = ['SUBMITTED', 'REJECTED', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PAID'];
  if (JSON.stringify(statuses) !== JSON.stringify(expected)) throw new Error('History log incorrect');

  console.log("\n✅ ALL PHASE 4 VERIFICATIONS PASSED!");
  process.exit(0);
}

runTests().catch(e => {
  console.error("❌ TEST FAILED:", e.message);
  process.exit(1);
});
