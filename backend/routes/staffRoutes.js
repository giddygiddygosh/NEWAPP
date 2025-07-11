const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Import controller functions
const {
    createStaff,
    getStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
    addStaffAbsence,
    updateStaffAbsence,
    deleteStaffAbsence,
    getStaffAbsences,
    sendRouteToStaff,
    getStaffStats // <--- ENSURE THIS IS IMPORTED
} = require('../controllers/staffController');

// Define the main staff routes
router.route('/')
    .post(protect, authorize('admin', 'manager'), createStaff)
    .get(protect, authorize('admin', 'manager'), getStaff);

// NEW ROUTE: Staff Stats - Must be before /:id to avoid conflict
router.get('/:id/stats', protect, authorize(['admin', 'manager', 'staff']), getStaffStats);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getStaffById)
    .put(protect, authorize('admin', 'manager'), updateStaff)
    .delete(protect, authorize('admin'), deleteStaff);

// Routes for staff absences (for operations on a staff member's embedded absences)
router.route('/:staffId/absences')
    .post(protect, authorize(['admin', 'manager', 'staff']), addStaffAbsence)
    .get(protect, authorize(['admin', 'manager', 'staff']), getStaffAbsences);

// Routes for a specific absence period within a staff member's absences
router.route('/:staffId/absences/:absenceId')
    .put(protect, authorize(['admin', 'manager', 'staff']), updateStaffAbsence)
    .delete(protect, authorize(['admin', 'manager', 'staff']), deleteStaffAbsence);

// NEW ROUTE FOR SENDING ROUTES TO STAFF
router.post('/send-route', protect, authorize('admin', 'manager'), sendRouteToStaff);

module.exports = router;