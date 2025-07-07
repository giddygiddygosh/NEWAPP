const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createJob,
    getJobs,
    getJobById,
    updateJob,
    deleteJob,
    checkAvailability
} = require('../controllers/jobController');

router.post('/check-availability', protect, authorize('admin', 'manager', 'staff'), checkAvailability);

router.route('/')
    .post(protect, authorize('admin', 'manager', 'staff'), createJob)
    .get(protect, authorize('admin', 'manager', 'staff'), getJobs);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getJobById)
    .put(protect, authorize('admin', 'manager', 'staff'), updateJob)
    .delete(protect, authorize('admin', 'manager'), deleteJob);

module.exports = router;