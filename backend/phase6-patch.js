const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, 'src/controllers/report.controller.js');
let cContent = fs.readFileSync(controllerPath, 'utf8');

const oldList = `  async list(req, res) {
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

const newList = `  async list(req, res) {
    try {
      const { queue, search, status, ownerId, approverId, sort, order, page, limit } = req.query;
      
      // Block EMPLOYEEs from accessing specialized queues
      if (req.user.role === 'EMPLOYEE' && (queue === 'submitted' || queue === 'assigned')) {
        return res.status(403).json({ error: 'Forbidden: Employees cannot access approver queues' });
      }

      // Explicit Pagination Validation
      let isPaginated = false;
      let parsedPage = 1;
      let parsedLimit = 10;

      if (page !== undefined || limit !== undefined) {
        isPaginated = true;
        if (page !== undefined) {
          parsedPage = parseInt(page, 10);
          if (isNaN(parsedPage) || parsedPage <= 0) {
            return res.status(400).json({ error: 'Invalid page parameter' });
          }
        }
        if (limit !== undefined) {
          parsedLimit = parseInt(limit, 10);
          if (isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: 'Invalid limit parameter' });
          }
          if (parsedLimit > 100) parsedLimit = 100;
        }
      }

      // Explicit Sort/Order/Status validation
      const validSorts = ['submittedAt', 'status', 'total', 'createdAt'];
      if (sort && !validSorts.includes(sort)) {
        return res.status(400).json({ error: 'Invalid sort parameter' });
      }
      
      const validOrders = ['asc', 'desc'];
      if (order && !validOrders.includes(order)) {
        return res.status(400).json({ error: 'Invalid order parameter' });
      }
      
      const validStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status parameter' });
      }

      const options = {
        queue, search, status, ownerId, approverId, sort, order,
        isPaginated, page: parsedPage, limit: parsedLimit
      };

      const result = await reportService.getReports(req.user.id, req.user.role, options);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }`;

cContent = cContent.replace(oldList, newList);
fs.writeFileSync(controllerPath, cContent);
console.log("Controller updated.");

const servicePath = path.join(__dirname, 'src/services/report.service.js');
let sContent = fs.readFileSync(servicePath, 'utf8');

// Add Prisma import at the top if not exists
if (!sContent.includes('const { Prisma } = require(\'@prisma/client\');')) {
  sContent = sContent.replace("const prisma = require('../config/prisma');", "const prisma = require('../config/prisma');\nconst { Prisma } = require('@prisma/client');");
}

const oldGetReports = `  async getReports(userId, userRole, queue = null) {
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

const newGetReports = `  async getReports(userId, userRole, options = {}) {
    // Phase 6 Query Parameter Contract
    let queue = options; // fallback for phase 3/4/5 calls that pass a string
    if (typeof options === 'object') {
      queue = options.queue;
    } else {
      options = { queue };
    }
    
    const { search, status, ownerId, approverId, sort, order, isPaginated, page, limit } = options;
    
    const AND = [];
    AND.push({ isArchived: false });

    // Authorization & Queues
    if (userRole === 'EMPLOYEE') {
      AND.push({ ownerId: userId });
    } else {
      if (queue === 'submitted') {
        AND.push({ status: 'SUBMITTED' });
      } else if (queue === 'assigned') {
        AND.push({ status: 'SUBMITTED' });
        AND.push({ approvers: { some: { approverId: userId } } });
      } else {
        AND.push({
          OR: [
            { ownerId: userId },
            { status: { in: ['SUBMITTED', 'APPROVED', 'PAID'] } }
          ]
        });
      }
      
      // Additional authorized filters for approvers
      if (ownerId) AND.push({ ownerId });
      if (approverId) AND.push({ approvers: { some: { approverId } } });
    }

    // Common dynamic filters
    if (search) AND.push({ title: { contains: search, mode: 'insensitive' } });
    if (status) AND.push({ status });

    const where = { AND };
    
    // Derived Total Sorting Logic (Authorized IDs Pipeline)
    if (sort === 'total') {
      // Step A & B: Prisma Authorization, Filtering, and Matching Count
      const idsResult = await prisma.expenseReport.findMany({ where, select: { id: true } });
      const idList = idsResult.map(i => i.id);
      const totalCount = idList.length;
      
      let data = [];
      if (totalCount > 0) {
        let sortedIds = idList;
        const joinedIds = Prisma.join(idList);
        const orderSql = order === 'asc' ? Prisma.sql\`ASC\` : Prisma.sql\`DESC\`;
        
        // Step C: PostgreSQL Aggregate Query
        if (isPaginated) {
           const limitSql = limit;
           const offsetSql = (page - 1) * limit;
           const rawResult = await prisma.$queryRaw\`
             SELECT r.id
             FROM "ExpenseReport" r
             LEFT JOIN "ExpenseLine" l ON l."reportId" = r.id
             WHERE r.id IN (\${joinedIds})
             GROUP BY r.id
             ORDER BY SUM(COALESCE(l.amount, 0)) \${orderSql}, r.id ASC
             LIMIT \${limitSql} OFFSET \${offsetSql}
           \`;
           sortedIds = rawResult.map(r => r.id);
        } else {
           const rawResult = await prisma.$queryRaw\`
             SELECT r.id
             FROM "ExpenseReport" r
             LEFT JOIN "ExpenseLine" l ON l."reportId" = r.id
             WHERE r.id IN (\${joinedIds})
             GROUP BY r.id
             ORDER BY SUM(COALESCE(l.amount, 0)) \${orderSql}, r.id ASC
           \`;
           sortedIds = rawResult.map(r => r.id);
        }
        
        // Step D: Hydration
        if (sortedIds.length > 0) {
          const reports = await prisma.expenseReport.findMany({
            where: { id: { in: sortedIds } },
            include: { lines: true, history: { orderBy: { createdAt: 'desc' }, take: 1 } }
          });
          
          const reportMap = new Map(reports.map(r => [r.id, r]));
          // Explicitly restore the database-determined order
          data = sortedIds.map(id => reportMap.get(id)).filter(Boolean);
        }
      }
      
      data = data.map(r => this._calculateTotal(r));
      return isPaginated ? { data, total: totalCount, page, limit } : data;
    }
    
    // Normal Prisma Sorting
    const totalCount = await prisma.expenseReport.count({ where });
    const orderBy = {};
    if (sort) {
      orderBy[sort] = order || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const queryParams = {
      where,
      include: { lines: true, history: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy
    };
    
    if (isPaginated) {
      queryParams.skip = (page - 1) * limit;
      queryParams.take = limit;
    }

    const reports = await prisma.expenseReport.findMany(queryParams);
    const data = reports.map(r => this._calculateTotal(r));
    return isPaginated ? { data, total: totalCount, page, limit } : data;
  }`;

sContent = sContent.replace(oldGetReports, newGetReports);
fs.writeFileSync(servicePath, sContent);
console.log("Service updated.");
