const fs = require('fs');
const path = require('path');

// 1. Fix Controller
const controllerPath = path.join(__dirname, 'src/controllers/report.controller.js');
let cContent = fs.readFileSync(controllerPath, 'utf8');

const oldList = `  async list(req, res) {
    try {
      const includeArchived = req.query.archived === 'true';
      const reports = await reportService.getMyReports(req.user.id, includeArchived);
      res.json(reports);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }`;

const newList = `  async list(req, res) {
    try {
      const { queue } = req.query;
      
      // Block EMPLOYEEs from accessing specialized queues
      if (req.user.role === 'EMPLOYEE' && (queue === 'submitted' || queue === 'assigned')) {
        return res.status(403).json({ error: 'Forbidden: Employees cannot access approver queues' });
      }

      const reports = await reportService.getReports(req.user.id, req.user.role, queue);
      res.json(reports);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }`;

cContent = cContent.replace(oldList, newList);
fs.writeFileSync(controllerPath, cContent);

// 2. Fix Service
const servicePath = path.join(__dirname, 'src/services/report.service.js');
let sContent = fs.readFileSync(servicePath, 'utf8');

const oldGetReportsRegex = /async getMyReports[\s\S]*?\}\)\.then\(reports => reports\.map\(this\._calculateTotal\)\);\n  \}/;

const newGetReports = `async getReports(userId, userRole, queue = null) {
    // EMPLOYEE: Can only ever see their own reports.
    if (userRole === 'EMPLOYEE') {
      return prisma.expenseReport.findMany({
        where: { ownerId: userId, isArchived: false },
        include: { lines: true, history: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' }
      }).then(reports => reports.map(this._calculateTotal));
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
    }).then(reports => reports.map(this._calculateTotal));
  }`;

sContent = sContent.replace(oldGetReportsRegex, newGetReports);
fs.writeFileSync(servicePath, sContent);
console.log('Update complete.');
