// backend/routes/jobRoutes.js

const express = require('express');
const router = express.Router();
const {
    getJobs,
    getJobById,
    createJob,
    updateJob,
    deleteJob,
    getInvoiceableJobs, // --- NEW --- Import the new function
    // New staff job actions
    clockInJob,
    clockOutJob,
    updateJobTask,
    uploadJobPhoto,
    returnJobStock,
} = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/authMiddleware');


// --- NEW --- Route to get jobs ready for invoicing
// This must be placed BEFORE the '/:id' route to avoid conflicts.
router.route('/invoiceable')
    .get(protect, authorize(['admin', 'manager']), getInvoiceableJobs);


// Protected routes for standard job operations
router.route('/')
    .get(protect, getJobs)
    .post(protect, authorize(['admin', 'manager']), createJob);

router.route('/:id')
    .get(protect, getJobById)
    .put(protect, authorize(['admin', 'manager', 'staff']), updateJob)
    .delete(protect, authorize(['admin']), deleteJob);

// Routes for staff-specific job actions
router.route('/:id/clock-in')
    .put(protect, authorize(['staff', 'admin', 'manager']), clockInJob);

router.route('/:id/clock-out')
    .put(protect, authorize(['staff', 'admin', 'manager']), clockOutJob);

router.route('/:id/tasks/:taskId')
    .put(protect, authorize(['staff', 'admin', 'manager']), updateJobTask);

router.route('/:id/photos')
    .post(protect, authorize(['staff', 'admin', 'manager']), uploadJobPhoto);

router.route('/:id/return-stock')
    .post(protect, authorize(['staff', 'admin', 'manager']), returnJobStock);

module.exports = router;