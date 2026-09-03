const prisma = require('../config/prisma');

/**
 * Validates that the report exists and belongs to the authenticated user.
 */
const requireReportOwner = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

    const report = await prisma.expenseReport.findUnique({
      where: { id: reportId },
      select: { ownerId: true, status: true }
    });

    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden: You do not own this report' });

    // Stash the status so next middlewares don't have to fetch it again
    req.reportStatus = report.status;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error checking report ownership' });
  }
};

/**
 * Validates that the report is in DRAFT status. Must be used AFTER requireReportOwner.
 */
const requireDraftReport = (req, res, next) => {
  if (req.reportStatus !== 'DRAFT') {
    return res.status(400).json({ 
      error: 'Invalid state transition',
      details: 'Modifications are only allowed when report is in DRAFT status.'
    });
  }
  next();
};



/**
 * Validates that the report exists and DOES NOT belong to the authenticated user.
 * Used for approver endpoints so approvers cannot approve their own reports.
 */
const requireNotReportOwner = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

    const report = await prisma.expenseReport.findUnique({
      where: { id: reportId },
      select: { ownerId: true, status: true }
    });

    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.ownerId === req.user.id) return res.status(403).json({ error: 'Forbidden: You cannot perform this action on your own report' });

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error checking report ownership' });
  }
};



/**
 * Validates that the report is in SUBMITTED status.
 * Used for Assignment Management.
 */
const requireReportSubmitted = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

    // If reportStatus is already stashed by a previous middleware (like requireNotReportOwner), use it.
    let status = req.reportStatus;
    if (!status) {
      const report = await prisma.expenseReport.findUnique({ where: { id: reportId }, select: { status: true } });
      if (!report) return res.status(404).json({ error: 'Report not found' });
      status = report.status;
    }

    if (status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Invalid state: Report must be in SUBMITTED state to perform this action' });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error checking report status' });
  }
};

/**
 * Validates that the authenticated user has an explicit assignment to this report in the ReportApprover table.
 * Used to protect /approve and /reject endpoints in Phase 5.
 */
const requireAssignedApprover = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

    const assignment = await prisma.reportApprover.findUnique({
      where: {
        reportId_approverId: {
          reportId: reportId,
          approverId: req.user.id
        }
      }
    });

    if (!assignment) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to review this report' });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error checking report assignment' });
  }
};

module.exports = { requireReportOwner, requireNotReportOwner, requireDraftReport, requireReportSubmitted, requireAssignedApprover };
