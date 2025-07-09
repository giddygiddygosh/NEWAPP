const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware'); // Import your authentication middleware

// Import controller functions for daily time records
const {
    clockInDaily,
    clockOutDaily,
    getDailyTimeRecords,
    getCurrentDailyStatus,
} = require('../controllers/dailyTimeController');

// Route for staff to clock in for the day
router.post('/clock-in', protect, authorize(['staff', 'admin', 'manager']), clockInDaily);

// Route for staff to clock out for the day
router.post('/clock-out', protect, authorize(['staff', 'admin', 'manager']), clockOutDaily);

// Route to get the current clock-in status for a staff member (for today)
router.get('/status/:staffId', protect, authorize(['staff', 'admin', 'manager']), getCurrentDailyStatus);

// Route to get a staff member's daily time records (can include date range queries)
router.get('/:staffId', protect, authorize(['staff', 'admin', 'manager']), getDailyTimeRecords);

module.exports = router;