const prisma = require('../config/prisma');
const reportService = require('./report.service');

// Utility to get Monday 00:00:00 UTC of the current week
function getStartOfWeek() {
  const d = new Date();
  const day = d.getUTCDay();
  // If day is 0 (Sunday), diff is -6 days. Otherwise diff is 1 - day.
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0));
}

// Utility to get the ISO week string (e.g. '2026-W34')
function getISOWeek(d) {
  const date = new Date(d.getTime());
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

class AnalyticsService {
  async getDashboardAnalytics(userId, userRole) {
    // 1. Single Source of Truth for Authorization
    const authAndArray = reportService.getAuthorizationFilter(userId, userRole, 'all');
    const baseAuthFilter = { AND: authAndArray };
    const startOfWeek = getStartOfWeek();

    // 2. Awaiting Approval (Count of SUBMITTED)
    const awaitingApproval = await prisma.expenseReport.count({
      where: { ...baseAuthFilter, status: 'SUBMITTED' }
    });

    // 3. Reimbursements Due (Sum of lines for APPROVED)
    const reimbursementsDueResult = await prisma.expenseLine.aggregate({
      _sum: { amount: true },
      where: {
        report: { ...baseAuthFilter, status: 'APPROVED' }
      }
    });
    const reimbursementsDue = Number(reimbursementsDueResult._sum.amount || 0);

    // 4. Approved This Week (Count of reports approved >= startOfWeek)
    const approvedThisWeek = await prisma.expenseReport.count({
      where: { 
        ...baseAuthFilter, 
        approvedAt: { gte: startOfWeek } 
      }
    });

    // 5. Paid This Week (Count of reports paid >= startOfWeek)
    const paidThisWeek = await prisma.expenseReport.count({
      where: { 
        ...baseAuthFilter, 
        paidAt: { gte: startOfWeek } 
      }
    });

    // 6. Status Breakdown (Group by status)
    const statusGroups = await prisma.expenseReport.groupBy({
      by: ['status'],
      _count: true,
      where: baseAuthFilter
    });
    const statusBreakdown = {
      DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, PAID: 0
    };
    statusGroups.forEach(g => {
      statusBreakdown[g.status] = g._count;
    });

    // 7. Category Breakdown (Sum of lines grouped by category for authorized reports)
    const categoryGroups = await prisma.expenseLine.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { report: baseAuthFilter }
    });
    const categoryBreakdown = {};
    categoryGroups.forEach(g => {
      categoryBreakdown[g.category] = Number(g._sum.amount || 0);
    });

    // 8. Eight-Week Trend (Sum of lines for PAID reports in last 8 weeks)
    const eightWeeksAgo = new Date(startOfWeek);
    eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - (7 * 7));

    const paidReports = await prisma.expenseReport.findMany({
      where: {
        AND: [
          ...authAndArray,
          { status: 'PAID' },
          { paidAt: { gte: eightWeeksAgo } }
        ]
      },
      select: {
        paidAt: true,
        lines: { select: { amount: true } }
      }
    });

    // Initialize the last 8 weeks with 0
    const eightWeekTrendMap = new Map();
    for (let i = 0; i < 8; i++) {
      const weekDate = new Date(eightWeeksAgo);
      weekDate.setUTCDate(weekDate.getUTCDate() + (i * 7));
      eightWeekTrendMap.set(getISOWeek(weekDate), 0);
    }

    // Populate the buckets
    paidReports.forEach(r => {
      if (r.paidAt) {
        const weekStr = getISOWeek(r.paidAt);
        if (eightWeekTrendMap.has(weekStr)) {
          const total = r.lines.reduce((sum, line) => sum + Number(line.amount), 0);
          eightWeekTrendMap.set(weekStr, eightWeekTrendMap.get(weekStr) + total);
        }
      }
    });

    // Convert map to array in chronological order
    const eightWeekTrend = Array.from(eightWeekTrendMap.entries()).map(([week, total]) => ({
      week,
      total
    }));

    return {
      awaitingApproval,
      reimbursementsDue,
      approvedThisWeek,
      paidThisWeek,
      statusBreakdown,
      categoryBreakdown,
      eightWeekTrend
    };
  }
}

module.exports = new AnalyticsService();

