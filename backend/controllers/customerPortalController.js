// backend/controllers/customerPortalController.js

const asyncHandler = require('express-async-handler');
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');
const { startOfDay, endOfDay } = require('date-fns'); // For date comparisons

/**
 * @desc    Get recent invoices for the logged-in customer
 * @route   GET /api/customer-portal/invoices/recent
 * @access  Private (Customer)
 */
exports.getRecentCustomerInvoices = asyncHandler(async (req, res) => {
    // Ensure the customer ID is available from the authentication middleware
    const customerId = req.user.customer; // Assuming req.user.customer holds the customer's ObjectId

    if (!customerId) {
        res.status(401);
        throw new Error('Customer ID not found in authentication token.');
    }

    // Fetch recent invoices for this customer
    const invoices = await Invoice.find({ customer: customerId })
        .sort({ issueDate: -1 }) // Sort by most recent first
        .limit(5) // Limit to 5 recent invoices for the dashboard overview
        .populate('job', 'serviceType date time status') // Populate job details if you want them on the dashboard
        .select('invoiceNumber status issueDate dueDate total'); // Select relevant fields

    res.status(200).json(invoices);
});

/**
 * @desc    Get upcoming jobs/appointments for the logged-in customer
 * @route   GET /api/customer-portal/jobs/upcoming
 * @access  Private (Customer)
 */
exports.getUpcomingCustomerJobs = asyncHandler(async (req, res) => {
    const customerId = req.user.customer; // Assuming req.user.customer holds the customer's ObjectId

    if (!customerId) {
        res.status(401);
        throw new Error('Customer ID not found in authentication token.');
    }

    // Get today's date for comparison
    const now = new Date();
    const startOfToday = startOfDay(now);

    // Fetch upcoming jobs for this customer
    const jobs = await Job.find({
        customer: customerId,
        date: { $gte: startOfToday }, // Jobs from today onwards
        status: { $nin: ['Cancelled', 'Completed', 'Invoiced'] } // Exclude cancelled, completed, and invoiced jobs
    })
    .sort({ date: 1, time: 1 }) // Sort by nearest date and time
    .limit(5) // Limit to 5 upcoming jobs for the dashboard overview
    .select('serviceType date time status address'); // Select relevant fields

    res.status(200).json(jobs);
});