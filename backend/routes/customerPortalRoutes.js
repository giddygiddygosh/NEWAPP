// backend/routes/customerPortalRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Assuming 'protect' middleware is used for customer portal
const { getRecentCustomerInvoices, getUpcomingCustomerJobs } = require('../controllers/customerPortalController'); // We'll create this controller

// All customer portal routes should be protected to ensure only authenticated customers can access their data
// Assuming your 'protect' middleware adds req.user.customer based on the logged-in customer's ID
router.use(protect); // Apply protection to all routes in this router

// @route   GET /api/customer-portal/invoices/recent
// @desc    Get recent invoices for the logged-in customer
// @access  Private (Customer)
router.get('/invoices/recent', getRecentCustomerInvoices);

// @route   GET /api/customer-portal/jobs/upcoming
// @desc    Get upcoming jobs/appointments for the logged-in customer
// @access  Private (Customer)
router.get('/jobs/upcoming', getUpcomingCustomerJobs);

// Add other customer portal routes here as needed (e.g., /invoices, /jobs, /quotes)

module.exports = router;