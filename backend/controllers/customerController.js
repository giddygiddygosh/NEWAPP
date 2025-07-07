// backend/controllers/customerController.js

const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const User = require('../models/User');
const sendEmail = require('../utils/emailService'); // Your existing email sending utility
const mongoose = require('mongoose');
const admin = require('firebase-admin');

// NEW: Import the email trigger service
const sendTemplatedEmail = require('../utils/emailTriggerService');

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
        const {
            companyName, contactPersonName, email, phone, address,
            serviceAddresses, salesPersonName, commissionEarned, convertedFromLead,
            customerType, industry
        } = req.body;
        const companyId = req.user.company; // Get company from authenticated user
        const companyNameFromUser = req.user.companyName; // Get company name from auth middleware

        // Basic validation
        if (!contactPersonName || !email || email.length === 0 || !email.some(e => e.email.trim() !== '')) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Contact Person Name and at least one valid Email address are required.' });
        }
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'User is not associated with a company.' });
        }

        // Ensure at least one email is marked as master if there are emails
        const primaryEmailObj = email.find(e => e.isMaster) || email[0];
        const primaryEmail = primaryEmailObj?.email;

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

        // Create the new customer document
        const newCustomer = new Customer({
            company: companyId,
            companyName,
            contactPersonName,
            email: email, // Use the array directly
            phone: phone, // Use the array directly
            address,
            serviceAddresses,
            salesPersonName,
            commissionEarned,
            convertedFromLead: convertedFromLead || null, // Link to lead if it's a conversion
            customerType,
            industry,
        });

        await newCustomer.save({ session }); // Save customer within the transaction

        // --- Handle Lead Conversion (if applicable) ---
        if (convertedFromLead) {
            // Delete the original lead as it's now a customer
            const deletedLead = await Lead.deleteOne({ _id: convertedFromLead, company: companyId }).session(session);
            if (deletedLead.deletedCount === 0) {
                console.warn(`[createCustomer] Lead ${convertedFromLead} not found or not belonging to company ${companyId} during deletion after conversion.`);
            }
        }

        // --- Firebase User Creation and Email (if primary email exists) ---
        // This part already sends a welcome email with temporary login details.
        // We will *replace* this with fetching the 'welcome_email' template.
        if (primaryEmail) {
            try {
                let firebaseUserRecord;
                try {
                    firebaseUserRecord = await admin.auth().getUserByEmail(primaryEmail);
                } catch (fbError) {
                    if (fbError.code === 'auth/user-not-found') {
                        const tempPassword = Math.random().toString(36).slice(-8); // Generate temporary password
                        const userRecord = await admin.auth().createUser({
                            email: primaryEmail,
                            password: tempPassword,
                            emailVerified: false,
                            displayName: contactPersonName,
                        });
                        firebaseUserRecord = userRecord;

                        // Create the corresponding Mongoose User document
                        const customerUserMongoose = new User({
                            firebaseUid: userRecord.uid,
                            email: primaryEmail,
                            role: 'customer',
                            company: companyId,
                            contactPersonName: contactPersonName,
                            customer: newCustomer._id, // Link to the newly created Mongoose Customer
                        });
                        await customerUserMongoose.save({ session });

                        // --- NEW: Call sendTemplatedEmail for 'welcome_email' ---
                        sendTemplatedEmail(
                            'welcome_email', // templateType
                            companyId,       // companyId
                            primaryEmail,    // recipientEmail
                            {                // placeholderData
                                customerName: contactPersonName,
                                companyName: companyNameFromUser, // Use company name from req.user
                                loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-portal`,
                                temporaryPassword: tempPassword // Pass temporary password for template
                            },
                            'Customer Creation' // triggerSource
                        );
                        // --- END NEW ---

                        // REMOVED: Old direct email sending logic for login details
                        /*
                        const loginSubject = 'Welcome! Your ServiceOS Customer Portal Login Details';
                        const loginText = `Dear ${contactPersonName},\n\n` +
                            `Your account for the ServiceOS Customer Portal has been created. You can access it here: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-portal\n\n` +
                            `Your email: ${primaryEmail}\n` +
                            `Your temporary password: ${tempPassword}\n\n` +
                            `Please log in using these details and consider changing your password immediately for security.\n\n` +
                            `The ServiceOS Team`;
                        const loginHtml = `<p>Dear <strong>${contactPersonName}</strong>,</p>` +
                            `<p>Your account for the ServiceOS Customer Portal has been created. You can access it here: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-portal">ServiceOS Customer Portal</a></p>` +
                            `<p>Your email: <strong>${primaryEmail}</strong></p>` +
                            `<p>Your temporary password: <strong>${tempPassword}</strong></p>` +
                            `<p>Please log in using these details and consider changing your password immediately for security.</p>` +
                            `<p>The ServiceOS Team</p>`;
                        await sendEmail(primaryEmail, loginSubject, loginText, loginHtml);
                        */
                    }
                }
            } catch (fbAdminError) {
                console.error(`[createCustomer] Firebase Admin SDK error during customer user creation/email:`, fbAdminError);
            }
        } else {
            console.warn(`[createCustomer] No primary email found for new customer. Skipping Firebase user creation and welcome email.`);
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
        const { companyName, contactPersonName, email, phone, address, serviceAddresses, salesPersonName, commissionEarned, customerType, industry } = req.body;

        const customer = await Customer.findOne({ _id: customerId, company: companyId });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found or not authorized.' });
        }

        // Apply updates
        customer.companyName = companyName || customer.companyName;
        customer.contactPersonName = contactPersonName || customer.contactPersonName;
        customer.email = email || customer.email;
        customer.phone = phone || customer.phone;
        customer.address = address || customer.address;
        customer.serviceAddresses = serviceAddresses || customer.serviceAddresses;
        customer.salesPersonName = salesPersonName || customer.salesPersonName;
        customer.commissionEarned = commissionEarned || customer.commissionEarned;
        customer.customerType = customerType || customer.customerType;
        customer.industry = industry || customer.industry;
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
exports.bulkUploadCustomers = async (req, res) => {
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
                        // Only update emails/phones if new data provided or they need to be formatted correctly
                        email: formattedEmails, // Overwrite with provided primary email
                        phone: formattedPhones,
                        address: customerData.address || existingCustomer.address,
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
                            // Log, but don't abort entire bulk upload for one Firebase error
                            results.errors.push(`Firebase user creation failed for ${newCustomer.email[0].email}: ${fbError.Error.message}`); // Fix: access error.message
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
    bulkUploadCustomers: exports.bulkUploadCustomers,
};