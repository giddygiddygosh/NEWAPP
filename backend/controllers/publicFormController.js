// backend/controllers/publicFormController.js

const Form = require('../models/Form');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Submission = require('../models/Submission'); // NEW: Import Submission model
const User = require('../models/User');
const sendEmail = require('../utils/emailService');
const mongoose = require('mongoose');
const admin = require('firebase-admin');

const getMasterEmail = (emailsArray) => {
    if (!emailsArray || !Array.isArray(emailsArray) || emailsArray.length === 0) {
        return null;
    }
    const masterEmailObj = emailsArray.find(e => e.isMaster);
    if (masterEmailObj && masterEmailObj.email) return masterEmailObj.email;
    if (emailsArray[0] && emailsArray[0].email) return emailsArray[0].email;
    return null;
};

const extractAndValidateCrmData = (rawFormData, formSchema, existingCrmEntity = {}) => {
    const crmData = {
        companyName: existingCrmEntity.companyName || '',
        contactPersonName: existingCrmEntity.contactPersonName || '',
        email: existingCrmEntity.email || [],
        phone: existingCrmEntity.phone || [],
        address: existingCrmEntity.address || {},
        serviceAddresses: existingCrmEntity.serviceAddresses || [],
        customerType: existingCrmEntity.customerType || '',
        industry: existingCrmEntity.industry || '',
    };
    const errors = {};

    formSchema.forEach(row => {
        row.columns.forEach(col => {
            col.fields.forEach(field => {
                const value = rawFormData[field.name];
                const isFieldPresentAndFilled = (val) => val && (typeof val === 'string' ? val.trim() !== '' : true);
                const isAddressEmpty = (addr) => addr && Object.values(addr).every(v => !v || v.toString().trim() === '');


                if (field.mapping) {
                    const [entityType, propName] = field.mapping.split('.');

                    if (entityType === 'customer' || entityType === 'lead') {
                        if (propName === 'contactPersonName') {
                            crmData.contactPersonName = value;
                            if (field.required && !isFieldPresentAndFilled(value)) errors.contactPersonName = `${field.label || 'Contact Person Name'} is required.`;
                        } else if (propName === 'email') {
                            if (isFieldPresentAndFilled(value)) {
                                if (!/.+@.+\..+/.test(value)) {
                                    errors.email = 'Invalid email format.';
                                }
                                const isAlreadyInList = crmData.email.some(e => e.email === value);
                                if (!isAlreadyInList) {
                                    const isMasterEmailPresent = crmData.email.some(e => e.isMaster);
                                    crmData.email.push({ email: value, label: field.label || 'Form', isMaster: !isMasterEmailPresent });
                                }
                            } else if (field.required) {
                                errors.email = `${field.label || 'Email'} is required.`;
                            }
                        } else if (propName === 'phone') {
                            if (isFieldPresentAndFilled(value)) {
                                const isAlreadyInList = crmData.phone.some(p => p.number === value);
                                if (!isAlreadyInList) {
                                    const isMasterPhonePresent = crmData.phone.some(p => p.isMaster);
                                    crmData.phone.push({ number: value, label: field.label || 'Form', isMaster: !isMasterPhonePresent });
                                }
                            } else if (field.required) {
                                errors.phone = `${field.label || 'Phone'} is required.`;
                            }
                        } else if (propName === 'companyName') {
                            crmData.companyName = value;
                            if (field.required && !isFieldPresentAndFilled(value)) errors.companyName = `${field.label || 'Company Name'} is required.`;
                        } else if (propName === 'address') {
                            if (isFieldPresentAndFilled(value) && !isAddressEmpty(value)) {
                                crmData.address = value;
                            } else if (field.required) {
                                errors.address = `${field.label || 'Address'} is required.`;
                            }
                        } else if (propName === 'customerType' && entityType === 'customer') {
                            crmData.customerType = value;
                            if (field.required && !isFieldPresentAndFilled(value)) errors.customerType = `${field.label || 'Customer Type'} is required.`;
                        } else if (propName === 'industry' && entityType === 'customer') {
                            crmData.industry = value;
                            if (field.required && !isFieldPresentAndFilled(value)) errors.industry = `${field.label || 'Industry'} is required.`;
                        }
                    } else if (field.mapping.startsWith('booking') || field.mapping.startsWith('quote')) {
                        // These fields are typically not directly mapped to the top-level crmData object here.
                        // Their validation should be handled by checking rawFormData for requiredness.
                    }
                }
            });
        });
    });

    if (crmData.email.length > 0 && crmData.email.filter(e => e.isMaster).length === 0) {
        crmData.email[0].isMaster = true;
    }
    if (crmData.phone.length > 0 && crmData.phone.filter(p => p.isMaster).length === 0) {
        crmData.phone[0].isMaster = true;
    }

    return { crmData, errors };
};


exports.getPublicFormById = async (req, res) => {
    try {
        const form = await Form.findById(req.params.id).select('-__v -company -createdBy');

        if (!form) {
            return res.status(404).json({ message: 'Form not found.' });
        }
        res.status(200).json(form);
    } catch (error) {
        console.error('Error in getPublicFormById:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.submitPublicForm = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const formId = req.params.id;
        const rawFormData = req.body.formData;
        const associatedLeadId = req.body.associatedLeadId;

        const form = await Form.findById(formId).session(session);
        if (!form) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Form not found.' });
        }

        const companyId = form.company;
        let customerSubmittedEmail = getMasterEmail(extractAndValidateCrmData(rawFormData, form.schema).crmData.email);

        const newSubmission = new Submission({
            form: form._id,
            company: companyId,
            submittedBy: customerSubmittedEmail,
            data: rawFormData,
            associatedLeadId: associatedLeadId || null,
        });

        let targetCustomer = null;
        let targetLead = null;
        let customerCreated = false;

        switch (form.purpose) {
            case 'customer_booking':
                console.log(`[Public Form] Processing Booking Form submission for form ID: ${formId}`);

                const { crmData: bookingCustomerData, errors: bookingErrors } = extractAndValidateCrmData(rawFormData, form.schema);
                customerSubmittedEmail = getMasterEmail(bookingCustomerData.email);

                form.schema.forEach(row => {
                    row.columns.forEach(col => {
                        col.fields.forEach(field => {
                            if (field.required && field.mapping && field.mapping.startsWith('booking')) {
                                if (!rawFormData[field.name] || (typeof rawFormData[field.name] === 'string' && rawFormData[field.name].trim() === '')) {
                                    bookingErrors[field.name] = `${field.label || field.name} is required for booking.`;
                                }
                            }
                        });
                    });
                });

                if (Object.keys(bookingErrors).length > 0) {
                    await session.abortTransaction();
                    session.endSession();
                    console.error('[Public Form] Booking form validation errors:', bookingErrors);
                    return res.status(400).json({ message: 'Missing or invalid information for booking.', errors: bookingErrors });
                }

                let existingCustomerForBooking = null;
                if (customerSubmittedEmail) {
                    existingCustomerForBooking = await Customer.findOne({ company: companyId, 'email.email': customerSubmittedEmail }).session(session);
                }

                if (existingCustomerForBooking) {
                    Object.assign(existingCustomerForBooking, bookingCustomerData);
                    await existingCustomerForBooking.save({ session });
                    targetCustomer = existingCustomerForBooking;
                    console.log(`[Public Form] Updated existing customer ${targetCustomer._id} from booking form.`);
                } else {
                    const newCustomer = new Customer({
                        ...bookingCustomerData,
                        company: companyId,
                        convertedFromLead: null,
                    });
                    await newCustomer.save({ session });
                    targetCustomer = newCustomer;
                    customerCreated = true;
                    console.log(`[Public Form] Created new customer ${targetCustomer._id} from booking form.`);
                }

                newSubmission.customer = targetCustomer._id;

                if (customerCreated && targetCustomer.email && targetCustomer.email.length > 0) {
                    try {
                        let firebaseUserRecord;
                        try {
                            firebaseUserRecord = await admin.auth().getUserByEmail(customerSubmittedEmail);
                        } catch (fbError) {
                            if (fbError.code === 'auth/user-not-found') {
                                const tempPassword = Math.random().toString(36).slice(-8);
                                const userRecord = await admin.auth().createUser({
                                    email: customerSubmittedEmail,
                                    password: tempPassword,
                                    emailVerified: false,
                                    displayName: targetCustomer.contactPersonName,
                                });
                                const customerUserMongoose = new User({
                                    firebaseUid: userRecord.uid,
                                    email: customerSubmittedEmail,
                                    role: 'customer',
                                    company: companyId,
                                    contactPersonName: targetCustomer.contactPersonName,
                                    customer: targetCustomer._id,
                                });
                                await customerUserMongoose.save({ session });

                                const loginSubject = 'Welcome! Your ServiceOS Customer Portal Login Details';
                                const loginText = `Dear ${targetCustomer.contactPersonName},\n\n` +
                                    `Your account for the ServiceOS Customer Portal has been created. You can access it here: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-portal\n\n` +
                                    `Your email: ${customerSubmittedEmail}\n` +
                                    `Your temporary password: ${tempPassword}\n\n` +
                                    `Please log in using these details and consider changing your password immediately for security.\n\n` +
                                    `The ServiceOS Team`;
                                const loginHtml = `<p>Dear <strong>${targetCustomer.contactPersonName}</strong>,</p>` +
                                    `<p>Your account for the ServiceOS Customer Portal has been created. You can access it here: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-portal">ServiceOS Customer Portal</a></p>` +
                                    `<p>Your email: <strong>${customerSubmittedEmail}</strong></p>` +
                                    `<p>Your temporary password: <strong>${tempPassword}</strong></p>` +
                                    `<p>Please log in using these details and consider changing your password immediately for security.</p>` +
                                    `<p>The ServiceOS Team</p>`;
                                await sendEmail(customerSubmittedEmail, loginSubject, loginText, loginHtml);
                            }
                        }
                    } catch (fbAdminError) {
                        console.error(`[Public Form - Booking] Firebase Admin SDK error during customer user creation/email:`, fbAdminError);
                    }
                }
                console.log(`[Public Form] Booking functionality (future) for customer ${targetCustomer._id}. Raw booking data:`, rawFormData);
                break;

            case 'customer_quote':
                console.log(`[Public Form] Processing Quote Request submission for form ID: ${formId}`);

                const { crmData: quoteLeadData, errors: quoteErrors } = extractAndValidateCrmData(rawFormData, form.schema);
                customerSubmittedEmail = getMasterEmail(quoteLeadData.email);

                form.schema.forEach(row => {
                    row.columns.forEach(col => {
                        col.fields.forEach(field => {
                            if (field.required && field.mapping && field.mapping.startsWith('quote')) {
                                if (!rawFormData[field.name] || (typeof rawFormData[field.name] === 'string' && rawFormData[field.name].trim() === '')) {
                                    quoteErrors[field.name] = `${field.label || field.name} is required for quote.`;
                                }
                            }
                        });
                    });
                });

                if (Object.keys(quoteErrors).length > 0) {
                    await session.abortTransaction();
                    session.endSession();
                    console.error('[Public Form] Quote form validation errors:', quoteErrors);
                    return res.status(400).json({ message: 'Missing or invalid contact information for quote.', errors: quoteErrors });
                }

                if (associatedLeadId) {
                    targetLead = await Lead.findOne({ _id: associatedLeadId, company: companyId }).session(session);
                    if (!targetLead) {
                        console.warn(`[Public Form] Associated Lead ID ${associatedLeadId} not found or not belonging to company ${companyId} for quote form submission. Creating new lead.`);
                    }
                }

                if (targetLead) {
                    Object.assign(targetLead, {
                        companyName: quoteLeadData.companyName || targetLead.companyName,
                        contactPersonName: quoteLeadData.contactPersonName || targetLead.contactPersonName,
                        email: quoteLeadData.email.length > 0 ? quoteLeadData.email : targetLead.email,
                        phone: quoteLeadData.phone.length > 0 ? quoteLeadData.phone : targetLead.phone,
                        address: Object.values(quoteLeadData.address || {}).some(v => v) ? quoteLeadData.address : targetLead.address,
                        leadStatus: 'Quoted',
                        notes: (targetLead.notes || '') + `\n\n--- Quote Form Submission (${new Date().toLocaleString()}) ---\n${JSON.stringify(rawFormData, null, 2)}`,
                        updatedAt: new Date()
                    });
                    await targetLead.save({ session });
                    console.log(`[Public Form] Updated existing lead ${targetLead._id} from quote form.`);
                } else {
                    const newLead = new Lead({
                        company: companyId,
                        companyName: quoteLeadData.companyName,
                        contactPersonName: quoteLeadData.contactPersonName,
                        email: quoteLeadData.email,
                        phone: quoteLeadData.phone,
                        address: quoteLeadData.address,
                        leadSource: 'Quote Form Submission',
                        leadStatus: 'Quoted',
                        notes: `--- Quote Form Submission (${new Date().toLocaleString()}) ---\n${JSON.stringify(rawFormData, null, 2)}`,
                        createdBy: null,
                    });
                    await newLead.save({ session });
                    targetLead = newLead;
                    console.log(`[Public Form] Created new lead ${targetLead._id} from quote form.`);
                }

                newSubmission.lead = targetLead._id;

                const notificationSubject = `New Quote Request: ${quoteLeadData.contactPersonName || 'Unknown Contact'}`;
                const notificationText = `A new quote request has been submitted through your form builder.\n\n` +
                                         `Form: ${form.name}\n` +
                                         `Contact: ${quoteLeadData.contactPersonName}\n` +
                                         `Email: ${getMasterEmail(quoteLeadData.email) || 'N/A'}\n` +
                                         `Phone: ${getMasterEmail(quoteLeadData.phone) || 'N/A'}\n` +
                                         `Company: ${quoteLeadData.companyName || 'N/A'}\n` +
                                         `View Lead: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/leads/${targetLead._id}\n\n` +
                                         `Raw Data:\n${JSON.stringify(rawFormData, null, 2)}`;
                const notificationHtml = `<p>A new quote request has been submitted through your form builder.</p>` +
                                         `<p><strong>Form:</strong> ${form.name}</p>` +
                                         `<p><strong>Contact:</strong> ${quoteLeadData.contactPersonName}</p>` +
                                         `<p><strong>Email:</strong> ${getMasterEmail(quoteLeadData.email) || 'N/A'}</p>` +
                                         `<p><strong>Phone:</strong> ${getMasterEmail(quoteLeadData.phone) || 'N/A'}</p>` +
                                         `<p><strong>Company:</strong> ${quoteLeadData.companyName || 'N/A'}</p>` +
                                         `<p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/leads/${targetLead._id}">View Lead in CRM</a></p>` +
                                         `<pre><code>${JSON.stringify(rawFormData, null, 2)}</code></pre>`;

                const adminCompanyUser = await User.findOne({ company: companyId, role: 'admin' }).session(session);
                if (adminCompanyUser && adminCompanyUser.email) {
                    await sendEmail(adminCompanyUser.email, notificationSubject, notificationText, notificationHtml);
                } else {
                    console.warn(`[Public Form - Quote] No admin user email found for company ${companyId} to send quote notification.`);
                }

                break;

            case 'reminder_task_list':
                console.log(`[Public Form] Processing Reminder Task List submission for form ID: ${formId}`);
                break;

            case 'general':
            default:
                console.log(`[Public Form] Processing General Form submission for form ID: ${formId}`);
                // For general forms, validate required fields defined in form builder first
                const { crmData: generalData, errors: generalErrors } = extractAndValidateCrmData(rawFormData, form.schema);
                customerSubmittedEmail = getMasterEmail(generalData.email); // Extract email for 'submittedBy' and confirmation email

                // If general form has any errors from extractAndValidateCrmData, return 400
                if (Object.keys(generalErrors).length > 0) {
                    await session.abortTransaction();
                    session.endSession();
                    console.error('[Public Form] General form validation errors:', generalErrors);
                    return res.status(400).json({ message: 'Missing or invalid data for general form.', errors: generalErrors });
                }
                // For general forms, no CRM entity creation, just save submission
                break;
        }

        // Save the submission record at the end of the transaction
        await newSubmission.save({ session });


        // Send confirmation email to submitter (if email is provided in form data)
        if (customerSubmittedEmail) {
            const confirmationSubject = `Thank you for your submission to ${form.name}`;
            const confirmationText = `Dear ${customerSubmittedEmail},\n\nThank you for submitting our form "${form.name}". We have received your information and will get back to you shortly.\n\nBest regards,\n\nThe ServiceOS Team`;
            const confirmationHtml = `<p>Dear ${customerSubmittedEmail},</p><p>Thank you for submitting our form "<strong>${form.name}</strong>". We have received your information and will get back to you shortly.</p><p>Best regards,</p><p>The ServiceOS Team</p>`;
            await sendEmail(customerSubmittedEmail, confirmationSubject, confirmationText, confirmationHtml);
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Form submitted successfully!' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error submitting public form:', error);
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: `Submission failed: ${error.message}`, errors: errors });
        }
        res.status(500).json({ message: 'Failed to submit form', error: error.message });
    }
};