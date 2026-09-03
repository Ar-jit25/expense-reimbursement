require('dotenv').config();
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const prisma = require('./src/config/prisma');
const { requireAuth } = require('./src/middleware/auth');
const reportRoutes = require('./src/routes/report.routes');


// MOCK SUPABASE FOR TESTING (due to rate limits)
const supabase = require('./src/config/supabase');
const employeeId = '00000000-0000-0000-0000-000000000011';
const approverId = '00000000-0000-0000-0000-000000000022';
const approver2Id = '00000000-0000-0000-0000-000000000033';

supabase.auth.getUser = async (token) => {
  if (token === 'TOKEN_EMP') return { data: { user: { id: employeeId, email: 'emp@example.com' } }, error: null };
  if (token === 'TOKEN_APP1') return { data: { user: { id: approverId, email: 'app@example.com' } }, error: null };
  if (token === 'TOKEN_APP2') return { data: { user: { id: approver2Id, email: 'app2@example.com' } }, error: null };
  return { data: { user: null }, error: { message: 'Invalid token' } };
};

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);


async function runTests() {
  console.log('Starting Phase 8 Verification...');
  
  // Clean & Seed Database for Tests
  await prisma.reportApprover.deleteMany();
  await prisma.reportHistory.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.expenseReport.deleteMany();
  await prisma.user.deleteMany();

  // Create users & set roles
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_EMP');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP1');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP2');
  
  await prisma.user.updateMany({
    where: { id: { in: [approverId, approver2Id] } },
    data: { role: 'APPROVER' }
  });

  // Create test reports
  const r1 = await prisma.expenseReport.create({ data: { title: 'R1', ownerId: employeeId, status: 'SUBMITTED', dateFrom: new Date(), dateTo: new Date() } });
  const r2 = await prisma.expenseReport.create({ data: { title: 'R2', ownerId: employeeId, status: 'SUBMITTED', dateFrom: new Date(), dateTo: new Date() } });
  const rSelf = await prisma.expenseReport.create({ data: { title: 'Self', ownerId: approverId, status: 'SUBMITTED', dateFrom: new Date(), dateTo: new Date() } });
  const rPaid = await prisma.expenseReport.create({ data: { title: 'Paid', ownerId: employeeId, status: 'PAID', dateFrom: new Date(), dateTo: new Date() } });
  const rComma = await prisma.expenseReport.create({ data: { title: 'Comma, Title', ownerId: employeeId, status: 'APPROVED', dateFrom: new Date(), dateTo: new Date() } });

  // Assign app_1 to r1, r2, rSelf, rPaid
  await prisma.reportApprover.createMany({
    data: [
      { reportId: r1.id, approverId: approverId },
      { reportId: r2.id, approverId: approverId },
      { reportId: rSelf.id, approverId: approverId },
      { reportId: rPaid.id, approverId: approverId }
    ]
  });

  // 1. Bulk Approve - Mixed Success/Failure
  console.log('-> 1. Verifying Bulk Approve (Valid + Self-Approval + Invalid State + Missing Assignment)');
  const bulkApproveRes = await request(app)
    .post('/api/reports/bulk/approve')
    .set('Authorization', 'Bearer TOKEN_APP1')
    .send({ reportIds: [r1.id, rSelf.id, rPaid.id, rComma.id] });

  if (bulkApproveRes.status !== 200) throw new Error('Bulk approve failed: ' + JSON.stringify(bulkApproveRes.body));
  if (bulkApproveRes.body.successful.length !== 1 || bulkApproveRes.body.successful[0].reportId !== r1.id) throw new Error('Expected 1 successful approval (r1)');
  if (bulkApproveRes.body.failed.length !== 3) throw new Error('Expected 3 failed approvals');
  
  const selfFail = bulkApproveRes.body.failed.find(f => f.reportId === rSelf.id);
  if (!selfFail || !selfFail.error.includes('own report')) throw new Error('Self approval not prevented');
  
  const unassignedFail = bulkApproveRes.body.failed.find(f => f.reportId === rComma.id);
  if (!unassignedFail || !unassignedFail.error.includes('not assigned')) throw new Error('Missing assignment not prevented');

  const stateFail = bulkApproveRes.body.failed.find(f => f.reportId === rPaid.id);
  if (!stateFail || !stateFail.error.includes('Invalid transition')) throw new Error('Invalid state not prevented');


  // 2. Bulk Reject without reason
  console.log('-> 2. Verifying Bulk Reject validation');
  const rejectNoReason = await request(app)
    .post('/api/reports/bulk/reject')
    .set('Authorization', 'Bearer TOKEN_APP1')
    .send({ reportIds: [r2.id] });
  if (rejectNoReason.status !== 400 || !rejectNoReason.body.error.includes('reason is required')) throw new Error('Allowed rejection without reason');

  // 3. Valid Bulk Reject
  console.log('-> 3. Verifying Valid Bulk Reject');
  const bulkRejectRes = await request(app)
    .post('/api/reports/bulk/reject')
    .set('Authorization', 'Bearer TOKEN_APP1')
    .send({ reportIds: [r2.id], reason: 'Invalid' });
  if (bulkRejectRes.status !== 200 || bulkRejectRes.body.successful.length !== 1) throw new Error('Bulk reject failed');

  // 4. CSV Export
  console.log('-> 4. Verifying CSV Export Escaping and Headers');
  const csvRes = await request(app).get('/api/reports/export/csv').set('Authorization', 'Bearer TOKEN_EMP');
  if (csvRes.status !== 200) throw new Error('CSV Export failed');
  if (!csvRes.headers['content-type'].includes('text/csv')) throw new Error('Invalid Content-Type: ' + csvRes.headers['content-type']);
  if (!csvRes.text.includes('"Comma, Title"')) throw new Error('CSV escaping failed for commas');
  
  console.log('\n✅ ALL PHASE 8 VERIFICATIONS PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
