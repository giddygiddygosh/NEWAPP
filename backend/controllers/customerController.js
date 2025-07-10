const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const User = require('../models/User');
const sendEmail = require('../utils/emailService'); // Your existing email sending utility
const mongoose = require('mongoose');
const admin = require('firebase-admin');

// NEW: Import the email trigger service
const sendTemplatedEmail = require('../utils/emailTriggerService');

// --- START TEST LOG FROM BACKEND CONTROLLER ---
console.log('THIS IS A TEST FROM BACKEND CONTROLLER. customerController.js module loaded.');
// --- END TEST LOG FROM BACKEND CONTROLLER ---

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
    if (parsedData.sendReviewRequestEmail !== undefined) parsedData.sendReviewRequestEmail = Boolean(parsedData.sendReviewRequestEmail);
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
    const patternedInvoiceTriggers = ['On Completion', 'Weekly', 'Bi-Weekly', '4-Weekly', 'Monthly']; // 'On Completion' is typically not patterned
    if (parsedData.sendInvoiceEmail && patternedInvoiceTriggers.includes(parsedData.invoiceEmailTrigger)) {
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
    // --- START DEBUG LOGGING: What data is RECEIVED by backend for new customer ---
    console.log('--- BACKEND RECEIVED REQ.BODY (Customer Creation) ---');
    console.log('Original req.body:', req.body); // Log full body for inspection
    console.log('sendWelcomeEmail:', req.body.sendWelcomeEmail);
    console.log('sendInvoiceEmail:', req.body.sendInvoiceEmail);
    console.log('invoiceEmailTrigger:', req.body.invoiceEmailTrigger);
    console.log('invoicePatternStartDate:', req.body.invoicePatternStartDate);
    console.log('sendInvoiceReminderEmail:', req.body.sendInvoiceReminderEmail);
    console.log('invoiceReminderDaysOffset:', req.body.invoiceReminderDaysOffset);
    console.log('sendReviewRequestEmail:', req.body.sendReviewRequestEmail);
    console.log('reviewRequestDaysOffset:', req.body.reviewRequestDaysOffset);
    console.log('sendAppointmentReminderEmail:', req.body.sendAppointmentReminderEmail);
    console.log('appointmentReminderDaysOffset:', req.body.appointmentReminderDaysOffset);
    console.log('sendQuoteEmail:', req.body.sendQuoteEmail);
    console.log('--- END BACKEND REQ.BODY ---');
    // --- END DEBUG LOGGING ---

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
        if (primaryEmail) {
            try {
                let firebaseUserRecord;
                try {
                    // Try to get user if already exists (e.g., if lead was manually created in Firebase)
                    firebaseUserRecord = await admin.auth().getUserByEmail(primaryEmail);
                } catch (fbError) {
                    if (fbError.code === 'auth/user-not-found') {
                        // If user doesn't exist, create one
                        const tempPassword = Math.random().toString(36).slice(-8); // Generate temporary password
                        const userRecord = await admin.auth().createUser({
                            email: primaryEmail,
                            password: tempPassword,
                            emailVerified: false,
                            displayName: cleanedData.contactPersonName,
                        });
                        firebaseUserRecord = userRecord;

                        // Create the corresponding Mongoose User document for linking
                        const customerUserMongoose = new User({
                            firebaseUid: userRecord.uid,
                            email: primaryEmail,
                            role: 'customer',
                            company: companyId,
                            contactPersonName: cleanedData.contactPersonName,
                            customer: newCustomer._id, // Link to the newly created Mongoose Customer
                        });
                        await customerUserMongoose.save({ session });

                        // --- Call sendTemplatedEmail for 'customer_welcome_email' if enabled ---
                        if (newCustomer.sendWelcomeEmail) { // Only send if preference is true for this new customer
                            sendTemplatedEmail(
                                'customer_welcome_email', // templateType
                                companyId,                // companyId
                                primaryEmail,             // recipientEmail
                                {                         // placeholderData
                                    customerName: cleanedData.contactPersonName,
                                    companyName: companyNameFromUser,
                                    loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-portal`,
                                    temporaryPassword: tempPassword // Pass temporary password for template
                                },
                                'Customer Creation' // triggerSource
                            );
                        }
                    } else {
                        // Other Firebase Admin SDK errors (e.g., network issues)
                        throw fbError; // Re-throw to be caught by outer try-catch
                    }
                }
            } catch (fbAdminError) {
                console.error(`[createCustomer] Firebase Admin SDK error during customer user creation/email:`, fbAdminError);
                // Depending on severity, you might abort transaction or just log a warning
                // For now, allow customer creation but fail user/email if Firebase fails
            }
        } else {
            console.warn(`[createCustomer] No primary email found for new customer. Skipping Firebase user creation and welcome email.`);
        }

        // Commit the transaction if all operations were successful
        await session.commitTransaction();
        session.endSession();

        // --- START DEBUG LOGGING: What Mongoose returns after saving ---
        console.log('--- BACKEND Mongoose newCustomer after creation ---');
        console.log('sendWelcomeEmail (from DB object):', newCustomer.sendWelcomeEmail);
        console.log('sendInvoiceEmail (from DB object):', newCustomer.sendInvoiceEmail);
        console.log('invoiceEmailTrigger (from DB object):', newCustomer.invoiceEmailTrigger);
        console.log('invoicePatternStartDate (from DB object):', newCustomer.invoicePatternStartDate);
        console.log('sendInvoiceReminderEmail (from DB object):', newCustomer.sendInvoiceReminderEmail);
        console.log('invoiceReminderDaysOffset (from DB object):', newCustomer.invoiceReminderDaysOffset);
        console.log('sendReviewRequestEmail (from DB object):', newCustomer.sendReviewRequestEmail);
        console.log('reviewRequestDaysOffset (from DB object):', newCustomer.reviewRequestDaysOffset);
        console.log('sendAppointmentReminderEmail (from DB object):', newCustomer.sendAppointmentReminderEmail);
        console.log('appointmentReminderDaysOffset (from DB object):', newCustomer.appointmentReminderDaysOffset);
        console.log('sendQuoteEmail (from DB object):', newCustomer.sendQuoteEmail);
        console.log('--- END BACKEND Mongoose newCustomer ---');
        // --- END DEBUG LOGGING ---

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
    // --- START DEBUG LOGGING: What data is RECEIVED by backend for updating customer ---
    console.log('--- BACKEND RECEIVED REQ.BODY (Customer Update) ---');
    console.log('Original req.body:', req.body); // Log full body for inspection
    console.log('sendWelcomeEmail:', req.body.sendWelcomeEmail);
    console.log('sendInvoiceEmail:', req.body.sendInvoiceEmail);
    console.log('invoiceEmailTrigger:', req.body.invoiceEmailTrigger);
    console.log('invoicePatternStartDate:', req.body.invoicePatternStartDate);
    console.log('sendInvoiceReminderEmail:', req.body.sendInvoiceReminderEmail);
    console.log('invoiceReminderDaysOffset:', req.body.invoiceReminderDaysOffset);
    console.log('sendReviewRequestEmail:', req.body.sendReviewRequestEmail);
    console.log('reviewRequestDaysOffset:', req.body.reviewRequestDaysOffset);
    console.log('sendAppointmentReminderEmail:', req.body.sendAppointmentReminderEmail);
    console.log('appointmentReminderDaysOffset:', req.body.appointmentReminderDaysOffset);
    console.log('sendQuoteEmail:', req.body.sendQuoteEmail);
    console.log('--- END BACKEND REQ.BODY ---');
    // --- END DEBUG LOGGING ---

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

        // --- START DEBUG LOGGING: What Mongoose returns after updating ---
        console.log('--- BACKEND Mongoose customer after update ---');
        console.log('sendWelcomeEmail (from DB object):', customer.sendWelcomeEmail);
        console.log('sendInvoiceEmail (from DB object):', customer.sendInvoiceEmail);
        console.log('invoiceEmailTrigger (from DB object):', customer.invoiceEmailTrigger);
        console.log('invoicePatternStartDate (from DB object):', customer.invoicePatternStartDate);
        console.log('sendInvoiceReminderEmail (from DB object):', customer.sendInvoiceReminderEmail);
        console.log('invoiceReminderDaysOffset (from DB object):', customer.invoiceReminderDaysOffset);
        console.log('sendReviewRequestEmail (from DB object):', customer.sendReviewRequestEmail);
        console.log('reviewRequestDaysOffset (from DB object):', customer.reviewRequestDaysOffset);
        console.log('sendAppointmentReminderEmail (from DB object):', customer.sendAppointmentReminderEmail);
        console.log('appointmentReminderDaysOffset (from DB object):', customer.appointmentReminderDaysOffset);
        console.log('sendQuoteEmail (from DB object):', customer.sendQuoteEmail);
        console.log('--- END BACKEND Mongoose customer ---');
        // --- END DEBUG LOGGING ---


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
                            results.errors.push(`Firebase user creation failed for ${newCustomer.email[0].email}: ${fbError.message}`); // Fixed: access error.message
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


module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    bulkUploadCustomers, // Export the bulk upload function
};