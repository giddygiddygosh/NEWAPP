const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const asyncHandler = require('express-async-handler');
const pdf = require('html-pdf');
const { format, startOfDay, endOfDay } = require('date-fns');

// Import all controller functions for payroll, including the new one
const {
    calculatePayroll,
    getPayslipById,
    downloadPayslip,
    downloadPayslipsBulk,
    generateAccountantReportData,
    renderAccountantReportHtml,
    getStaffPayslips, // <--- IMPORTED THE NEW FUNCTION
} = require('../controllers/payrollController');

// Route to calculate payroll for a given period
router.post('/calculate', protect, authorize(['admin', 'manager']), calculatePayroll);

// --- START: ORDER MATTERS FOR SPECIFICITY ---

// MOST SPECIFIC: Route to download multiple payslips as a ZIP archive
router.get('/payslips/bulk-download', protect, authorize(['admin', 'manager']), downloadPayslipsBulk);

// MORE SPECIFIC: Route to download a single payslip as PDF
router.get('/payslips/download/:id', protect, authorize(['admin', 'manager', 'staff']), downloadPayslip);

// NEW SPECIFIC ROUTE: Route to get all payslips for a specific staff member
// This route is placed before '/payslips/:id' to ensure it's matched correctly.
router.get('/payslips/staff/:staffId', protect, authorize(['admin', 'manager', 'staff']), getStaffPayslips); // <--- ADDED THIS ROUTE

// NEW: Route to get the aggregated payroll report data and render it as PDF
router.get('/report/summary', protect, authorize(['admin', 'manager']), asyncHandler(async (req, res) => {
    const { startDate, endDate, staffIds } = req.query; // Extract params from query

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Start date and end date are required for the accountant report.');
    }

    // Apply date normalization consistently here:
    const periodStart = startOfDay(new Date(startDate));
    periodStart.setUTCHours(0, 0, 0, 0); // Ensure UTC midnight
    const periodEnd = endOfDay(new Date(endDate));
    periodEnd.setUTCHours(23, 59, 59, 999); // Ensure UTC end of day

    const companyId = req.user.company;

    // Pass the already parsed and normalized staffIds
    const parsedStaffIds = staffIds ? staffIds.split(',') : [];

    // Call the helper function with the correctly processed parameters
    const reportData = await generateAccountantReportData(periodStart, periodEnd, companyId, parsedStaffIds);

    // Render the HTML report
    const htmlContent = renderAccountantReportHtml(reportData);

    // Generate PDF and send
    const options = { format: 'A4', orientation: 'portrait', border: '10mm' };
    pdf.create(htmlContent, options).toBuffer((err, buffer) => {
        if (err) {
            console.error('Error generating Accountant Report PDF from /report/summary:', err);
            // Respond with 500 error if PDF generation fails
            return res.status(500).json({ message: 'Failed to generate Accountant Report PDF.' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        // Corrected filename (typo: reportData.periodData.periodEnd -> reportData.periodEnd)
        res.setHeader('Content-Disposition', `attachment; filename=Payroll_Summary_Report_${format(reportData.periodStart, 'yyyyMMdd')}_to_${format(reportData.periodEnd, 'yyyyMMdd')}.pdf`);
        res.send(buffer);
    });
}));


// Route to get a single payslip by ID (MORE GENERAL ROUTE GOES AFTER SPECIFIC ONES)
router.get('/payslips/:id', protect, authorize(['admin', 'manager', 'staff']), getPayslipById);


// --- END: ORDER MATTERS FOR SPECIFICITY ---

// Add more routes for payroll management here as needed (e.g., historical payroll, payslip access)

module.exports = router;