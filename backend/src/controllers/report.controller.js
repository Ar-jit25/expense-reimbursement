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
      const includeArchived = req.query.archived === 'true';
      const reports = await reportService.getMyReports(req.user.id, includeArchived);
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
}

module.exports = new ReportController();
