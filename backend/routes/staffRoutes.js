const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Import controller functions (ensure getStaffAbsences is imported)
const {
    createStaff,
    getStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
    addStaffAbsence,
    updateStaffAbsence,
    deleteStaffAbsence,
    getStaffAbsences, // <-- ENSURE THIS IS IMPORTED
    sendRouteToStaff
} = require('../controllers/staffController');

// Define the main staff routes
router.route('/')
    .post(protect, authorize('admin', 'manager'), createStaff)
    .get(protect, authorize('admin', 'manager'), getStaff);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getStaffById)
    .put(protect, authorize('admin', 'manager'), updateStaff)
    .delete(protect, authorize('admin'), deleteStaff);

// Routes for staff absences (for operations on a staff member's embedded absences)
// IMPORTANT: Added .get handler here to fetch staff absences
router.route('/:staffId/absences')
    .post(protect, authorize(['admin', 'manager', 'staff']), addStaffAbsence) // Staff can add for themselves, so authorize 'staff' here
    .get(protect, authorize(['admin', 'manager', 'staff']), getStaffAbsences); // <--- ADDED THIS LINE for GET /api/staff/:staffId/absences

// Routes for a specific absence period within a staff member's absences
router.route('/:staffId/absences/:absenceId')
    .put(protect, authorize(['admin', 'manager', 'staff']), updateStaffAbsence) // Staff can update their own, managers/admins can update any
    .delete(protect, authorize(['admin', 'manager', 'staff']), deleteStaffAbsence); // Staff can delete their own, managers/admins can delete any

// NEW ROUTE FOR SENDING ROUTES TO STAFF
router.post('/send-route', protect, authorize('admin', 'manager'), sendRouteToStaff);

module.exports = router;