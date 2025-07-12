const asyncHandler = require('express-async-handler'); // Corrected from express-express-handler
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const CompanySetting = require('../models/CompanySetting');
const StockItem = require('../models/StockItem');
const Job = require('../models/Job');
const mongoose = require('mongoose');
const { sendInvoiceEmail } = require('../services/invoiceService');

/**
 * @desc Create a new invoice manually from a list of stock items
 * @route POST /api/invoices/stock
 * @access Private (Admin, Manager)
 */
const createStockInvoice = asyncHandler(async (req, res) => {
    const { customerId, items } = req.body; // Expects customerId and an array of items with stockId and quantity
    const { company, companyName } = req.user;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Customer ID and a list of items are required.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const customer = await Customer.findById(customerId).session(session);
        if (!customer) throw new Error('Customer not found.');

        const companySettings = await CompanySetting.findOne({ company: company._id }).session(session);
        if (!companySettings) throw new Error('Company settings not found.');

        const lineItems = [];
        let subtotal = 0;

        for (const item of items) {
            const stockDoc = await StockItem.findById(item.stockId).session(session);
            if (!stockDoc) throw new Error(`Stock item with ID ${item.stockId} not found.`);

            const lineItem = {
                description: stockDoc.name,
                quantity: item.quantity,
                unitPrice: stockDoc.salePrice,
                totalPrice: item.quantity * stockDoc.salePrice,
            };
            lineItems.push(lineItem);
            subtotal += lineItem.totalPrice;

            stockDoc.stockQuantity -= item.quantity;
            if (stockDoc.stockQuantity < 0) {
                throw new Error(`Insufficient stock for ${stockDoc.name}.`);
            }
            await stockDoc.save({ session });
        }

        const { invoicePrefix, nextInvoiceSeqNumber, defaultTaxRate } = companySettings.invoiceSettings;
        const formattedInvoiceNumber = `${invoicePrefix}${String(nextInvoiceSeqNumber).padStart(4, '0')}`;

        companySettings.invoiceSettings.nextInvoiceSeqNumber += 1;
        await companySettings.save({ session });

        const taxAmount = subtotal * (defaultTaxRate || 0);
        const total = subtotal + taxAmount;

        const invoiceData = {
            company: company._id,
            customer: customerId,
            job: null, // No job for a stock invoice
            invoiceNumber: formattedInvoiceNumber,
            status: 'draft',
            issueDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            lineItems,
            subtotal,
            taxAmount,
            total,
            payments: [], // New invoices start with no payments
            balanceDue: total, // Balance due is full total initially
            currency: companySettings.defaultCurrency || { code: 'GBP', symbol: '£' },
        };

        const newInvoiceArray = await Invoice.create([invoiceData], { session });
        const newInvoice = newInvoiceArray[0];

        await session.commitTransaction();

        if (customer.sendInvoiceEmail !== false) {
            sendInvoiceEmail(newInvoice._id, company._id, companyName).catch(err => {
                console.error(`[BACKGROUND_EMAIL_ERROR] Failed to send email for manual stock invoice ${newInvoice.invoiceNumber}:`, err.message);
            });
        }

        res.status(201).json({ message: 'Stock invoice created successfully.', invoice: newInvoice });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message || 'Failed to create stock invoice.' });
    } finally {
        session.endSession();
    }
});

// --- NEW FUNCTION: createJobInvoice ---
/**
 * @desc Create a new invoice from a completed job
 * @route POST /api/invoices/job
 * @access Private (Admin, Manager)
 */
const createJobInvoice = asyncHandler(async (req, res) => {
    const { jobId } = req.body;
    const { company, companyName } = req.user;

    if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required to create an invoice from a job.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Populate customer and usedStock.stockId, making sure to select `name` and `salePrice`
        const job = await Job.findById(jobId)
            .populate('customer')
            .populate({
                path: 'usedStock.stockId',
                select: 'name salePrice'
            })
            .session(session);

        if (!job || job.company.toString() !== company._id.toString()) {
            res.status(404);
            throw new Error('Job not found or not authorized.');
        }
        if (job.status !== 'Completed') {
            res.status(400);
            throw new Error('Invoice can only be generated from a "Completed" job.');
        }

        // Check if an invoice already exists for this job
        const existingInvoice = await Invoice.findOne({ job: jobId, company: company._id }).session(session);
        if (existingInvoice) {
            res.status(400);
            throw new Error(`An invoice (Invoice #${existingInvoice.invoiceNumber}) already exists for this job.`);
        }

        const companySettings = await CompanySetting.findOne({ company: company._id }).session(session);
        if (!companySettings) throw new Error('Company settings not found.');

        const lineItems = [];
        let subtotal = 0;

        // Add job service as a line item
        if (job.serviceType && job.price > 0) {
            lineItems.push({
                description: job.serviceType,
                quantity: 1,
                unitPrice: job.price,
                totalPrice: job.price,
            });
            subtotal += job.price;
        }

        // Add used stock items as line items
        if (job.usedStock && job.usedStock.length > 0) {
            for (const item of job.usedStock) {
                if (item.stockId && item.quantity > 0 && item.stockId.salePrice !== undefined) {
                    lineItems.push({
                        description: item.stockId.name,
                        quantity: item.quantity,
                        unitPrice: item.stockId.salePrice,
                        totalPrice: item.quantity * item.stockId.salePrice,
                    });
                    subtotal += item.quantity * item.stockId.salePrice;
                } else if (item.stockId && item.quantity > 0) {
                    console.warn(`Stock item ${item.stockId.name} in job ${jobId} has no salePrice. Using default 0.`);
                    lineItems.push({
                        description: item.stockId.name,
                        quantity: item.quantity,
                        unitPrice: item.stockId.salePrice || 0, // Fallback if salePrice is missing
                        totalPrice: item.quantity * (item.stockId.salePrice || 0),
                    });
                }
            }
        }

        // Fallback if no line items generated
        if (lineItems.length === 0) {
            res.status(400);
            throw new Error('Could not generate line items for this job. Ensure service type and price are set, and used stock items have sale prices.');
        }

        const { invoicePrefix, nextInvoiceSeqNumber, defaultTaxRate } = companySettings.invoiceSettings;
        const formattedInvoiceNumber = `${invoicePrefix}${String(nextInvoiceSeqNumber).padStart(4, '0')}`;

        companySettings.invoiceSettings.nextInvoiceSeqNumber += 1;
        await companySettings.save({ session });

        const taxAmount = subtotal * (defaultTaxRate || 0);
        const total = subtotal + taxAmount;

        const invoiceData = {
            company: company._id,
            customer: job.customer._id,
            job: job._id, // Link invoice to job
            invoiceNumber: formattedInvoiceNumber,
            status: 'sent', // Automatically sent if generated from completed job
            issueDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Due in 30 days
            lineItems,
            subtotal,
            taxAmount,
            total,
            payments: [],
            balanceDue: total,
            currency: companySettings.defaultCurrency || { code: 'GBP', symbol: '£' },
        };

        const newInvoiceArray = await Invoice.create([invoiceData], { session });
        const newInvoice = newInvoiceArray[0];

        // Update job status to 'Invoiced' if it's not already
        if (job.status !== 'Invoiced') {
            job.status = 'Invoiced';
            await job.save({ session });
        }

        await session.commitTransaction();

        if (job.customer.sendInvoiceEmail !== false) { // Assuming customer has sendInvoiceEmail preference
            sendInvoiceEmail(newInvoice._id, company._id, companyName).catch(err => {
                console.error(`[BACKGROUND_EMAIL_ERROR] Failed to send email for job invoice ${newInvoice.invoiceNumber}:`, err.message);
            });
        }

        res.status(201).json({ message: 'Invoice created from job successfully.', invoice: newInvoice });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating invoice from job:', error);
        // Handle specific errors for better frontend messages
        if (error.message.includes('Insufficient stock')) {
            return res.status(400).json({ message: error.message });
        }
        if (error.message.includes('already exists for this job')) {
             return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || 'Failed to create invoice from job.' });
    } finally {
        session.endSession();
    }
});


// --- Other Invoice Functions (GET, UPDATE) ---

const getInvoices = asyncHandler(async (req, res) => {
    const invoices = await Invoice.find({ company: req.user.company._id }).populate('customer', 'contactPersonName');
    res.status(200).json(invoices);
});

const getInvoiceById = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
        .populate('customer')
        .populate({ path: 'job', select: 'serviceType' }); // Populate job for context

    if (invoice && invoice.company.toString() === req.user.company._id.toString()) {
        res.status(200).json(invoice);
    } else {
        res.status(404).json({ message: 'Invoice not found or not authorized.' });
    }
});

/**
 * @desc Update an invoice's non-payment status (e.g., from draft to sent, or to void)
 * @route PUT /api/invoices/:id/status
 * @access Private (Admin, Manager)
 * Note: Payments should be recorded via the separate recordPayment endpoint.
 */
const updateInvoiceStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status: newStatus } = req.body; // Only expecting 'status' here

    const invoice = await Invoice.findById(id);
    if (!invoice || invoice.company.toString() !== req.user.company._id.toString()) {
        return res.status(404).json({ message: 'Invoice not found or not authorized.' });
    }

    // Define allowed status transitions for this endpoint (excluding payment-related ones)
    const allowedNonPaymentStatuses = ['draft', 'sent', 'void', 'refunded']; // Added 'refunded'
    if (!allowedNonPaymentStatuses.includes(newStatus)) {
        return res.status(400).json({ message: `Invalid status for this update: '${newStatus}'. Use a payment endpoint for 'paid' or 'partially_paid' statuses.` });
    }

    invoice.status = newStatus;
    const updatedInvoice = await invoice.save(); // pre-save hook will handle amountPaid/balanceDue/status updates

    // Populate and return the updated invoice
    const populatedInvoice = await Invoice.findById(updatedInvoice._id).populate('customer', 'contactPersonName');
    res.status(200).json(populatedInvoice);
});


/**
 * @desc Record a new payment against an invoice
 * @route POST /api/invoices/:id/payments
 * @access Private (Admin, Manager, Staff - possibly Customer via portal)
 */
const recordPayment = asyncHandler(async (req, res) => {
    const { id } = req.params; // Invoice ID
    const { amount, paymentIntentId, method, notes } = req.body; // Payment details

    const invoice = await Invoice.findById(id);

    if (!invoice || invoice.company.toString() !== req.user.company._id.toString()) {
        return res.status(404).json({ message: 'Invoice not found or not authorized.' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Payment amount must be a positive number.' });
    }
    if (invoice.balanceDue <= 0.01) { // Already paid
         return res.status(400).json({ message: 'This invoice has no outstanding balance.' });
    }
    if (amount > invoice.balanceDue + 0.01) { // Don't allow overpayment (with small epsilon)
        return res.status(400).json({ message: `Payment amount (£${amount.toFixed(2)}) exceeds outstanding balance (£${invoice.balanceDue.toFixed(2)}).` });
    }


    // Create a new payment record
    const newPayment = {
        amount: amount,
        date: new Date(),
        paymentIntentId: paymentIntentId || null, // Capture Stripe PI ID if available
        method: method || 'stripe', // Default to 'stripe' for this flow
        notes: notes || `Payment received via ${method || 'Stripe'}`
    };

    // Add the new payment to the invoice's payments array
    invoice.payments.push(newPayment);

    // Mongoose pre-save hook will automatically update `amountPaid`, `balanceDue`, and `status`.
    const updatedInvoice = await invoice.save();

    // Populate and return the updated invoice
    const populatedInvoice = await Invoice.findById(updatedInvoice._id)
        .populate('customer', 'contactPersonName')
        .populate({ path: 'job', select: 'serviceType' });

    res.status(200).json({ message: 'Payment recorded successfully!', invoice: populatedInvoice });

});


module.exports = {
    createStockInvoice,
    createJobInvoice, // <--- ADDED: Export the new function
    getInvoices,
    getInvoiceById,
    updateInvoiceStatus,
    recordPayment,
};