// backend/routes/commissionReportRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware'); // Adjust path as needed
const { getCommissionReport } = require('../controllers/commissionReportController'); // Adjust path as needed

// GET /api/reports/commission - Get commission report data
router.route('/commission')
    .get(protect, authorize(['admin', 'manager']), getCommissionReport);

module.exports = router;