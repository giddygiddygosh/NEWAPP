const express = require('express');
const router = express.Router();
const { protect, adminManager } = require('../middleware/authMiddleware');

// Import the entire controller as a single object.
const invoiceController = require('../controllers/invoiceController');

// GET all invoices
router.route('/')
  .get(protect, invoiceController.getInvoices);

// POST a new invoice from stock
router.route('/stock')
  .post(protect, adminManager, invoiceController.createStockInvoice);

// Routes for a specific invoice by ID
router.route('/:id')
  .get(protect, invoiceController.getInvoiceById);

// Route to update the status of a specific invoice
router.route('/:id/status')
  .put(protect, adminManager, invoiceController.updateInvoiceStatus);

module.exports = router;
