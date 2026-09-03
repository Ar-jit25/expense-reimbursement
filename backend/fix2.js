const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, 'src/services/report.service.js');
let sContent = fs.readFileSync(servicePath, 'utf8');

const oldMethod = `  async getMyReports(ownerId, includeArchived = false) {
    const where = { ownerId };
    if (!includeArchived) {
      where.isArchived = false;
    }
    
    // Fetch reports with their lines to calculate totals
    const reports = await prisma.expenseReport.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total on the fly
    return reports.map(report => ({
      ...report,
      total: report.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    }));
  }`;

const newMethod = `  _calculateTotal(report) {
    if (!report.lines) return report;
    return {
      ...report,
      total: report.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    };
  }

  async getReports(userId, userRole, queue = null) {
    // EMPLOYEE: Can only ever see their own reports.
    if (userRole === 'EMPLOYEE') {
      return prisma.expenseReport.findMany({
        where: { ownerId: userId, isArchived: false },
        include: { lines: true, history: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' }
      }).then(reports => reports.map(r => this._calculateTotal(r)));
    }
    
    // APPROVER: Can see multiple queues
    let whereClause = { isArchived: false };
    
    if (queue === 'submitted') {
      whereClause.status = 'SUBMITTED';
    } else if (queue === 'assigned') {
      whereClause.status = 'SUBMITTED';
      whereClause.approvers = { some: { approverId: userId } };
    } else {
      // Default APPROVER view: own reports OR reports submitted by others
      whereClause = {
        isArchived: false,
        OR: [
          { ownerId: userId },
          { status: { in: ['SUBMITTED', 'APPROVED', 'PAID'] } }
        ]
      };
    }

    return prisma.expenseReport.findMany({
      where: whereClause,
      include: { lines: true, history: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' }
    }).then(reports => reports.map(r => this._calculateTotal(r)));
  }`;

sContent = sContent.replace(oldMethod, newMethod);
fs.writeFileSync(servicePath, sContent);
console.log("Service getReports updated");
