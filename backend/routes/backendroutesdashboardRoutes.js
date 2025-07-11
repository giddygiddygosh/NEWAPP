// backend/routes/dashboardRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware'); // Assuming you have this middleware

const {
    getSummaryStats,
    getJobsOverview,
    getJobsByStatus,
    getStaffAvailability,
    getRecentActivity,
} = require('../controllers/dashboardController');

// All dashboard routes should be protected and only accessible by admin/manager
router.get('/summary-stats', protect, authorize(['admin', 'manager']), getSummaryStats);
router.get('/jobs-overview', protect, authorize(['admin', 'manager']), getJobsOverview);
router.get('/jobs-by-status', protect, authorize(['admin', 'manager']), getJobsByStatus);
router.get('/staff-availability', protect, authorize(['admin', 'manager']), getStaffAvailability);
router.get('/recent-activity', protect, authorize(['admin', 'manager']), getRecentActivity);

module.exports = router;