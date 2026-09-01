const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const lineController = require('../controllers/line.controller');
const { requireAuth } = require('../middleware/auth');
const { requireReportOwner, requireDraftReport, requireNotReportOwner } = require('../middleware/reportOwnership');
const { requireRole } = require('../middleware/roles');

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



// --- Phase 4: State Machine Endpoints ---
router.post('/:id/submit', requireReportOwner, reportController.submit);
router.post('/:id/approve', requireRole('APPROVER'), requireNotReportOwner, reportController.approve);
router.post('/:id/reject', requireRole('APPROVER'), requireNotReportOwner, reportController.reject);
router.post('/:id/pay', requireRole('APPROVER'), requireNotReportOwner, reportController.pay);
router.post('/:id/reset', requireReportOwner, reportController.reset);

module.exports = router;
