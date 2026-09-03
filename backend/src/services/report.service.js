const prisma = require('../config/prisma');

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

