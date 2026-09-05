const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Supports minute-based thresholds for testing (preferred if set),
// falling back to day-based for production.
function getStaleThresholdMs() {
  if (process.env.STALE_THRESHOLD_DAYS) {
    return parseInt(process.env.STALE_THRESHOLD_DAYS, 10) * 24 * 60 * 60 * 1000;
  }
  if (process.env.STALE_THRESHOLD_MINUTES) {
    return parseInt(process.env.STALE_THRESHOLD_MINUTES, 10) * 60 * 1000;
  }
  return 5 * 24 * 60 * 60 * 1000; // default 5 days
}

function getRedisplayThresholdMs() {
  if (process.env.REDISPLAY_THRESHOLD_HOURS) {
    return parseInt(process.env.REDISPLAY_THRESHOLD_HOURS, 10) * 60 * 60 * 1000;
  }
  if (process.env.REDISPLAY_THRESHOLD_DAYS) {
    return parseInt(process.env.REDISPLAY_THRESHOLD_DAYS, 10) * 24 * 60 * 60 * 1000;
  }
  if (process.env.REDISPLAY_THRESHOLD_MINUTES) {
    return parseInt(process.env.REDISPLAY_THRESHOLD_MINUTES, 10) * 60 * 1000;
  }
  return 5 * 60 * 60 * 1000; // default 5 hours
}

class AlertService {
  /**
   * Get all active stale alerts for a given approver.
   * A report is stale if:
   * 1. It is SUBMITTED.
   * 2. submittedAt < now - STALE_THRESHOLD.
   * 3. The approver is assigned to the report.
   * 4. The approver has not dismissed the alert within REDISPLAY_THRESHOLD.
   */
  async getAlerts(approverId) {
    const staleDate = new Date(Date.now() - getStaleThresholdMs());
    const redisplayDate = new Date(Date.now() - getRedisplayThresholdMs());

    const alerts = await prisma.expenseReport.findMany({
      where: {
        status: 'SUBMITTED',
        isArchived: false,
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
