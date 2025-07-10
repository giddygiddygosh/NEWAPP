// backend/controllers/invoiceController.js

const asyncHandler = require('express-async-handler');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const CompanySetting = require('../models/CompanySetting');
const StockItem = require('../models/StockItem');
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
            currency: companySettings.defaultCurrency || { code: 'GBP', symbol: '£' },
        };

        const newInvoiceArray = await Invoice.create([invoiceData], { session });
        const newInvoice = newInvoiceArray[0];

        await session.commitTransaction();

        // --- FIX: This logic now correctly handles old customers ---
        // It will send the email unless the setting is explicitly set to false.
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

// --- Other Invoice Functions (GET, UPDATE) ---

const getInvoices = asyncHandler(async (req, res) => {
    const invoices = await Invoice.find({ company: req.user.company._id }).populate('customer', 'contactPersonName');
    res.status(200).json(invoices);
});

const getInvoiceById = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
        .populate('customer')
        .populate({ path: 'job', select: 'serviceType' });

    if (invoice && invoice.company.toString() === req.user.company._id.toString()) {
        res.status(200).json(invoice);
    } else {
        res.status(404).json({ message: 'Invoice not found or not authorized.' });
    }
});

const updateInvoiceStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status: newStatus, amountPaid } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice || invoice.company.toString() !== req.user.company._id.toString()) {
        return res.status(404).json({ message: 'Invoice not found or not authorized.' });
    }
    
    const validStatuses = ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'void'];
    if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ message: `Invalid status: '${newStatus}'.` });
    }

    invoice.status = newStatus;
    if (newStatus === 'paid' || newStatus === 'partially_paid') {
        if (typeof amountPaid !== 'number' || amountPaid < 0) {
            return res.status(400).json({ message: 'Amount paid must be a non-negative number.' });
        }
        invoice.amountPaid = amountPaid;
    }

    const updatedInvoice = await invoice.save();
    const populatedInvoice = await Invoice.findById(updatedInvoice._id).populate('customer', 'contactPersonName');
    res.status(200).json(populatedInvoice);
});

module.exports = {
    createStockInvoice,
    getInvoices,
    getInvoiceById,
    updateInvoiceStatus,
};
