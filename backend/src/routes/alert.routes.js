const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);
// Alerts are strictly for Approvers
router.use(requireRole('APPROVER'));

router.get('/', alertController.getAlerts);
router.post('/:reportId/dismiss', alertController.dismissAlert);

module.exports = router;

