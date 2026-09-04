const { PrismaClient } = require('@prisma/client');
const { MOCK_IDENTITIES } = require('../src/config/mock-identities');
const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database...');
  await prisma.staleAlert.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.reportHistory.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.reportApprover.deleteMany();
  await prisma.expenseReport.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding users...');
  const emp1 = await prisma.user.create({
    data: { id: MOCK_IDENTITIES.employeeId, email: 'emp@example.com', name: 'Alice (Employee)', role: 'EMPLOYEE' }
  });
  const emp2 = await prisma.user.create({
    data: { id: MOCK_IDENTITIES.employee2Id, email: 'emp2@example.com', name: 'Bob (Employee)', role: 'EMPLOYEE' }
  });
  const app1 = await prisma.user.create({
    data: { id: MOCK_IDENTITIES.approverId, email: 'app@example.com', name: 'Charlie (Approver)', role: 'APPROVER' }
  });
  const app2 = await prisma.user.create({
    data: { id: MOCK_IDENTITIES.approver2Id, email: 'app2@example.com', name: 'Diana (Approver)', role: 'APPROVER' }
  });

  const now = new Date();
  
  // Helpers
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const weeksAgo = (weeks) => new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  console.log('Seeding active workflows...');

  // DRAFT
  await prisma.expenseReport.create({
    data: {
      title: 'Draft Trip to NY', dateFrom: daysAgo(10), dateTo: daysAgo(5),
      status: 'DRAFT', ownerId: emp1.id,
      lines: { create: [{ amount: 450, category: 'TRAVEL', description: 'Flight', date: daysAgo(9) }] }
    }
  });

  // SUBMITTED (Fresh)
  await prisma.expenseReport.create({
    data: {
      title: 'Conference Tickets', dateFrom: daysAgo(4), dateTo: daysAgo(2),
      status: 'SUBMITTED', ownerId: emp2.id, submittedAt: daysAgo(1),
      lines: { create: [{ amount: 200, category: 'SOFTWARE', description: 'Tickets', date: daysAgo(3) }] },
      approvers: { create: [{ approverId: app1.id }, { approverId: app2.id }] }
    }
  });

  // SUBMITTED (Stale! 6 days old) - assigned to app1
  await prisma.expenseReport.create({
    data: {
      title: 'Stale Report: Ignored Meals', dateFrom: daysAgo(20), dateTo: daysAgo(18),
      status: 'SUBMITTED', ownerId: emp1.id, submittedAt: daysAgo(6),
      lines: { create: [{ amount: 150, category: 'MEALS', description: 'Client Dinner', date: daysAgo(19) }] },
      approvers: { create: [{ approverId: app1.id }] }
    }
  });

  // SUBMITTED (Dismissed Stale) - 7 days old, dismissed 1 day ago
  const dismissedStale = await prisma.expenseReport.create({
    data: {
      title: 'Dismissed Stale Report', dateFrom: daysAgo(25), dateTo: daysAgo(20),
      status: 'SUBMITTED', ownerId: emp2.id, submittedAt: daysAgo(7),
      lines: { create: [{ amount: 300, category: 'ACCOMMODATION', description: 'Hotel', date: daysAgo(22) }] },
      approvers: { create: [{ approverId: app1.id }] }
    }
  });
  await prisma.staleAlert.create({
    data: { reportId: dismissedStale.id, approverId: app1.id, dismissedAt: daysAgo(1) }
  });

  // APPROVED (Awaiting Payment)
  await prisma.expenseReport.create({
    data: {
      title: 'Team Building', dateFrom: daysAgo(3), dateTo: daysAgo(2),
      status: 'APPROVED', ownerId: emp1.id, submittedAt: daysAgo(2), approvedAt: daysAgo(1),
      lines: { create: [{ amount: 800, category: 'OTHER', description: 'Event Space', date: daysAgo(2) }] },
      approvers: { create: [{ approverId: app2.id }] }
    }
  });

  // REJECTED
  await prisma.expenseReport.create({
    data: {
      title: 'Over policy limits', dateFrom: daysAgo(30), dateTo: daysAgo(29),
      status: 'REJECTED', ownerId: emp1.id, submittedAt: daysAgo(28),
      lines: { create: [{ amount: 5000, category: 'EQUIPMENT', description: 'Gold Laptop', date: daysAgo(29) }] },
      history: { create: [{ toStatus: 'REJECTED', actorId: app1.id, reason: 'Exceeds equipment limit' }] }
    }
  });

  // PAID (Recent)
  await prisma.expenseReport.create({
    data: {
      title: 'Office Supplies', dateFrom: daysAgo(5), dateTo: daysAgo(5),
      status: 'PAID', ownerId: emp2.id, submittedAt: daysAgo(4), approvedAt: daysAgo(3), paidAt: daysAgo(1),
      lines: { create: [{ amount: 45.50, category: 'SUPPLIES', description: 'Pens', date: daysAgo(5) }] }
    }
  });

  console.log('Seeding 8-week history data for dashboard...');
  
  const categories = ['TRAVEL', 'MEALS', 'ACCOMMODATION', 'SUPPLIES', 'SOFTWARE', 'EQUIPMENT'];
  // Seed past 7 weeks
  for (let i = 1; i <= 7; i++) {
    const pDate = weeksAgo(i);
    await prisma.expenseReport.create({
      data: {
        title: `Historic Paid Week ${i}`, dateFrom: pDate, dateTo: pDate,
        status: 'PAID', ownerId: emp1.id, submittedAt: daysAgo(i*7 + 3), approvedAt: daysAgo(i*7 + 2), paidAt: pDate,
        lines: { 
          create: [
            { amount: 100 + (i * 20), category: categories[i % categories.length], description: 'Historic', date: pDate },
            { amount: 50, category: 'MEALS', description: 'Historic Food', date: pDate }
          ] 
        }
      }
    });
  }

  console.log('Seeding Complete! Demo data is ready.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
