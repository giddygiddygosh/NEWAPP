// backend/routes/staffRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Import controller functions (ensure new absence and sendRoute functions are imported)
const {
    createStaff,
    getStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
    addStaffAbsence,
    updateStaffAbsence,
    deleteStaffAbsence,
    sendRouteToStaff // <-- ADDED: Import this new function
} = require('../controllers/staffController');

// Define the main staff routes
router.route('/')
    .post(protect, authorize('admin', 'manager'), createStaff)
    .get(protect, authorize('admin', 'manager'), getStaff);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getStaffById)
    .put(protect, authorize('admin', 'manager'), updateStaff)
    .delete(protect, authorize('admin'), deleteStaff);

// Routes for staff absences
router.route('/:staffId/absences')
    .post(protect, authorize('admin', 'manager'), addStaffAbsence);

router.route('/:staffId/absences/:absenceId')
    .put(protect, authorize('admin', 'manager'), updateStaffAbsence)
    .delete(protect, authorize('admin', 'manager'), deleteStaffAbsence);

// NEW ROUTE FOR SENDING ROUTES TO STAFF (Add this)
router.post('/send-route', protect, authorize('admin', 'manager'), sendRouteToStaff); // <-- ADDED: Route for POST /api/staff/send-route

module.exports = router;