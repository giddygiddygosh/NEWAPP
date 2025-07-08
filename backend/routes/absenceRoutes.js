const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Import all the functions from your absenceController
const {
    createAbsence,
    getAbsences,
    getAbsenceById,
    updateAbsence,
    deleteAbsence,
    getStaffAbsences
} = require('../controllers/absenceController');

// Route for getting all absences (for admins/managers) and creating a new one
router.route('/')
    .get(protect, authorize('admin', 'manager'))
    .post(protect, authorize('admin', 'manager', 'staff'));

// Route for getting all absences for a specific staff member
router.route('/staff/:staffId')
    .get(protect, authorize('admin', 'manager', 'staff'));

// Routes for a specific absence period by its ID
router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'))
    .put(protect, authorize('admin', 'manager', 'staff'))
    .delete(protect, authorize('admin', 'manager', 'staff'));

module.exports = router;
