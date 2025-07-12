const express = require('express');
const router = express.Router();
const { protect, adminManager } = require('../middleware/authMiddleware'); // Assuming adminManager is your combined middleware

// Import the entire controller as a single object.
const invoiceController = require('../controllers/invoiceController');

// GET all invoices
router.route('/')
    .get(protect, invoiceController.getInvoices);

// POST a new invoice from stock items
router.route('/stock')
    .post(protect, adminManager, invoiceController.createStockInvoice);

// --- NEW ROUTE FOR CREATING INVOICE FROM A JOB ---
/**
 * @route POST /api/invoices/job
 * @desc Creates a new invoice based on a completed job's details.
 * @access Private (Admin, Manager)
 */
router.post('/job', protect, adminManager, invoiceController.createJobInvoice); // <--- ADDED THIS LINE

// Routes for a specific invoice by ID
router.route('/:id')
    .get(protect, invoiceController.getInvoiceById);

// Route to update the status of a specific invoice (non-payment related status changes)
router.route('/:id/status')
    .put(protect, adminManager, invoiceController.updateInvoiceStatus);

// Route for recording payments against an invoice
router.post('/:id/payments', protect, adminManager, invoiceController.recordPayment);

module.exports = router;