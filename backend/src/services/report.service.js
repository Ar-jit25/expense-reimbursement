const prisma = require('../config/prisma');
const { Prisma } = require('@prisma/client');

class ReportService {
  async createReport(ownerId, { title, dateFrom, dateTo }) {
    return prisma.expenseReport.create({
      data: {
        title,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        ownerId,
        status: 'DRAFT',
      }
    });
  }

  _calculateTotal(report) {
    if (!report.lines) return report;
    return {
      ...report,
      total: report.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    };
  }

    // Phase 9: Extracted to a single source of truth for authorization visibility
  getAuthorizationFilter(userId, userRole, queue) {
    const AND = [];
    AND.push({ isArchived: false });

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
    }
    return AND;
  }

  async getReports(userId, userRole, options = {}) {
    // Phase 6 Query Parameter Contract
    let queue = options; // fallback for phase 3/4/5 calls that pass a string
    if (typeof options === 'object') {
      queue = options.queue;
    } else {
      options = { queue };
    }
    
    const { search, status, ownerId, approverId, sort, order, isPaginated, page, limit } = options;
    
    // Call the single source of truth for authorization visibility
    const AND = this.getAuthorizationFilter(userId, userRole, queue);

    // Additional explicit query filters for approvers
    if (userRole !== 'EMPLOYEE') {
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
        const orderSql = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
        
        // Step C: PostgreSQL Aggregate Query
        if (isPaginated) {
           const limitSql = limit;
           const offsetSql = (page - 1) * limit;
           const rawResult = await prisma.$queryRaw`
             SELECT r.id
             FROM "expense_reports" r
             LEFT JOIN "expense_lines" l ON l."reportId" = r.id
             WHERE r.id IN (${joinedIds})
             GROUP BY r.id
             ORDER BY SUM(COALESCE(l.amount, 0)) ${orderSql}, r.id ASC
             LIMIT ${limitSql} OFFSET ${offsetSql}
           `;
           sortedIds = rawResult.map(r => r.id);
        } else {
           const rawResult = await prisma.$queryRaw`
             SELECT r.id
             FROM "expense_reports" r
             LEFT JOIN "expense_lines" l ON l."reportId" = r.id
             WHERE r.id IN (${joinedIds})
             GROUP BY r.id
             ORDER BY SUM(COALESCE(l.amount, 0)) ${orderSql}, r.id ASC
           `;
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
  }

  async getReportById(id, ownerId) {
    const report = await prisma.expenseReport.findUnique({
      where: { id: parseInt(id) },
      include: { lines: true, history: true, comments: true }
    });

    if (!report) return null;
    
    return {
      ...report,
      total: report.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    };
  }

  async updateReport(id, { title, dateFrom, dateTo }) {
    return prisma.expenseReport.update({
      where: { id: parseInt(id) },
      data: {
        title,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined
      }
    });
  }

  async setArchiveStatus(id, isArchived) {
    return prisma.expenseReport.update({
      where: { id: parseInt(id) },
      data: { isArchived }
    });
  }
// ==========================================
  // PHASE 4: STATE MACHINE TRANSITIONS
  // ==========================================

  /**
   * Helper to execute a valid state transition transaction.
   * Encapsulates the core logic: Check State -> Update Status/Timestamps -> Create History.
   */
  async _transitionState(id, actorId, fromStatus, toStatus, timestampField, reason = null) {
    return prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findUnique({ where: { id: parseInt(id) } });
      if (!report) throw new Error('Report not found');
      
      // Strict state machine validation
      if (report.status !== fromStatus) {
        throw new Error(`Invalid transition: Cannot move from ${report.status} to ${toStatus}. Expected ${fromStatus}.`);
      }

      // Prepare update payload
      const data = { status: toStatus };
      if (timestampField === 'submittedAt') data.submittedAt = new Date();
      if (timestampField === 'approvedAt') data.approvedAt = new Date();
      if (timestampField === 'paidAt') data.paidAt = new Date();

      // 1. Update the report
      const updatedReport = await tx.expenseReport.update({
        where: { id: parseInt(id) },
        data
      });

      // 2. Write the immutable audit log
      await tx.reportHistory.create({
        data: {
          reportId: updatedReport.id,
          actorId,
          fromStatus,
          toStatus,
          reason
        }
      });

      return updatedReport;
    });
  }

  async submitReport(id, ownerId) {
    // Note: ownerId verification is assumed to happen in middleware, but passing it for history log
    return this._transitionState(id, ownerId, 'DRAFT', 'SUBMITTED', 'submittedAt');
  }

  async approveReport(id, approverId) {
    return this._transitionState(id, approverId, 'SUBMITTED', 'APPROVED', 'approvedAt');
  }

  async rejectReport(id, approverId, reason) {
    if (!reason || reason.trim().length === 0) throw new Error('Rejection reason is required');
    return this._transitionState(id, approverId, 'SUBMITTED', 'REJECTED', null, reason);
  }

  async payReport(id, approverId) {
    return this._transitionState(id, approverId, 'APPROVED', 'PAID', 'paidAt');
  }

  async resetToDraft(id, ownerId) {
    return this._transitionState(id, ownerId, 'REJECTED', 'DRAFT', null);
  }
// ==========================================
  // PHASE 5: APPROVER ASSIGNMENTS
  // ==========================================

  async assignApprover(reportId, targetApproverId) {
    if (!targetApproverId) throw new Error('Target approver ID is required');

    // 1. Verify target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: targetApproverId } });
    if (!targetUser) throw new Error('Target user does not exist');

    // 2. Verify target user has APPROVER role
    if (targetUser.role !== 'APPROVER') throw new Error('Target user is not eligible to be an approver');

    // 3. Create or preserve assignment (Idempotent success)
    await prisma.reportApprover.upsert({
      where: {
        reportId_approverId: {
          reportId: parseInt(reportId),
          approverId: targetApproverId
        }
      },
      update: {}, // Do nothing if it exists
      create: {
        reportId: parseInt(reportId),
        approverId: targetApproverId
      }
    });

    return { success: true };
  }

  async removeApprover(reportId, targetApproverId) {
    try {
      await prisma.reportApprover.delete({
        where: {
          reportId_approverId: {
            reportId: parseInt(reportId),
            approverId: targetApproverId
          }
        }
      });
    } catch (err) {
      // P2025: Record to delete does not exist (Idempotent success)
      if (err.code !== 'P2025') {
        throw err;
      }
    }
  }

}

module.exports = new ReportService();


