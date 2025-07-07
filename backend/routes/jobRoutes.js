// backend/routes/jobRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

const {
    createJob,
    getJobs,
    getJobById,
    updateJob,
    deleteJob,
    checkAvailability,
    assignRouteToJobs // Keep this one for now as it was the focus
} = require('../controllers/jobController');

// ONLY this route ENABLED
router.post('/assign-route', protect, authorize(['admin', 'manager']), assignRouteToJobs);

module.exports = router;