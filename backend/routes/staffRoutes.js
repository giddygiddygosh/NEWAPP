const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createStaff,
    getStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
} = require('../controllers/staffController');

router.route('/')
    .post(protect, authorize('admin'), createStaff)
    .get(protect, authorize('admin', 'manager'), getStaff);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getStaffById)
    .put(protect, authorize('admin', 'manager', 'staff'), updateStaff)
    .delete(protect, authorize('admin'), deleteStaff);

module.exports = router;