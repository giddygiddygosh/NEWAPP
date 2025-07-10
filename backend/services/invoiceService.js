// backend/services/invoiceService.js

const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');
const Customer = require('../models/Customer');
const CompanySetting = require('../models/CompanySetting');
const sendTemplatedEmail = require('../utils/emailTriggerService');
const { generateInvoicePdfBuffer } = require('../utils/pdfGenerator');

/**
 * Generates an invoice for a completed job and triggers immediate sending if required.
 * @param {string} jobId - The ID of the job to invoice.
 * @param {object} user - The authenticated user object.
 */
const generateAndProcessInvoiceForJob = async (jobId, user) => {
    console.log(`[InvoiceService] Starting automated invoice generation for job ID: ${jobId}`);
    const companyId = user.company._id;
    const companyName = user.companyName;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const job = await Job.findById(jobId).session(session); // No need to populate customer here anymore
        if (!job) throw new Error('Job not found.');

        // --- FIX: Explicitly fetch the full customer document to ensure all fields are present ---
        const customer = await Customer.findById(job.customer).session(session);
        if (!customer) throw new Error('Customer associated with job not found.');

        const existingInvoice = await Invoice.findOne({ job: jobId }).session(session);
        if (existingInvoice) {
            console.log(`[InvoiceService] Invoice for job ${jobId} already exists. Skipping.`);
            await session.abortTransaction();
            return;
        }

        const companySettings = await CompanySetting.findOne({ company: companyId }).session(session);
        if (!companySettings) throw new Error('Company settings not found.');

        const { invoicePrefix, nextInvoiceSeqNumber, defaultTaxRate } = companySettings.invoiceSettings;
        const formattedInvoiceNumber = `${invoicePrefix}${String(nextInvoiceSeqNumber).padStart(4, '0')}`;
        
        companySettings.invoiceSettings.nextInvoiceSeqNumber += 1;
        await companySettings.save({ session });

        const lineItems = [{ description: job.serviceType, quantity: 1, unitPrice: job.price, totalPrice: job.price }];
        const subtotal = job.price;
        const taxAmount = subtotal * (defaultTaxRate || 0);
        const total = subtotal + taxAmount;

        const invoiceData = {
            company: companyId,
            job: job._id,
            customer: customer._id,
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

        const [newInvoice] = await Invoice.create([invoiceData], { session });
        job.status = 'Invoiced';
        await job.save({ session });
        await session.commitTransaction();

        console.log(`[InvoiceService] Successfully created Invoice ${newInvoice.invoiceNumber} for Job ${jobId}.`);

        // This logic now uses the fully-fetched customer object
        const shouldSend = customer.sendInvoiceEmail !== false; 
        const trigger = customer.invoiceEmailTrigger || 'On Completion';

        if (shouldSend && trigger === 'On Completion') {
            console.log(`[InvoiceService] Trigger is 'On Completion'. Sending email for Invoice ${newInvoice.invoiceNumber}.`);
            sendInvoiceEmail(newInvoice._id, companyId, companyName).catch(err => {
                console.error(`[BACKGROUND_EMAIL_ERROR] Failed to send 'On Completion' email for invoice ${newInvoice.invoiceNumber}:`, err);
            });
        }

    } catch (error) {
        await session.abortTransaction();
        console.error(`[InvoiceService] Error creating invoice for job ${jobId}:`, error);
    } finally {
        session.endSession();
    }
};

/**
 * A reusable function to send a specific invoice email with its PDF attachment.
 * @param {string} invoiceId - The ID of the invoice to send.
 * @param {string} companyId - The ID of the company.
 * @param {string} companyName - The name of the company.
 */
const sendInvoiceEmail = async (invoiceId, companyId, companyName) => {
    const invoice = await Invoice.findById(invoiceId).populate('customer').populate('job');
    if (!invoice || !invoice.customer) {
        console.error(`[sendInvoiceEmail] Could not find invoice or customer for Invoice ID: ${invoiceId}`);
        return;
    }

    if (invoice.status === 'sent' || invoice.status === 'paid') {
        console.log(`[sendInvoiceEmail] Invoice ${invoice.invoiceNumber} has already been sent. Skipping.`);
        return;
    }

    const customerPrimaryEmail = invoice.customer.email.find(e => e.isMaster)?.email || invoice.customer.email[0]?.email;
    if (!customerPrimaryEmail) {
        console.warn(`[sendInvoiceEmail] No primary email for customer ${invoice.customer.contactPersonName}. Cannot send invoice.`);
        return;
    }

    let attachments = [];
    try {
        const pdfBuffer = await generateInvoicePdfBuffer({ ...invoice.toObject(), companyName });
        attachments.push({
            filename: `Invoice_${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
        });
    } catch (pdfError) {
        console.error(`[sendInvoiceEmail] Failed to generate PDF for invoice ${invoice.invoiceNumber}:`, pdfError);
    }

    const invoiceLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invoices/${invoice._id}`;
    const success = await sendTemplatedEmail(
        'invoice_email',
        companyId,
        customerPrimaryEmail,
        {
            customerName: invoice.customer.contactPersonName,
            companyName: companyName,
            invoiceNumber: invoice.invoiceNumber,
            invoiceAmount: invoice.total.toFixed(2),
            invoiceLink: invoiceLink,
            dueDate: new Date(invoice.dueDate).toLocaleDateString(),
        },
        `Your Invoice from ${companyName}`,
        attachments
    );

    if (success) {
        invoice.status = 'sent';
        await invoice.save();
        console.log(`[sendInvoiceEmail] Successfully sent email for invoice ${invoice.invoiceNumber}.`);
    }
};

module.exports = { generateAndProcessInvoiceForJob, sendInvoiceEmail };
