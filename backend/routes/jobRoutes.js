// backend/routes/jobRoutes.js

const express = require('express');
const router = express.Router();
const {
    getJobs,
    getJobById,
    createJob,
    updateJob, // This is the controller for PUT /api/jobs/:id
    deleteJob,
    // New staff job actions
    clockInJob,
    clockOutJob,
    updateJobTask,
    uploadJobPhoto,
    returnJobStock,
} = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Protected routes
router.route('/')
    .get(protect, getJobs)
    .post(protect, authorize(['admin', 'manager']), createJob);

router.route('/:id')
    .get(protect, getJobById)
    // FIX: Add 'staff' to the authorize roles for PUT /api/jobs/:id
    .put(protect, authorize(['admin', 'manager', 'staff']), updateJob) // <--- ADDED 'staff' HERE
    .delete(protect, authorize(['admin']), deleteJob);

// --- NEW STAFF JOB ACTION ROUTES (already correctly authorized) ---
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

