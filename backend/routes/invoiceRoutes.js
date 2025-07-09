// backend/routes/invoiceRoutes.js

const express = require('express');
const router = express.Router();

const {
    createInvoiceFromJob,
    getInvoices,
    getInvoiceById,
    updateInvoiceStatus, // NEW: Import the updateInvoiceStatus function
} = require('../controllers/invoiceController');

// --- CORRECTED FILE PATH ---
const { protect, authorize } = require('../middleware/authMiddleware');

// Route for /api/invoices (for listing all and creating new)
router.route('/')
    .post(protect, authorize('admin', 'manager'), createInvoiceFromJob)
    .get(protect, authorize('admin', 'manager'), getInvoices);

// Route for /api/invoices/:id (for getting a single invoice)
router.route('/:id')
    .get(protect, authorize('admin', 'manager'), getInvoiceById);

// NEW: Route for updating the status of a specific invoice
router.route('/:id/status') // Specific endpoint for status updates
    .put(protect, authorize('admin', 'manager'), updateInvoiceStatus); // Use the new controller function

module.exports = router;