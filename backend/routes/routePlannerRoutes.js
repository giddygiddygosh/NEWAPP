const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { sendRouteToStaff } = require('../controllers/routePlannerController');

// POST /api/routes/send-to-staff
router.post('/send-to-staff', protect, authorize('admin', 'manager'), sendRouteToStaff);

module.exports = router;