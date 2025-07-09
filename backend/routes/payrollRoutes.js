const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Import controller functions for payroll
const {
    calculatePayroll,
    getPayslipById, // <--- ADD THIS IMPORT
} = require('../controllers/payrollController');

// Route to calculate payroll for a given period
router.post('/calculate', protect, authorize(['admin', 'manager']), calculatePayroll);

// NEW: Route to get a single payslip by ID
router.get('/payslips/:id', protect, authorize(['admin', 'manager', 'staff']), getPayslipById); // <--- ADD THIS ROUTE

module.exports = router;