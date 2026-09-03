process.env.MOCK_AUTH = 'true';
﻿require('dotenv').config();
const prisma = require('./src/config/prisma');
const express = require('express');
const reportRoutes = require('./src/routes/report.routes');
const request = require('supertest');

// MOCK SUPABASE FOR TESTING
const supabase = require('./src/config/supabase');
const employeeId = '00000000-0000-0000-0000-000000000011';
const approver1Id = '00000000-0000-0000-0000-000000000022';
const approver2Id = '00000000-0000-0000-0000-000000000033';



const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

async function runTests() {
  console.log("Starting Phase 5 Verification...");
  
  // Clean up
  await prisma.reportApprover.deleteMany({});
  await prisma.reportHistory.deleteMany({});
  await prisma.expenseReport.deleteMany({});
  await prisma.user.deleteMany({ where: { id: { in: [employeeId, approver1Id, approver2Id] } } });

  // Create users & set roles
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_EMP');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP1');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_APP2');
  
  await prisma.user.updateMany({
    where: { id: { in: [approver1Id, approver2Id] } },
    data: { role: 'APPROVER' }
  });

  // Step 1: Create reports
  let res = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_EMP').send({
    title: 'Report EMP', dateFrom: '2026-09-01', dateTo: '2026-09-05'
  });
  const repEmp = res.body.id;

  let res2 = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_APP1').send({
    title: 'Report APP1', dateFrom: '2026-09-01', dateTo: '2026-09-05'
  });
  const repApp1 = res2.body.id;

  // 1. Unauthenticated users cannot manage assignments
  console.log("-> 1. Verifying unauthenticated block");
  res = await request(app).post(`/api/reports/${repEmp}/assignments`).send({ approverId: approver2Id });
  if (res.status !== 401) throw new Error('Unauthenticated user allowed');

  // 2. EMPLOYEE users cannot manage assignments
  console.log("-> 2. Verifying EMPLOYEE block");
  res = await request(app).post(`/api/reports/${repEmp}/assignments`).set('Authorization', 'Bearer TOKEN_EMP').send({ approverId: approver2Id });
  if (res.status !== 403) throw new Error('Employee allowed to manage assignments');

  // 3. Report owner who is APPROVER cannot manage own report assignments
  console.log("-> 3. Verifying self-ownership block for assignments");
  res = await request(app).post(`/api/reports/${repApp1}/assignments`).set('Authorization', 'Bearer TOKEN_APP1').send({ approverId: approver2Id });
  if (res.status !== 403) throw new Error('Owner allowed to manage own assignments');

  // 5. Assignment management fails when report is not SUBMITTED (Currently DRAFT)
  console.log("-> 5. Verifying assignment fails on DRAFT");
  res = await request(app).post(`/api/reports/${repEmp}/assignments`).set('Authorization', 'Bearer TOKEN_APP1').send({ approverId: approver2Id });
  if (res.status !== 400) throw new Error('Assignment allowed on non-SUBMITTED report');

  // Move repEmp to SUBMITTED
  await request(app).post(`/api/reports/${repEmp}/submit`).set('Authorization', 'Bearer TOKEN_EMP');

  // 4. APPROVER can manage assignments for another user's submitted report
  // 8. Valid APPROVER is successfully assigned
  console.log("-> 4/8. Verifying APPROVER can assign");
  res = await request(app).post(`/api/reports/${repEmp}/assignments`).set('Authorization', 'Bearer TOKEN_APP1').send({ approverId: approver2Id });
  if (res.status !== 200) throw new Error('Approver failed to assign');

  // 6. Nonexistent user
  console.log("-> 6. Verifying nonexistent user assignment fails");
  res = await request(app).post(`/api/reports/${repEmp}/assignments`).set('Authorization', 'Bearer TOKEN_APP1').send({ approverId: '00000000-0000-0000-0000-000000000999' });
  if (res.status !== 404) throw new Error('Allowed assigning nonexistent user');

  // 7. EMPLOYEE user assignment fails
  console.log("-> 7. Verifying EMPLOYEE assignment fails");
  res = await request(app).post(`/api/reports/${repEmp}/assignments`).set('Authorization', 'Bearer TOKEN_APP1').send({ approverId: employeeId });
  if (res.status !== 400) throw new Error('Allowed assigning EMPLOYEE');

  // 9. Duplicate assignment triggers idempotent success
  console.log("-> 9. Verifying duplicate assignment is idempotent");
  res = await request(app).post(`/api/reports/${repEmp}/assignments`).set('Authorization', 'Bearer TOKEN_APP1').send({ approverId: approver2Id });
  if (res.status !== 200) throw new Error('Duplicate assignment failed');

  // 10. Removing nonexistent assignment is idempotent
  console.log("-> 10. Verifying nonexistent removal is idempotent");
  res = await request(app).delete(`/api/reports/${repEmp}/assignments/00000000-0000-0000-0000-000000000999`).set('Authorization', 'Bearer TOKEN_APP1');
  if (res.status !== 204) throw new Error('Nonexistent removal failed');

  // 13. EMPLOYEE cannot access approver queues
  console.log("-> 13. Verifying EMPLOYEE queue access block");
  res = await request(app).get('/api/reports?queue=submitted').set('Authorization', 'Bearer TOKEN_EMP');
  if (res.status !== 403) throw new Error('Employee accessed submitted queue');

  // 11. Full submitted queue returns regardless of assignment
  console.log("-> 11. Verifying full submitted queue");
  res = await request(app).get('/api/reports?queue=submitted').set('Authorization', 'Bearer TOKEN_APP1');
  if (res.body.length !== 1 || res.body[0].id !== repEmp) throw new Error('Full submitted queue failed');

  // 12. Assigned queue returns only assigned reports
  console.log("-> 12. Verifying assigned queue");
  res = await request(app).get('/api/reports?queue=assigned').set('Authorization', 'Bearer TOKEN_APP1'); // APP1 is NOT assigned
  if (res.body.length !== 0) throw new Error('Assigned queue returned unassigned report');
  res = await request(app).get('/api/reports?queue=assigned').set('Authorization', 'Bearer TOKEN_APP2'); // APP2 IS assigned
  if (res.body.length !== 1 || res.body[0].id !== repEmp) throw new Error('Assigned queue missing report');

  // 14. Unassigned Approvers blocked from /approve
  console.log("-> 14. Verifying unassigned block on /approve");
  res = await request(app).post(`/api/reports/${repEmp}/approve`).set('Authorization', 'Bearer TOKEN_APP1');
  if (res.status !== 403) throw new Error('Unassigned approver allowed to approve');

  // 16. Self-Approval Protection (owner assigned to own report)
  console.log("-> 16. Verifying self-approval protection overrides assignment");
  await request(app).post(`/api/reports/${repApp1}/submit`).set('Authorization', 'Bearer TOKEN_APP1');
  // Hack assignment manually to test protection
  await prisma.reportApprover.create({ data: { reportId: repApp1, approverId: approver1Id } });
  res = await request(app).post(`/api/reports/${repApp1}/approve`).set('Authorization', 'Bearer TOKEN_APP1');
  if (res.status !== 403) throw new Error('Self approval protection bypassed by assignment!');

  // 15. Assigned Approver can successfully /approve
  console.log("-> 15. Verifying assigned approver can approve");
  res = await request(app).post(`/api/reports/${repEmp}/approve`).set('Authorization', 'Bearer TOKEN_APP2');
  if (res.status !== 200 || res.body.status !== 'APPROVED') throw new Error('Assigned approver failed to approve');

  // 17. Any Approver can /pay an APPROVED report
  console.log("-> 17. Verifying unrestricted /pay");
  res = await request(app).post(`/api/reports/${repEmp}/pay`).set('Authorization', 'Bearer TOKEN_APP1'); // APP1 wasn't assigned, but should be able to pay
  if (res.status !== 200 || res.body.status !== 'PAID') throw new Error('Unrestricted pay failed');

  // 18. Phase 4 rules intact (History check)
  console.log("-> 18. Verifying history intact");
  const history = await prisma.reportHistory.findMany({ where: { reportId: repEmp }, orderBy: { id: 'asc' }});
  if (history.length !== 3 || history[2].toStatus !== 'PAID') throw new Error('History broken');

  console.log("\n✅ ALL PHASE 5 VERIFICATIONS PASSED!");
  process.exit(0);
}

runTests().catch(e => {
  console.error("❌ TEST FAILED:", e.stack);
  process.exit(1);
});
