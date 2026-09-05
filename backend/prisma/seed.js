const { PrismaClient } = require('@prisma/client');
const { MOCK_IDENTITIES } = require('../src/config/mock-identities');
const prisma = new PrismaClient();

async function main() {
  console.log('Resetting workflow data (preserving users)...');
  await prisma.staleAlert.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.reportHistory.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.reportApprover.deleteMany();
  await prisma.expenseReport.deleteMany();

  // Find or create users safely so real Supabase Auth IDs are preserved
  let emp1 = await prisma.user.findUnique({ where: { email: 'emp@example.com' } });
  if (!emp1) {
    emp1 = await prisma.user.create({
      data: { id: MOCK_IDENTITIES.employeeId, email: 'emp@example.com', name: 'Alice (Employee)', role: 'EMPLOYEE' }
    });
  }

  let emp2 = await prisma.user.findUnique({ where: { email: 'emp2@example.com' } });
  if (!emp2) {
    emp2 = await prisma.user.create({
      data: { id: MOCK_IDENTITIES.employee2Id, email: 'emp2@example.com', name: 'Bob (Employee)', role: 'EMPLOYEE' }
    });
  }

  let app1 = await prisma.user.findUnique({ where: { email: 'app@example.com' } });
  if (!app1) {
    app1 = await prisma.user.create({
      data: { id: MOCK_IDENTITIES.approverId, email: 'app@example.com', name: 'Charlie (Approver)', role: 'APPROVER' }
    });
  }

  let app2 = await prisma.user.findUnique({ where: { email: 'app2@example.com' } });
  if (!app2) {
    app2 = await prisma.user.create({
      data: { id: MOCK_IDENTITIES.approver2Id, email: 'app2@example.com', name: 'Diana (Approver)', role: 'APPROVER' }
    });
  }

  const now = new Date();
  
  // Helpers
  const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const weeksAgo = (weeks) => new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  console.log('Seeding fresh workflows and stale alerts (5-day threshold, 5-hour recurrence)...');

  // 1. DRAFT report (editable)
  await prisma.expenseReport.create({
    data: {
      title: 'Draft Trip to NY', dateFrom: daysAgo(10), dateTo: daysAgo(5),
      status: 'DRAFT', ownerId: emp1.id, isArchived: false,
      lines: { create: [{ amount: 450, category: 'TRAVEL', description: 'Flight', date: daysAgo(9) }] }
    }
  });

  // 2. SUBMITTED (Fresh - submitted 1 day ago, NOT stale yet under 5-day threshold)
  await prisma.expenseReport.create({
    data: {
      title: 'Fresh Submission: Conference Tickets', dateFrom: daysAgo(2), dateTo: daysAgo(1),
      status: 'SUBMITTED', ownerId: emp2.id, submittedAt: daysAgo(1), isArchived: false,
      lines: { create: [{ amount: 200, category: 'SOFTWARE', description: 'Conference Tickets', date: daysAgo(1) }] },
      approvers: { create: [{ approverId: app2.id }] }
    }
  });

  // 3. STALE ALERT for Approver A (submitted 6 days ago, never dismissed -> active alert)
  await prisma.expenseReport.create({
    data: {
      title: 'Stale: Q3 Client Dinner & Flight', dateFrom: daysAgo(8), dateTo: daysAgo(6),
      status: 'SUBMITTED', ownerId: emp1.id, submittedAt: daysAgo(6), isArchived: false,
      lines: { 
        create: [
          { amount: 450, category: 'TRAVEL', description: 'Client Flight', date: daysAgo(7) },
          { amount: 150, category: 'MEALS', description: 'Dinner with Client', date: daysAgo(6) }
        ] 
      },
      approvers: { create: [{ approverId: app1.id }] }
    }
  });

  // 4. RECURRED STALE ALERT for Approver A (submitted 7 days ago, dismissed 6 hours ago -> recurred!)
  const recurredAlert = await prisma.expenseReport.create({
    data: {
      title: 'Stale: Office Hardware Equipment (Recurred)', dateFrom: daysAgo(9), dateTo: daysAgo(7),
      status: 'SUBMITTED', ownerId: emp2.id, submittedAt: daysAgo(7), isArchived: false,
      lines: { 
        create: [
          { amount: 780, category: 'EQUIPMENT', description: '4K Monitor and Dock', date: daysAgo(8) }
        ] 
      },
      approvers: { create: [{ approverId: app1.id }] }
    }
  });
  await prisma.staleAlert.create({
    data: { reportId: recurredAlert.id, approverId: app1.id, dismissedAt: hoursAgo(6) }
  });

  // 5. STALE ALERT for Approver B (submitted 6 days ago, never dismissed -> active alert)
  await prisma.expenseReport.create({
    data: {
      title: 'Stale: Team Software Subscriptions', dateFrom: daysAgo(8), dateTo: daysAgo(6),
      status: 'SUBMITTED', ownerId: emp1.id, submittedAt: daysAgo(6), isArchived: false,
      lines: { 
        create: [
          { amount: 350, category: 'SOFTWARE', description: 'Design tools annual subscription', date: daysAgo(7) },
          { amount: 75, category: 'SUPPLIES', description: 'Notebooks and Pens', date: daysAgo(6) }
        ] 
      },
      approvers: { create: [{ approverId: app2.id }] }
    }
  });

  // 6. DISMISSED ALERT for Approver B (submitted 6 days ago, dismissed 2 hours ago -> currently hidden, recurs in 3h)
  const dismissedAlert = await prisma.expenseReport.create({
    data: {
      title: 'Stale: Client Hotel Accommodation (Dismissed - will recur in 3h)', dateFrom: daysAgo(9), dateTo: daysAgo(6),
      status: 'SUBMITTED', ownerId: emp2.id, submittedAt: daysAgo(6), isArchived: false,
      lines: { 
        create: [
          { amount: 620, category: 'ACCOMMODATION', description: 'Hotel stay during client visit', date: daysAgo(7) }
        ] 
      },
      approvers: { create: [{ approverId: app2.id }] }
    }
  });
  await prisma.staleAlert.create({
    data: { reportId: dismissedAlert.id, approverId: app2.id, dismissedAt: hoursAgo(2) }
  });

  // 7. APPROVED
  await prisma.expenseReport.create({
    data: {
      title: 'Team Building Offsite', dateFrom: daysAgo(3), dateTo: daysAgo(2),
      status: 'APPROVED', ownerId: emp1.id, submittedAt: daysAgo(2), approvedAt: daysAgo(1), isArchived: false,
      lines: { create: [{ amount: 800, category: 'OTHER', description: 'Event Space', date: daysAgo(2) }] },
      approvers: { create: [{ approverId: app2.id }] }
    }
  });

  // 8. REJECTED
  await prisma.expenseReport.create({
    data: {
      title: 'Over policy limits: Gold Watch', dateFrom: daysAgo(30), dateTo: daysAgo(29),
      status: 'REJECTED', ownerId: emp1.id, submittedAt: daysAgo(28), isArchived: false,
      lines: { create: [{ amount: 5000, category: 'EQUIPMENT', description: 'Gold Watch', date: daysAgo(29) }] },
      history: { create: [{ toStatus: 'REJECTED', actorId: app1.id, reason: 'Exceeds policy limits' }] }
    }
  });

  // 9. PAID
  await prisma.expenseReport.create({
    data: {
      title: 'Office Stationary', dateFrom: daysAgo(5), dateTo: daysAgo(5),
      status: 'PAID', ownerId: emp2.id, submittedAt: daysAgo(4), approvedAt: daysAgo(3), paidAt: daysAgo(1), isArchived: false,
      lines: { create: [{ amount: 45.50, category: 'SUPPLIES', description: 'Whiteboard markers', date: daysAgo(5) }] }
    }
  });

  console.log('Seeding 8-week history data for dashboard...');
  const categories = ['TRAVEL', 'MEALS', 'ACCOMMODATION', 'SUPPLIES', 'SOFTWARE', 'EQUIPMENT'];
  for (let i = 1; i <= 7; i++) {
    const pDate = weeksAgo(i);
    await prisma.expenseReport.create({
      data: {
        title: `Historic Paid Week ${i}`, dateFrom: pDate, dateTo: pDate,
        status: 'PAID', ownerId: emp1.id, submittedAt: daysAgo(i*7 + 3), approvedAt: daysAgo(i*7 + 2), paidAt: pDate, isArchived: false,
        lines: { 
          create: [
            { amount: 100 + (i * 20), category: categories[i % categories.length], description: 'Historic', date: pDate },
            { amount: 50, category: 'MEALS', description: 'Historic Food', date: pDate }
          ] 
        }
      }
    });
  }

  console.log('Seeding Complete! Demo stale alerts configured for 5 days and 5 hours recurrence.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });