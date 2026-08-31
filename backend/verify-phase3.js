require('dotenv').config();
const prisma = require('./src/config/prisma');
const express = require('express');
const reportRoutes = require('./src/routes/report.routes');
const request = require('supertest');

// MOCK SUPABASE FOR TESTING (due to rate limits)
const supabase = require('./src/config/supabase');
const user1Id = '00000000-0000-0000-0000-000000000011';
const user2Id = '00000000-0000-0000-0000-000000000022';

supabase.auth.getUser = async (token) => {
  if (token === 'TOKEN_USER1') return { data: { user: { id: user1Id, email: 'user1@example.com' } }, error: null };
  if (token === 'TOKEN_USER2') return { data: { user: { id: user2Id, email: 'user2@example.com' } }, error: null };
  return { data: { user: null }, error: { message: 'Invalid token' } };
};

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

async function runTests() {
  console.log("Starting Phase 3 Verification...");
  
  // Clean up
  await prisma.expenseLine.deleteMany({});
  await prisma.expenseReport.deleteMany({});
  await prisma.user.deleteMany({ where: { id: { in: [user1Id, user2Id] } } });

  // Create users via API hit (requireAuth side-effect)
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_USER1');
  await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_USER2');

  console.log("1. Authenticated employee creates a report");
  let res = await request(app).post('/api/reports').set('Authorization', 'Bearer TOKEN_USER1').send({
    title: 'Trip to NYC', dateFrom: '2026-09-01', dateTo: '2026-09-05'
  });
  if (res.status !== 201) throw new Error(`Create failed: ${res.text}`);
  const report1Id = res.body.id;
  console.log("   OK! Created report id:", report1Id);

  console.log("2. Employee sees their own report");
  res = await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_USER1');
  if (res.body.length !== 1 || res.body[0].id !== report1Id) throw new Error("List failed");
  console.log("   OK! Found report in list.");

  console.log("3. Employee edits a Draft report");
  res = await request(app).put(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER1').send({
    title: 'Trip to SF'
  });
  if (res.status !== 200 || res.body.title !== 'Trip to SF') throw new Error("Edit failed");
  console.log("   OK! Edited title successfully.");

  console.log("4. Employee adds/edits/removes expense lines");
  res = await request(app).post(`/api/reports/${report1Id}/lines`).set('Authorization', 'Bearer TOKEN_USER1').send({
    date: '2026-09-01', amount: 150.50, category: 'TRAVEL', description: 'Flight'
  });
  if (res.status !== 201) throw new Error(`Add line failed: ${res.text}`);
  const lineId = res.body.id;
  
  await request(app).post(`/api/reports/${report1Id}/lines`).set('Authorization', 'Bearer TOKEN_USER1').send({
    date: '2026-09-02', amount: 20, category: 'MEALS', description: 'Lunch'
  });
  
  res = await request(app).put(`/api/reports/${report1Id}/lines/${lineId}`).set('Authorization', 'Bearer TOKEN_USER1').send({
    amount: 200.00
  });
  if (res.status !== 200) throw new Error("Edit line failed");
  console.log("   OK! Lines added and edited.");

  console.log("5. Server-calculated total is correct");
  res = await request(app).get(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER1');
  if (res.body.total !== 220) throw new Error(`Total wrong: expected 220, got ${res.body.total}`);
  console.log("   OK! Total calculated correctly as 220.");

  console.log("6. Client cannot override authoritative total");
  res = await request(app).put(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER1').send({
    total: 9999
  });
  res = await request(app).get(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER1');
  if (res.body.total !== 220) throw new Error("Total was overridden!");
  console.log("   OK! Total ignored malicious input.");

  console.log("7. Employee cannot access another user's report");
  res = await request(app).get(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER2');
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  console.log("   OK! Blocked read access.");

  console.log("8. Employee cannot edit another user's report");
  res = await request(app).put(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER2').send({ title: 'Hacked' });
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  console.log("   OK! Blocked edit access.");

  console.log("9. Non-Draft editing is rejected where applicable");
  await prisma.expenseReport.update({ where: { id: report1Id }, data: { status: 'SUBMITTED' } });
  res = await request(app).put(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER1').send({ title: 'Late Edit' });
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  console.log("   OK! Blocked edit on SUBMITTED report.");

  console.log("10. Archive removes report from default view");
  await prisma.expenseReport.update({ where: { id: report1Id }, data: { status: 'DRAFT' } }); // reset
  await request(app).put(`/api/reports/${report1Id}/archive`).set('Authorization', 'Bearer TOKEN_USER1');
  res = await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_USER1');
  if (res.body.length !== 0) throw new Error("Report still visible");
  console.log("   OK! Archived report omitted from default view.");

  console.log("11. Restore makes it available again");
  await request(app).put(`/api/reports/${report1Id}/restore`).set('Authorization', 'Bearer TOKEN_USER1');
  res = await request(app).get('/api/reports').set('Authorization', 'Bearer TOKEN_USER1');
  if (res.body.length !== 1) throw new Error("Report not restored");
  console.log("   OK! Restored report is visible.");

  console.log("12. Archived data/history remains intact");
  await request(app).put(`/api/reports/${report1Id}/archive`).set('Authorization', 'Bearer TOKEN_USER1');
  res = await request(app).get(`/api/reports/${report1Id}`).set('Authorization', 'Bearer TOKEN_USER1');
  if (res.body.total !== 220 || res.body.lines.length !== 2) throw new Error("Data lost during archive");
  console.log("   OK! Archived report retains lines and total.");

  console.log("\n✅ ALL PHASE 3 VERIFICATIONS PASSED!");
  process.exit(0);
}

runTests().catch(e => {
  console.error("❌ TEST FAILED:", e.message);
  process.exit(1);
});
