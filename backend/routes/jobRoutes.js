// backend/routes/jobRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

const {
    createJob,
    getJobs,      // <-- Re-enabled/Imported
    getJobById,
    updateJob,    // <-- Re-enabled/Imported
    deleteJob,
    checkAvailability, // Keep if defined elsewhere, otherwise remove
    assignRouteToJobs
} = require('../controllers/jobController');

// Define the routes for jobs
router.route('/')
    .post(protect, authorize('admin', 'manager', 'staff'), createJob)
    .get(protect, authorize('admin', 'manager', 'staff'), getJobs); // <-- ADDED: Route for GET /api/jobs

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getJobById)
    .put(protect, authorize('admin', 'manager', 'staff'), updateJob) // <-- ADDED: Route for PUT /api/jobs/:id
    .delete(protect, authorize('admin', 'manager'), deleteJob);

// Route for assigning a route to jobs (already existed)
router.post('/assign-route', protect, authorize(['admin', 'manager']), assignRouteToJobs);

module.exports = router;