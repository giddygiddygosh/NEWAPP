// backend/controllers/customerController.js

const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const User = require('../models/User');
const sendEmail = require('../utils/emailService'); // Your existing email sending utility
const mongoose = require('mongoose');
const admin = require('firebase-admin');

// NEW: Import the email trigger service
const sendTemplatedEmail = require('../utils/emailTriggerService');

// Import necessary models for getCustomerStats
const Job = require('../models/Job'); // Added for getCustomerStats
const Invoice = require('../models/Invoice'); // Added for getCustomerStats


// Helper function to handle common customer field parsing (e.g., numbers and booleans)
const parseCustomerFields = (body) => {
    const parsedData = { ...body };

    // Convert number fields that might come as strings
    if (parsedData.commissionEarned !== undefined) parsedData.commissionEarned = parseFloat(parsedData.commissionEarned) || 0;
    if (parsedData.hourlyRate !== undefined) parsedData.hourlyRate = parseFloat(parsedData.hourlyRate) || 0;
    if (parsedData.jobFixedAmount !== undefined) parsedData.jobFixedAmount = parseFloat(parsedData.jobFixedAmount) || 0;
    if (parsedData.jobPercentage !== undefined) parsedData.jobPercentage = parseFloat(parsedData.jobPercentage) || 0;
    if (parsedData.dailyClockInThresholdMins !== undefined) parsedData.dailyClockInThresholdMins = parseInt(parsedData.dailyClockInThresholdMins) || 0;
    if (parsedData.invoiceReminderDaysOffset !== undefined) parsedData.invoiceReminderDaysOffset = parseInt(parsedData.invoiceReminderDaysOffset) || 0;
    if (parsedData.reviewRequestDaysOffset !== undefined) parsedData.reviewRequestDaysOffset = parseInt(parsedData.reviewRequestDaysOffset) || 0;
    if (parsedData.appointmentReminderDaysOffset !== undefined) parsedData.appointmentReminderDaysOffset = parseInt(parsedData.appointmentReminderDaysOffset) || 0;

    // Explicitly convert boolean fields to ensure they are true/false, not undefined or other types
    if (parsedData.sendWelcomeEmail !== undefined) parsedData.sendWelcomeEmail = Boolean(parsedData.sendWelcomeEmail);
    if (parsedData.sendInvoiceEmail !== undefined) parsedData.sendInvoiceEmail = Boolean(parsedData.sendInvoiceEmail);
    if (parsedData.sendInvoiceReminderEmail !== undefined) parsedData.sendInvoiceReminderEmail = Boolean(parsedData.sendInvoiceReminderEmail);
    if (parsedData.sendReviewRequestEmail !== undefined) parsedData.reviewRequestDaysOffset = Boolean(parsedData.sendReviewRequestEmail); // Corrected typo
    if (parsedData.sendAppointmentReminderEmail !== undefined) parsedData.sendAppointmentReminderEmail = Boolean(parsedData.sendAppointmentReminderEmail);
    if (parsedData.sendQuoteEmail !== undefined) parsedData.sendQuoteEmail = Boolean(parsedData.sendQuoteEmail);


    // Handle array fields (emails, phones, serviceAddresses)
    if (parsedData.emails) parsedData.email = parsedData.emails.filter(e => e.email.trim() !== '');
    if (parsedData.phones) parsedData.phone = parsedData.phones.filter(p => p.number.trim() !== '');

    if (parsedData.serviceAddresses) {
        parsedData.serviceAddresses = parsedData.serviceAddresses.map(addr => ({
            ...addr,
            amount: parseFloat(addr.amount) || 0 // Ensure amount is a number
        })).filter(addr => Object.values(addr).some(val => val && val.toString().trim() !== ''));
    }

    // Handle invoicePatternStartDate for customer
    const patternedInvoiceTriggers = ['Weekly', 'Bi-Weekly', '4-Weekly', 'Monthly'];
    if (parsedData.sendInvoiceEmail && patternedInvoiceTriggers.includes(parsedData.invoiceEmailTrigger) && !parsedData.invoicePatternStartDate) {
        parsedData.invoicePatternStartDate = parsedData.invoicePatternStartDate ? new Date(parsedData.invoicePatternStartDate) : null;
    } else {
        parsedData.invoicePatternStartDate = null;
    }

    return parsedData;
};


/**
 * @desc Create a new customer
 * @route POST /api/customers
 * @access Private (Admin, Staff, Manager)
 *
 * This function handles creating a new customer.
 * If 'convertedFromLead' is provided in the request body, it will also:
 * 1. Delete the original lead from the Lead collection.
 * 2. Attempt to create a Firebase user account for the customer.
 * 3. Send a welcome email with temporary login details.
 * All these operations are wrapped in a Mongoose transaction for atomicity.
 */
const createCustomer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const companyId = req.user.company; // Get company from authenticated user
        const companyNameFromUser = req.user.companyName; // Get company name from auth middleware

        // Parse and clean data from req.body, including boolean conversions
        const cleanedData = parseCustomerFields(req.body);

        // Basic validation after cleaning
        const primaryEmailObj = cleanedData.email.find(e => e.isMaster) || cleanedData.email[0];
        const primaryEmail = primaryEmailObj?.email;

        if (!cleanedData.contactPersonName || !cleanedData.email || cleanedData.email.length === 0 || !primaryEmail) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Contact Person Name and at least one valid Email address are required.' });
        }
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'User is not associated with a company.' });
        }

        // Client-side validation for invoicePatternStartDate if a patterned trigger is selected
        const patternedInvoiceTriggers = ['Weekly', 'Bi-Weekly', '4-Weekly', 'Monthly'];
        if (cleanedData.sendInvoiceEmail && patternedInvoiceTriggers.includes(cleanedData.invoiceEmailTrigger) && !cleanedData.invoicePatternStartDate) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'For patterned invoicing, a start date is required.' });
        }


        // Check if a customer already exists with the primary email (or any email for uniqueness)
        if (primaryEmail) {
            const existingCustomer = await Customer.findOne({
                company: companyId,
                'email.email': primaryEmail
            }).session(session);

            const existingMongooseUser = await User.findOne({
                email: primaryEmail,
                company: companyId,
                role: 'customer'
            }).session(session);

            if (existingCustomer || existingMongooseUser) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'A customer or customer user with this primary email already exists.' });
            }
        }

        // Create the new customer document using cleaned data
        const newCustomer = new Customer({
            ...cleanedData, // Spread all cleaned data
            company: companyId // Add company ID
        });

        await newCustomer.save({ session }); // Save customer within the transaction

        // --- Handle Lead Conversion (if applicable) ---
        if (cleanedData.convertedFromLead) {
            const deletedLead = await Lead.deleteOne({ _id: cleanedData.convertedFromLead, company: companyId }).session(session);
            if (deletedLead.deletedCount === 0) {
                console.warn(`[createCustomer] Lead ${cleanedData.convertedFromLead} not found or not belonging to company ${companyId} during deletion after conversion.`);
            }
        }

        // --- Firebase User Creation and Customer Welcome Email (if primary email exists) ---
        if (newCustomer.email && newCustomer.email.length > 0 && newCustomer.email[0].email && newCustomer.email[0].isMaster) { // Ensure primary email exists and is marked master
            try {
                let firebaseUserRecord;
                try {
                    firebaseUserRecord = await admin.auth().getUserByEmail(primaryEmail);
                } catch (fbError) {
                    if (fbError.code === 'auth/user-not-found') {
                        const tempPassword = Math.random().toString(36).slice(-8);
                        const userRecord = await admin.auth().createUser({
                            email: primaryEmail,
                            password: tempPassword,
                            emailVerified: false,
                            displayName: cleanedData.contactPersonName,
                        });
                        firebaseUserRecord = userRecord;

                        const customerUserMongoose = new User({
                            firebaseUid: userRecord.uid,
                            email: primaryEmail,
                            role: 'customer',
                            company: companyId,
                            contactPersonName: cleanedData.contactPersonName,
                            customer: newCustomer._id,
                        });
                        await customerUserMongoose.save({ session });

                        if (newCustomer.sendWelcomeEmail) {
                            sendTemplatedEmail(
                                'customer_welcome_email',
                                companyId,
                                primaryEmail,
                                {
                                    customerName: cleanedData.contactPersonName,
                                    companyName: companyNameFromUser,
                                    loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-portal`,
                                    temporaryPassword: tempPassword
                                },
                                'Customer Creation'
                            );
                        }
                    } else {
                        throw fbError;
                    }
                }
            } catch (fbAdminError) {
                console.error(`[createCustomer] Firebase Admin SDK error during customer user creation/email:`, fbAdminError);
            }
        } else {
            console.warn(`[createCustomer] No valid primary email found for new customer. Skipping Firebase user creation and welcome email.`);
        }

        // Commit the transaction if all operations were successful
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ message: 'Customer created successfully', customer: newCustomer });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating customer:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to create customer', error: error.message });
    }
};

/**
 * @desc Get all customers for a company
 * @route GET /api/customers
 * @access Private
 */
const getCustomers = async (req, res) => {
    try {
        const customers = await Customer.find({ company: req.user.company })
            .populate('convertedFromLead')
            .sort({ createdAt: -1 });
        res.json(customers);
    } catch (error) {
        console.error('Error getting customers:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Get a single customer by ID
 * @route GET /api/customers/:id
 * @access Private
 */
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findOne({ _id: req.params.id, company: req.user.company });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found.' });
        }
        res.status(200).json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Update a customer
 * @route PUT /api/customers/:id
 * @access Private
 */
const updateCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;
        const companyId = req.user.company;
        
        // Parse and clean data from req.body, including boolean conversions
        const cleanedData = parseCustomerFields(req.body);


        const customer = await Customer.findOne({ _id: customerId, company: companyId });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found or not authorized.' });
        }
        
        // Apply updates from cleanedData
        // Loop over cleanedData and apply to customer object
        for (const key in cleanedData) {
            // Only update if the key exists in the schema and is part of the cleanedData
            // And prevent overwriting _id, company, etc. that should not be changed this way
            if (customer.schema.paths[key] && !['_id', 'company', 'createdAt', 'updatedAt'].includes(key)) {
                // Special handling for array fields if needed (though parseCustomerFields handles this too)
                if (Array.isArray(cleanedData[key]) && customer[key] instanceof mongoose.Types.DocumentArray) {
                    customer[key].splice(0, customer[key].length, ...cleanedData[key]);
                } else {
                    customer[key] = cleanedData[key];
                }
            }
        }
        
        // Ensure updatedAt is always updated on save
        customer.updatedAt = Date.now();

        await customer.save(); // Use save() to trigger pre-save hooks and run validators


        res.status(200).json({ message: 'Customer updated successfully', customer: customer });
    } catch (error) {
        console.error('Error updating customer:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Delete a customer
 * @route DELETE /api/customers/:id
 * @access Private
 */
const deleteCustomer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const customerId = req.params.id;
        const companyId = req.user.company;

        const customer = await Customer.findOne({ _id: customerId, company: companyId }).session(session);

        if (!customer) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Customer not found or not authorized.' });
        }

        const primaryEmail = customer.email.find(e => e.isMaster)?.email || customer.email[0]?.email;
        if (primaryEmail) {
            try {
                const userDoc = await User.findOne({ email: primaryEmail, company: companyId, role: 'customer' }).session(session);
                if (userDoc && userDoc.firebaseUid) {
                    await admin.auth().deleteUser(userDoc.firebaseUid);
                    await User.deleteOne({ _id: userDoc._id }).session(session);
                    console.log(`[deleteCustomer] Firebase user and Mongoose user for ${primaryEmail} deleted.`);
                }
            } catch (fbError) {
                console.warn(`[deleteCustomer] Failed to delete Firebase user for ${primaryEmail}:`, fbError.message);
            }
        }

        await customer.deleteOne({ session });

        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Customer removed successfully' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting customer:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Bulk upload customers from CSV/XLS
 * @route POST /api/customers/bulk-upload
 * @access Private (Admin)
 */
const bulkUploadCustomers = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const customersData = req.body.customers; // Array of customer objects from parsed file
        const companyId = req.user.company;

        if (!Array.isArray(customersData) || customersData.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'No customer data provided for bulk upload.' });
        }

        const results = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };

        for (const customerData of customersData) {
            try {
                // Basic validation for bulk upload: must have contactPersonName and email
                if (!customerData.contactPersonName || !customerData.email || customerData.email.trim() === '') {
                    results.failed++;
                    results.errors.push(`Skipped record (missing name or email): ${JSON.stringify(customerData)}`);
                    continue; // Skip to next record
                }

                // Format email and phone for schema (array of objects)
                const formattedEmails = [{ email: customerData.email.trim(), label: 'Primary', isMaster: true }];
                const formattedPhones = customerData.phone ? [{ number: customerData.phone.trim(), label: 'Primary', isMaster: true }] : [];

                // Check for existing customer by email
                let existingCustomer = await Customer.findOne({ company: companyId, 'email.email': customerData.email.trim() }).session(session);
                let existingUser = await User.findOne({ email: customerData.email.trim(), company: companyId }).session(session); // Check Mongoose user

                if (existingCustomer) {
                    // Update existing customer
                    Object.assign(existingCustomer, {
                        companyName: customerData.companyName || existingCustomer.companyName,
                        contactPersonName: customerData.contactPersonName || existingCustomer.contactPersonName,
                        email: formattedEmails, // Overwrite with provided primary email
                        phone: formattedPhones,
                        address: customerData.address || existingCustomer.address,
                        // --- Add boolean fields for bulk update here if applicable from CSV ---
                        // sendWelcomeEmail: Boolean(customerData.sendWelcomeEmail),
                        // ... and so on for other booleans if they come from CSV
                        updatedAt: Date.now(),
                    });
                    await existingCustomer.save({ session });
                    results.updated++;
                } else {
                    // Create new customer
                    const newCustomer = new Customer({
                        company: companyId,
                        companyName: customerData.companyName,
                        contactPersonName: customerData.contactPersonName,
                        email: formattedEmails,
                        phone: formattedPhones,
                        address: customerData.address,
                        // --- Add boolean fields for bulk create here if applicable from CSV ---
                        // sendWelcomeEmail: Boolean(customerData.sendWelcomeEmail),
                        // ... and so on for other booleans if they come from CSV
                    });
                    await newCustomer.save({ session });
                    results.created++;

                    // Attempt to create Firebase User for new customer (similar to createCustomer logic)
                    if (newCustomer.email && newCustomer.email.length > 0 && newCustomer.email[0].email && !existingUser) {
                        try {
                            const tempPassword = Math.random().toString(36).slice(-8);
                            const userRecord = await admin.auth().createUser({
                                email: newCustomer.email[0].email,
                                password: tempPassword,
                                emailVerified: false,
                                displayName: newCustomer.contactPersonName,
                            });
                            const customerUserMongoose = new User({
                                firebaseUid: userRecord.uid,
                                email: newCustomer.email[0].email,
                                role: 'customer',
                                company: companyId,
                                contactPersonName: newCustomer.contactPersonName,
                                customer: newCustomer._id,
                            });
                            await customerUserMongoose.save({ session });

                            // Optionally send welcome email here (might overwhelm during bulk upload)
                            // const loginSubject = 'Welcome! Your ServiceOS Customer Portal Login Details';
                            // ... send email ...
                        } catch (fbError) {
                            console.warn(`[Bulk Upload Customers] Firebase user creation failed for ${newCustomer.email[0].email}:`, fbError.message);
                            results.errors.push(`Firebase user creation failed for ${newCustomer.email[0].email}: ${fbError.message}`);
                        }
                    }
                }
            } catch (recordError) {
                results.failed++;
                results.errors.push(`Failed to process customer record ${customerData.email || customerData.contactPersonName}: ${recordError.message}`);
                console.error(`[Bulk Upload Customers] Error processing record: ${recordError.message}`, customerData);
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: 'Bulk upload completed.',
            summary: `Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`,
            details: results.errors,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error during bulk customer upload:', error);
        res.status(500).json({ message: 'Bulk upload failed due to a server error.', error: error.message });
    }
};


/**
 * @desc Get customer statistics (total jobs, total invoiced, outstanding amount)
 * @route GET /api/customers/:id/stats
 * @access Private (Admin, Manager)
 */
const getCustomerStats = asyncHandler(async (req, res) => {
    const customerId = req.params.id;
    const companyId = req.user.company;

    // 1. Verify customer exists and belongs to the company
    const customer = await Customer.findOne({ _id: customerId, company: companyId });

    if (!customer) {
        return res.status(404).json({ message: 'Customer not found or not authorized.' });
    }

    // 2. Get total jobs for the customer
    const totalJobs = await Job.countDocuments({ customer: customerId, company: companyId });

    // 3. Calculate total invoiced amount and total outstanding amount
    const invoiceStats = await Invoice.aggregate([
        {
            $match: {
                customer: new mongoose.Types.ObjectId(customerId),
                company: new mongoose.Types.ObjectId(companyId)
            }
        },
        {
            $group: {
                _id: null,
                totalInvoicedAmount: { $sum: '$totalAmount' },
                totalOutstandingAmount: {
                    $sum: {
                        $cond: {
                            if: { $ne: ['$status', 'Paid'] }, // Sum only if status is not 'Paid'
                            then: '$totalAmount',
                            else: 0
                        }
                    }
                }
            }
        }
    ]);

    const stats = {
        totalJobs: totalJobs,
        totalInvoicedAmount: invoiceStats.length > 0 ? invoiceStats[0].totalInvoicedAmount : 0,
        totalOutstandingAmount: invoiceStats.length > 0 ? invoiceStats[0].totalOutstandingAmount : 0,
    };

    res.status(200).json(stats);
});


module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    bulkUploadCustomers,
    getCustomerStats, // <--- ADD THIS LINE
};