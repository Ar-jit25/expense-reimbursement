const reportService = require('../services/report.service');
const prisma = require('../config/prisma');

class ReportController {
  async create(req, res) {
    try {
      const { title, dateFrom, dateTo } = req.body;
      if (!title || !dateFrom || !dateTo) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const report = await reportService.createReport(req.user.id, { title, dateFrom, dateTo });
      res.status(201).json(report);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create report' });
    }
  }

  async list(req, res) {
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
  }

  async get(req, res) {
    try {
      // Ownership is already checked by middleware
      const report = await reportService.getReportById(req.params.id);
      res.json(report);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  }

  async update(req, res) {
    try {
      // Middleware already checks ownership & DRAFT status
      const updated = await reportService.updateReport(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update report' });
    }
  }

  async setArchive(req, res) {
    try {
      // Archive toggle uses URL path to determine action (/archive vs /restore)
      const isArchived = req.path.endsWith('/archive');
      const updated = await reportService.setArchiveStatus(req.params.id, isArchived);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update archive status' });
    }
  }
// ==========================================
  // PHASE 4: STATE MACHINE TRANSITIONS
  // ==========================================

  async submit(req, res) {
    try {
      const report = await reportService.submitReport(req.params.id, req.user.id);
      res.json(report);
    } catch (err) {
      console.error(err);
      if (err.message.includes('Invalid transition')) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: 'Failed to submit report' });
    }
  }

  async approve(req, res) {
    try {
      const report = await reportService.approveReport(req.params.id, req.user.id);
      res.json(report);
    } catch (err) {
      console.error(err);
      if (err.message.includes('Invalid transition')) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: 'Failed to approve report' });
    }
  }

  async reject(req, res) {
    try {
      const report = await reportService.rejectReport(req.params.id, req.user.id, req.body?.reason);
      res.json(report);
    } catch (err) {
      console.error(err);
      if (err.message.includes('reason is required')) return res.status(400).json({ error: err.message });
      if (err.message.includes('Invalid transition')) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: 'Failed to reject report' });
    }
  }

  async pay(req, res) {
    try {
      const report = await reportService.payReport(req.params.id, req.user.id);
      res.json(report);
    } catch (err) {
      console.error(err);
      if (err.message.includes('Invalid transition')) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: 'Failed to mark report as paid' });
    }
  }

  async reset(req, res) {
    try {
      const report = await reportService.resetToDraft(req.params.id, req.user.id);
      res.json(report);
    } catch (err) {
      console.error(err);
      if (err.message.includes('Invalid transition')) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: 'Failed to reset report to draft' });
    }
  }
// ==========================================
  // PHASE 5: APPROVER ASSIGNMENTS
  // ==========================================

  async assignApprover(req, res) {
    try {
      await reportService.assignApprover(req.params.id, req.body.approverId);
      res.json({ message: 'Assignment successful' });
    } catch (err) {
      console.error(err);
      if (err.message.includes('Target approver ID is required')) return res.status(400).json({ error: err.message });
      if (err.message.includes('does not exist')) return res.status(404).json({ error: err.message });
      if (err.message.includes('not eligible')) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: 'Failed to assign approver' });
    }
  }

  async removeAssignment(req, res) {
    try {
      await reportService.removeApprover(req.params.id, req.params.approverId);
      res.status(204).send(); // Idempotent success, no content
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to remove assignment' });
    }
  }

}

module.exports = new ReportController();

