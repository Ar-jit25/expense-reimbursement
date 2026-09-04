const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STALE_THRESHOLD_DAYS = parseInt(process.env.STALE_THRESHOLD_DAYS || '5', 10);
const REDISPLAY_THRESHOLD_DAYS = parseInt(process.env.REDISPLAY_THRESHOLD_DAYS || '3', 10);

class AlertService {
  /**
   * Get all active stale alerts for a given approver.
   * A report is stale if:
   * 1. It is SUBMITTED.
   * 2. submittedAt < now - STALE_THRESHOLD_DAYS.
   * 3. The approver is assigned to the report.
   * 4. The approver has not dismissed the alert within the REDISPLAY_THRESHOLD_DAYS.
   */
  async getAlerts(approverId) {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - STALE_THRESHOLD_DAYS);

    const redisplayDate = new Date();
    redisplayDate.setDate(redisplayDate.getDate() - REDISPLAY_THRESHOLD_DAYS);

    const alerts = await prisma.expenseReport.findMany({
      where: {
        status: 'SUBMITTED',
        submittedAt: { lt: staleDate },
        approvers: { some: { approverId } },
        alerts: {
          none: {
            approverId,
            dismissedAt: { gte: redisplayDate }
          }
        }
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        lines: true
      },
      orderBy: { submittedAt: 'asc' }
    });

    // Compute total dynamically for each report
    const processedAlerts = alerts.map(report => {
      const total = report.lines.reduce((sum, line) => sum + Number(line.amount), 0);
      return {
        id: report.id,
        title: report.title,
        submittedAt: report.submittedAt,
        owner: report.owner,
        total
      };
    });

    return {
      count: processedAlerts.length,
      alerts: processedAlerts
    };
  }

  /**
   * Dismiss an alert for a specific report and approver.
   */
  async dismissAlert(reportId, approverId) {
    // Upsert the alert record to set dismissedAt = now()
    const alert = await prisma.staleAlert.upsert({
      where: {
        reportId_approverId: {
          reportId: Number(reportId),
          approverId
        }
      },
      update: {
        dismissedAt: new Date()
      },
      create: {
        reportId: Number(reportId),
        approverId,
        dismissedAt: new Date()
      }
    });
    return alert;
  }
}

module.exports = new AlertService();
