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
    assignRouteToJobs // This import will now work correctly
} = require('../controllers/jobController');

// Route for checking availability
router.post('/check-availability', protect, authorize(['admin', 'manager', 'staff']), checkAvailability);

// Route for assigning a calculated route to staff
router.post('/assign-route', protect, authorize(['admin', 'manager']), assignRouteToJobs); // Admin/Manager can dispatch routes

router.route('/')
    .post(protect, authorize(['admin', 'manager', 'staff']), createJob)
    .get(protect, authorize(['admin', 'manager', 'staff']), getJobs);

router.route('/:id')
    .get(protect, authorize(['admin', 'manager', 'staff']), getJobById)
    .put(protect, authorize(['admin', 'manager', 'staff']), updateJob)
    .delete(protect, authorize(['admin', 'manager']), deleteJob);

module.exports = router;