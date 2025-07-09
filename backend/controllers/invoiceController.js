// backend/controllers/invoiceController.js

const asyncHandler = require('express-async-handler');
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');
const Company = require('../models/Company');
const Customer = require('../models/Customer');
const CompanySetting = require('../models/CompanySetting');
const mongoose = require('mongoose');

/**
 * @desc    Create a new invoice from a completed job
 * @route   POST /api/invoices
 * @access  Private (Admin, Manager)
 */
const createInvoiceFromJob = asyncHandler(async (req, res) => {
    const { jobId } = req.body;
    const companyId = req.user.company._id;

    if (!jobId) {
        res.status(400);
        throw new Error('Job ID is required to create an invoice.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const job = await Job.findById(jobId).populate('customer').populate('staff').session(session);

        if (!job) {
            res.status(404);
            throw new Error('Job not found.');
        }

        if (job.company.toString() !== companyId.toString()) {
            res.status(403);
            throw new Error('Not authorized to invoice this job.');
        }

        if (job.status !== 'Completed') {
            res.status(400);
            throw new Error(`Job status must be 'Completed' to create an invoice. Current status: ${job.status}`);
        }

        const existingInvoice = await Invoice.findOne({ job: jobId, company: companyId }).session(session);
        if (existingInvoice) {
            res.status(400);
            throw new Error('An invoice for this job already exists.');
        }

        const companySettings = await CompanySetting.findOne({ company: companyId }).session(session);

        if (!companySettings) {
            res.status(500);
            throw new Error('Company settings not found. Cannot generate invoice number or tax details.');
        }

        const { invoicePrefix, nextInvoiceSeqNumber, defaultTaxRate } = companySettings.invoiceSettings;

        const formattedInvoiceNumber = `${invoicePrefix}${String(nextInvoiceSeqNumber).padStart(4, '0')}`;
        
        companySettings.invoiceSettings.nextInvoiceSeqNumber += 1;
        await companySettings.save({ session });

        const calculatedLineItems = [
            {
                description: job.serviceType,
                quantity: 1,
                unitPrice: job.price,
                totalPrice: job.price,
            }
        ];

        const subtotalAmount = calculatedLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
        
        const calculatedTaxAmount = subtotalAmount * defaultTaxRate;
        
        const totalAmount = subtotalAmount + calculatedTaxAmount;

        const invoiceData = {
            company: companyId,
            job: job._id,
            customer: job.customer._id,
            invoiceNumber: formattedInvoiceNumber,
            status: 'draft',
            issueDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            lineItems: calculatedLineItems,
            subtotal: subtotalAmount,
            taxAmount: calculatedTaxAmount,
            total: totalAmount,
            amountPaid: 0,
            notes: '',
            currency: companySettings.defaultCurrency || { code: 'GBP', symbol: '£' },
        };

        const invoice = await Invoice.create([invoiceData], { session });

        job.status = 'Invoiced';
        await job.save({ session });

        await session.commitTransaction();

        const populatedInvoice = await Invoice.findById(invoice[0]._id).populate('customer', 'contactPersonName');

        res.status(201).json({
            message: 'Invoice created successfully.',
            invoice: populatedInvoice,
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error creating invoice from job:", error);
        if (res.headersSent) {
            console.warn('[DEBUG WARNING] Headers already sent, cannot send error response for createInvoiceFromJob.');
            return;
        }
        res.status(500).json({ message: error.message || 'Failed to create invoice from job.' });
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Get all invoices for a company
 * @route   GET /api/invoices
 * @access  Private (Admin, Manager)
 */
const getInvoices = asyncHandler(async (req, res) => {
    console.log('[DEBUG] getInvoices: Start function execution.');
    console.log('[DEBUG] req.user object in getInvoices:', req.user);

    if (!req.user || !req.user.company || !req.user.company._id) {
        res.status(400);
        throw new Error('User is not associated with a company.');
    }

    const companyId = req.user.company._id;
    console.log('[DEBUG] getInvoices: Company ID for query:', companyId);

    try {
        console.log('[DEBUG] getInvoices: Attempting to query invoices with populate...');
        const invoices = await Invoice.find({ company: companyId }).populate('customer', 'contactPersonName');
        console.log(`[DEBUG] getInvoices: Query completed. Found ${invoices.length} invoices.`);
        
        res.status(200).json(invoices);
        console.log('[DEBUG] getInvoices: Response sent.');

    } catch (error) {
        console.error('[DEBUG ERROR] getInvoices: Error fetching invoices:', error);
        if (res.headersSent) {
            console.warn('[DEBUG WARNING] Headers already sent, cannot send error response for getInvoices.');
            return;
        }
        res.status(500).json({ message: 'Server error while fetching invoices.', error: error.message });
    }
});

/**
 * @desc    Get a single invoice by ID
 * @route   GET /api/invoices/:id
 * @access  Private (Admin, Manager)
 */
const getInvoiceById = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
                                .populate('customer')
                                .populate('job');

    if (invoice && invoice.company.toString() === req.user.company._id.toString()) {
        res.status(200).json(invoice);
    } else {
        res.status(404);
        throw new Error('Invoice not found or not authorized.');
    }
});

// NEW: updateInvoiceStatus function
/**
 * @desc    Update the status of an invoice
 * @route   PUT /api/invoices/:id/status
 * @access  Private (Admin, Manager)
 */
const updateInvoiceStatus = asyncHandler(async (req, res) => {
    const { id } = req.params; // Invoice ID
    const { status: newStatus, amountPaid } = req.body; // New status and optional amountPaid
    const companyId = req.user.company._id;

    // Find the invoice and ensure it belongs to the user's company
    const invoice = await Invoice.findById(id);

    if (!invoice || invoice.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Invoice not found or not authorized.');
    }

    // Validate the new status against the Invoice schema's enum
    const validStatuses = ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'void'];
    if (!validStatuses.includes(newStatus)) {
        res.status(400);
        throw new Error(`Invalid status: '${newStatus}'. Allowed statuses are: ${validStatuses.join(', ')}.`);
    }

    // Update status
    invoice.status = newStatus;

    // Handle amountPaid for 'paid' or 'partially_paid' statuses
    if (newStatus === 'paid' || newStatus === 'partially_paid') {
        // Ensure amountPaid is a number and non-negative
        if (typeof amountPaid !== 'number' || amountPaid < 0) {
            res.status(400);
            throw new Error('Amount paid must be a non-negative number for paid/partially paid statuses.');
        }
        invoice.amountPaid = amountPaid;
    } else {
        // If status changes away from paid/partially_paid, reset amountPaid if desired
        // Or handle based on specific business logic
        // For simplicity, we won't reset it here unless explicitly needed.
    }

    const updatedInvoice = await invoice.save();

    // Populate the updated invoice for response consistency
    const populatedInvoice = await Invoice.findById(updatedInvoice._id).populate('customer', 'contactPersonName');

    res.status(200).json(populatedInvoice);
});


module.exports = {
    createInvoiceFromJob,
    getInvoices,
    getInvoiceById,
    updateInvoiceStatus, // NEW: Export the updateInvoiceStatus function
};