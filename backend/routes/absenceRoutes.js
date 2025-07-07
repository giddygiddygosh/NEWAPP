// File: backend/routes/staffRoutes.js (FINAL CORRECTED ORDER)

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

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
} = require('../controllers/staffController');


// General routes for the whole staff list
router.route('/')
    .get(protect, authorize(['admin', 'manager', 'staff']), getStaff)
    .post(protect, authorize(['admin']), createStaff);

// --- ABSENCE ROUTES MUST COME BEFORE THE GENERIC '/:id' ROUTE ---

// GET all absences for a staff member
router.get('/:staffId/absences', protect, authorize(['admin', 'manager', 'staff']), getStaffAbsences);
// POST a new absence for a staff member
router.post('/:staffId/absences', protect, authorize(['admin', 'manager', 'staff']), addStaffAbsence);
// PUT (update) a specific absence for a staff member
router.put('/:staffId/absences/:absenceId', protect, authorize(['admin', 'manager', 'staff']), updateStaffAbsence);
// DELETE a specific absence for a staff member
router.delete('/:staffId/absences/:absenceId', protect, authorize(['admin', 'manager', 'staff']), deleteStaffAbsence);


// --- Generic route for a single staff member BY THEIR ID comes last ---
router.route('/:id')
    .get(protect, authorize(['admin', 'manager', 'staff']), getStaffById)
    .put(protect, authorize(['admin', 'manager', 'staff']), updateStaff)
    .delete(protect, authorize(['admin']), deleteStaff);

module.exports = router;