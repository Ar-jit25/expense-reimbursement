const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const lineController = require('../controllers/line.controller');
const { requireAuth } = require('../middleware/auth');
const { requireReportOwner, requireDraftReport } = require('../middleware/reportOwnership');

// All endpoints require authentication
router.use(requireAuth);

// --- Report Endpoints ---
router.post('/', reportController.create);
router.get('/', reportController.list);
// Protected by ownership
router.get('/:id', requireReportOwner, reportController.get);
// Protected by ownership AND lifecycle state (DRAFT only)
router.put('/:id', requireReportOwner, requireDraftReport, reportController.update);

// Archive toggles don't strictly require DRAFT state, but they do require ownership
router.put('/:id/archive', requireReportOwner, reportController.setArchive);
router.put('/:id/restore', requireReportOwner, reportController.setArchive);

// --- Expense Line Endpoints ---
// Protected by ownership AND lifecycle state (DRAFT only)
router.post('/:id/lines', requireReportOwner, requireDraftReport, lineController.add);
router.put('/:id/lines/:lineId', requireReportOwner, requireDraftReport, lineController.update);
router.delete('/:id/lines/:lineId', requireReportOwner, requireDraftReport, lineController.remove);

module.exports = router;
