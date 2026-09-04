/**
 * seed-production.js
 *
 * Populates the Supabase PostgreSQL database with demo data using REAL
 * Supabase Auth UUIDs. These UUIDs must match the users created in the
 * Supabase Authentication dashboard.
 *
 * WARNING: This script DELETES ALL existing application data before seeding.
 * Only run this against a database dedicated to this application.
 * Run with: node backend/prisma/seed-production.js
 *
 * DO NOT use this file for automated testing. Use seed.js (mock UUIDs) for that.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Real Supabase Auth UUIDs - must match Supabase Authentication dashboard
const PROD_IDENTITIES = {
  alice:   { id: '138af97a-5093-4f4d-9a52-e14035855c21', email: 'emp@example.com',  name: 'Alice (Employee)',   role: 'EMPLOYEE'  },
  bob:     { id: 'c7d3cbe4-6d77-4bdf-bb78-86140310f24f', email: 'emp2@example.com', name: 'Bob (Employee)',     role: 'EMPLOYEE'  },
  charlie: { id: '6052fd81-dd16-40ef-a42c-55ce86983581', email: 'app@example.com',  name: 'Charlie (Approver)', role: 'APPROVER'  },
  diana:   { id: '87afadf2-ff76-4144-824e-735054ea5e5d', email: 'app2@example.com', name: 'Diana (Approver)',   role: 'APPROVER'  },
};

async function main() {
  console.log('=== Production Seed ===');
  console.log('This will DELETE all existing application data and reseed with real Supabase UUIDs.');
  console.log('');

  console.log('Step 1: Clearing existing data (cascade order)...');
  await prisma.staleAlert.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.reportHistory.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.reportApprover.deleteMany();
  await prisma.expenseReport.deleteMany();
  await prisma.user.deleteMany();
  console.log('  Cleared all application data.');

  console.log('Step 2: Creating authorized application users with real Supabase Auth UUIDs...');
  const alice   = await prisma.user.create({ data: PROD_IDENTITIES.alice });
  const bob     = await prisma.user.create({ data: PROD_IDENTITIES.bob });
  const charlie = await prisma.user.create({ data: PROD_IDENTITIES.charlie });
  const diana   = await prisma.user.create({ data: PROD_IDENTITIES.diana });
  console.log(`  Created: ${alice.name} (${alice.id})`);
  console.log(`  Created: ${bob.name} (${bob.id})`);
  console.log(`  Created: ${charlie.name} (${charlie.id})`);
  console.log(`  Created: ${diana.name} (${diana.id})`);

  const now = new Date();
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const weeksAgo = (weeks) => new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  console.log('Step 3: Seeding active report workflows...');

  // DRAFT
  await prisma.expenseReport.create({
    data: {
      title: 'Draft Trip to NY', dateFrom: daysAgo(10), dateTo: daysAgo(5),
      status: 'DRAFT', ownerId: alice.id,
      lines: { create: [{ amount: 450, category: 'TRAVEL', description: 'Flight', date: daysAgo(9) }] }
    }
  });

  // SUBMITTED (Fresh - 1 day old, not stale)
  await prisma.expenseReport.create({
    data: {
      title: 'Conference Tickets', dateFrom: daysAgo(4), dateTo: daysAgo(2),
      status: 'SUBMITTED', ownerId: bob.id, submittedAt: daysAgo(1),
      lines: { create: [{ amount: 200, category: 'SOFTWARE', description: 'Tickets', date: daysAgo(3) }] },
      approvers: { create: [{ approverId: charlie.id }, { approverId: diana.id }] }
    }
  });

  // SUBMITTED (Stale! 6 days old - triggers stale alert for Charlie)
  await prisma.expenseReport.create({
    data: {
      title: 'Stale Report: Ignored Meals', dateFrom: daysAgo(20), dateTo: daysAgo(18),
      status: 'SUBMITTED', ownerId: alice.id, submittedAt: daysAgo(6),
      lines: { create: [{ amount: 150, category: 'MEALS', description: 'Client Dinner', date: daysAgo(19) }] },
      approvers: { create: [{ approverId: charlie.id }] }
    }
  });

  // SUBMITTED (Dismissed Stale - 7 days old, dismissed 1 day ago - not redisplayed yet)
  const dismissedStale = await prisma.expenseReport.create({
    data: {
      title: 'Dismissed Stale Report', dateFrom: daysAgo(25), dateTo: daysAgo(20),
      status: 'SUBMITTED', ownerId: bob.id, submittedAt: daysAgo(7),
      lines: { create: [{ amount: 300, category: 'ACCOMMODATION', description: 'Hotel', date: daysAgo(22) }] },
      approvers: { create: [{ approverId: charlie.id }] }
    }
  });
  await prisma.staleAlert.create({
    data: { reportId: dismissedStale.id, approverId: charlie.id, dismissedAt: daysAgo(1) }
  });

  // APPROVED (Awaiting Payment)
  await prisma.expenseReport.create({
    data: {
      title: 'Team Building', dateFrom: daysAgo(3), dateTo: daysAgo(2),
      status: 'APPROVED', ownerId: alice.id, submittedAt: daysAgo(2), approvedAt: daysAgo(1),
      lines: { create: [{ amount: 800, category: 'OTHER', description: 'Event Space', date: daysAgo(2) }] },
      approvers: { create: [{ approverId: diana.id }] }
    }
  });

  // REJECTED
  await prisma.expenseReport.create({
    data: {
      title: 'Over policy limits', dateFrom: daysAgo(30), dateTo: daysAgo(29),
      status: 'REJECTED', ownerId: alice.id, submittedAt: daysAgo(28),
      lines: { create: [{ amount: 5000, category: 'EQUIPMENT', description: 'Gold Laptop', date: daysAgo(29) }] },
      history: { create: [{ toStatus: 'REJECTED', actorId: charlie.id, reason: 'Exceeds equipment limit' }] }
    }
  });

  // PAID (Recent)
  await prisma.expenseReport.create({
    data: {
      title: 'Office Supplies', dateFrom: daysAgo(5), dateTo: daysAgo(5),
      status: 'PAID', ownerId: bob.id, submittedAt: daysAgo(4), approvedAt: daysAgo(3), paidAt: daysAgo(1),
      lines: { create: [{ amount: 45.50, category: 'SUPPLIES', description: 'Pens and notebooks', date: daysAgo(5) }] }
    }
  });

  console.log('Step 4: Seeding 7-week paid history for analytics trend chart...');
  const categories = ['TRAVEL', 'MEALS', 'ACCOMMODATION', 'SUPPLIES', 'SOFTWARE', 'EQUIPMENT'];
  for (let i = 1; i <= 7; i++) {
    const pDate = weeksAgo(i);
    await prisma.expenseReport.create({
      data: {
        title: `Historic Paid Week ${i}`, dateFrom: pDate, dateTo: pDate,
        status: 'PAID', ownerId: alice.id,
        submittedAt: daysAgo(i * 7 + 3), approvedAt: daysAgo(i * 7 + 2), paidAt: pDate,
        lines: {
          create: [
            { amount: 100 + (i * 20), category: categories[i % categories.length], description: 'Historic', date: pDate },
            { amount: 50, category: 'MEALS', description: 'Historic Food', date: pDate }
          ]
        }
      }
    });
  }

  console.log('');
  console.log('=== Production Seed Complete ===');
  console.log('Demo data is ready. Authorized users:');
  Object.values(PROD_IDENTITIES).forEach(u => console.log(`  ${u.role}: ${u.email}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
