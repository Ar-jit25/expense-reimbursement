require('dotenv').config();
const prisma = require('./src/config/prisma');
const express = require('express');
const reportRoutes = require('./src/routes/report.routes');
const request = require('supertest');
const supabase = require('./src/config/supabase');

const employeeId = '00000000-0000-0000-0000-000000000011';
const employee2Id = '00000000-0000-0000-0000-000000000012';
const approver1Id = '00000000-0000-0000-0000-000000000022';
const approver2Id = '00000000-0000-0000-0000-000000000033';

supabase.auth.getUser = async (token) => {
  if (token === 'TOKEN_EMP') return { data: { user: { id: employeeId, email: 'emp@example.com' } }, error: null };
  if (token === 'TOKEN_EMP2') return { data: { user: { id: employee2Id, email: 'emp2@example.com' } }, error: null };
  if (token === 'TOKEN_APP1') return { data: { user: { id: approver1Id, email: 'app1@example.com' } }, error: null };
  if (token === 'TOKEN_APP2') return { data: { user: { id: approver2Id, email: 'app2@example.com' } }, error: null };
  return { data: { user: null }, error: { message: 'Invalid token' } };
};

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

const assertEq = (act, exp, msg) => { if (act !== exp) throw new Error(`${msg}: Expected ${exp}, got ${act}`) };

async function runTests() {
  console.log("Starting Phase 6 Verification...");
  
  await prisma.expenseLine.deleteMany({});
  await prisma.reportApprover.deleteMany({});
  await prisma.reportHistory.deleteMany({});
  await prisma.expenseReport.deleteMany({});
  await prisma.user.deleteMany({ where: { id: { in: [employeeId, employee2Id, approver1Id, approver2Id] } } });

  // Init users
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_EMP');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_EMP2');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP1');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP2');
  
  await prisma.user.updateMany({
    where: { id: { in: [approver1Id, approver2Id] } },
    data: { role: 'APPROVER' }
  });

  // Create Reports
  // Rep 1 (EMP): DRAFT, Total 100
  let r = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_EMP').send({ title: 'Lunch trip', dateFrom: '2026-09-01', dateTo: '2026-09-02' });
  const rep1 = r.body.id;
  await request(app).post(`/api/reports/${rep1}/lines`).set('Authorization', 'Bearer TOKEN_EMP').send({ amount: 100, date: '2026-09-01', category: 'MEALS', description: 'x' });
  
  // Rep 2 (EMP): SUBMITTED, Total 500
  r = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_EMP').send({ title: 'Flight trip', dateFrom: '2026-09-01', dateTo: '2026-09-02' });
  const rep2 = r.body.id;
  await request(app).post(`/api/reports/${rep2}/lines`).set('Authorization', 'Bearer TOKEN_EMP').send({ amount: 500, date: '2026-09-01', category: 'TRAVEL', description: 'x' });
  await request(app).post(`/api/reports/${rep2}/submit`).set('Authorization', 'Bearer TOKEN_EMP');

  // Rep 3 (EMP2): SUBMITTED, Total 300, Assigned to APP2
  r = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_EMP2').send({ title: 'Hotel stay', dateFrom: '2026-09-01', dateTo: '2026-09-02' });
  const rep3 = r.body.id;
  await request(app).post(`/api/reports/${rep3}/lines`).set('Authorization', 'Bearer TOKEN_EMP2').send({ amount: 300, date: '2026-09-01', category: 'ACCOMMODATION', description: 'x' });
  await request(app).post(`/api/reports/${rep3}/submit`).set('Authorization', 'Bearer TOKEN_EMP2');
  await request(app).post(`/api/reports/${rep3}/assignments`).set('Authorization', 'Bearer TOKEN_APP1').send({ approverId: approver2Id });

  console.log("-> 1-3. Search");
  r = await request(app).get('/api/reports?search=flight').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body.length, 1, 'Exact search');
  assertEq(r.body[0].id, rep2, 'Exact search match');
  
  r = await request(app).get('/api/reports?search=TRIP').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body.length, 2, 'Partial case-insensitive');
  
  r = await request(app).get('/api/reports?search=nowhere').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body.length, 0, 'No match');

  console.log("-> 4-6. Authorization");
  // Employee trying to access EMP2
  r = await request(app).get(`/api/reports?ownerId=${employee2Id}`).set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body.length, 2, 'Employee ownerId bypass ignored');
  if (r.body.some(x => x.ownerId !== employeeId)) throw new Error('Employee saw other owner');
  
  r = await request(app).get(`/api/reports?ownerId=${employee2Id}&status=SUBMITTED&page=1&limit=100`).set('Authorization', 'Bearer TOKEN_EMP');
  if (r.body.data.some(x => x.ownerId !== employeeId)) throw new Error('Employee bypassed with combined filters');

  console.log("-> 7-8. Status");
  r = await request(app).get('/api/reports?status=SUBMITTED').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body.length, 1, 'Status filter');
  assertEq(r.body[0].status, 'SUBMITTED', 'Status matches');
  r = await request(app).get('/api/reports?status=INVALID').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.status, 400, 'Invalid status returns 400');

  console.log("-> 9-11. Owner/Approver filtering");
  r = await request(app).get(`/api/reports?ownerId=${employeeId}`).set('Authorization', 'Bearer TOKEN_APP1');
  assertEq(r.body.length, 1, 'Approver filters by owner (sees rep2 which is submitted)');
  r = await request(app).get(`/api/reports?approverId=${approver2Id}`).set('Authorization', 'Bearer TOKEN_APP1');
  assertEq(r.body.length, 1, 'Approver filters by assignment');
  assertEq(r.body[0].id, rep3, 'Sees assigned report');

  console.log("-> 12-15. Queue Compatibility");
  r = await request(app).get('/api/reports?queue=submitted').set('Authorization', 'Bearer TOKEN_APP1');
  assertEq(r.body.length, 2, 'Submitted queue');
  r = await request(app).get('/api/reports?queue=assigned').set('Authorization', 'Bearer TOKEN_APP2');
  assertEq(r.body.length, 1, 'Assigned queue');
  assertEq(r.body[0].id, rep3, 'Assigned queue match');
  // refine queue
  r = await request(app).get(`/api/reports?queue=submitted&ownerId=${employee2Id}`).set('Authorization', 'Bearer TOKEN_APP1');
  assertEq(r.body.length, 1, 'Queue refined');
  
  console.log("-> 16-21. Sorting");
  r = await request(app).get('/api/reports?sort=submittedAt&order=asc').set('Authorization', 'Bearer TOKEN_APP1');
  // Only submitted reports have submittedAt
  if (r.body[0].submittedAt > r.body[1].submittedAt) throw new Error('Sort asc failed');
  r = await request(app).get('/api/reports?sort=submittedAt&order=desc').set('Authorization', 'Bearer TOKEN_APP1');
  if (r.body[0].submittedAt < r.body[1].submittedAt) throw new Error('Sort desc failed');
  
  // Total sort
  r = await request(app).get('/api/reports?sort=total&order=desc').set('Authorization', 'Bearer TOKEN_EMP');
  // rep2 = 500, rep1 = 100
  assertEq(r.body[0].id, rep2, 'Total desc first');
  assertEq(r.body[1].id, rep1, 'Total desc second');
  
  r = await request(app).get('/api/reports?sort=total&order=asc').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body[0].id, rep1, 'Total asc first');
  
  // Zero line sort
  let r0 = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_EMP').send({ title: 'Zero', dateFrom: '2026-09-01', dateTo: '2026-09-02' });
  const rep0 = r0.body.id;
  r = await request(app).get('/api/reports?sort=total&order=asc').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body[0].id, rep0, 'Zero lines sorts first in asc');

  console.log("-> 22-28. Pagination");
  r = await request(app).get('/api/reports?limit=2').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body.data.length, 2, 'Limit triggers pagination');
  assertEq(r.body.total, 3, 'Total count correct');
  assertEq(r.body.page, 1, 'Default page');
  assertEq(r.body.limit, 2, 'Default limit');
  
  let p2 = await request(app).get('/api/reports?limit=2&page=2').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(p2.body.data.length, 1, 'Page 2 length');
  if (r.body.data[0].id === p2.body.data[0].id) throw new Error('Different pages returned same records');
  
  r = await request(app).get('/api/reports?page=-1').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.status, 400, 'Invalid page rejected');
  r = await request(app).get('/api/reports?limit=0').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.status, 400, 'Invalid limit rejected');
  r = await request(app).get('/api/reports?limit=150').set('Authorization', 'Bearer TOKEN_EMP');
  assertEq(r.body.limit, 100, 'Max limit capped');

  // Verify total sorting + pagination combo
  r = await request(app).get('/api/reports?sort=total&order=desc&limit=1&page=2').set('Authorization', 'Bearer TOKEN_EMP');
  // Order: 500 (rep2), 100 (rep1), 0 (rep0). Page 2 limit 1 should be rep1.
  assertEq(r.body.data[0].id, rep1, 'Paginated total sorting works');

  console.log("-> 29-34. Regression Phase 5");
  r = await request(app).post(`/api/reports/${rep3}/approve`).set('Authorization', 'Bearer TOKEN_APP1');
  assertEq(r.status, 403, 'Unassigned approver blocked');
  r = await request(app).post(`/api/reports/${rep3}/approve`).set('Authorization', 'Bearer TOKEN_APP2');
  assertEq(r.status, 200, 'Assigned approver succeeds');
  
  console.log("✅ ALL PHASE 6 VERIFICATIONS PASSED!");
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
