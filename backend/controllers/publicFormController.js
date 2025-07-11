const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Form = require('../models/Form'); // Assuming your Form model path is correct
const Lead = require('../models/Lead'); // Assuming your Lead model path is correct
const Submission = require('../models/Submission'); // Assuming your Submission model path is correct
const User = require('../models/User'); // Assuming your User model path is correct (for admin details)
const sendEmail = require('../utils/emailService'); // Assuming your email service path is correct

// Helper function to check if a value is empty
const isValueEmpty = (value) => {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
};

// @desc    Get a form by ID for public viewing
// @route   GET /api/public/forms/:id
// @access  Public
const getPublicFormById = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id).select('-__v -adminId');

    if (!form) {
        return res.status(404).json({ message: 'Form not found.' });
    }

    res.status(200).json(form);
});

// @desc    Get a form by its purpose for public viewing
// @route   GET /api/public/forms/purpose/:purpose
// @access  Public
const getPublicFormByPurpose = asyncHandler(async (req, res) => {
    const { purpose } = req.params;
    if (!purpose) {
        return res.status(400).json({ message: 'Form purpose is required.' });
    }
    const form = await Form.findOne({ purpose: purpose, isActive: true }).select('-__v -adminId');
    if (!form) {
        return res.status(404).json({ message: `No active form found for purpose: '${purpose}'.` });
    }
    res.status(200).json(form);
});

// @desc    Handle public form submissions
// @route   POST /api/public/forms/:id/submit
// @access  Public
const submitPublicForm = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const formId = req.params.id;
        // CORRECTED: Frontend now sends a flat object directly in req.body
        // Use req.body directly as the submitted data
        const submittedData = req.body; 
        
        // Log the received payload for debugging
        console.log('Backend DEBUG: Received raw submission payload (req.body):', submittedData);

        if (!submittedData || typeof submittedData !== 'object' || Object.keys(submittedData).length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid submission data format. Expected a flat object with form field values.' });
        }

        const form = await Form.findById(formId).session(session);
        if (!form) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Form not found.' });
        }

        const leadData = {};
        // Directly extract from submittedData, assuming keys match CRM field names
        // based on your updated FormRenderer
        const rawContactName = submittedData.contactPersonName;
        const rawContactEmail = submittedData.email;
        const rawContactPhone = submittedData.phone;
        const rawCompanyName = submittedData.companyName || ''; // Assuming optional companyName
        const rawAddress = submittedData.address; // Assuming address is sent as an object

        // For other fields, collect them into additionalFieldsForNotes
        const additionalFieldsForNotes = {};
        const formSubmittedValues = {}; // Store all submitted values for the Submission model

        for (const key in submittedData) {
            // Populate formSubmittedValues with all incoming fields for the Submission model
            formSubmittedValues[key] = submittedData[key];

            // Determine if it's a CRM mapped field or an additional field
            // Iterate through the form's schema to find the original label for non-mapped fields
            const fieldDef = form.formSchema.flatMap(row => row.columns.flatMap(col => col.fields))
                                .find(f => {
                                    // Handle both dynamically named fields and mapped CRM fields
                                    if (f.mapping) {
                                        return f.mapping.split('.').pop() === key;
                                    }
                                    return f.name === key; // Fallback for fields not directly mapped
                                });

            if (fieldDef && fieldDef.mapping) {
                // Already handled contactPersonName, email, phone explicitly.
                // Handle other CRM mapped fields directly here if they exist.
                // Example: If you add 'lead.notes' mapping, it would come as 'notes' in submittedData
                const mappingProp = fieldDef.mapping.split('.').pop();
                if (mappingProp !== 'contactPersonName' && mappingProp !== 'email' && mappingProp !== 'phone') {
                    leadData[mappingProp] = submittedData[key];
                }
            } else if (key !== 'purpose' && key !== 'associatedLeadId' && !['contactPersonName', 'email', 'phone', 'companyName', 'address'].includes(key)) {
                // Collect other non-CRM mapped fields for notes
                additionalFieldsForNotes[key] = submittedData[key];
            }
        }

        // Apply extracted main lead data
        leadData.contactPersonName = rawContactName;
        leadData.companyName = rawCompanyName;
        if (rawAddress) {
            leadData.address = rawAddress;
        }

        const emailArray = rawContactEmail ? [{ email: rawContactEmail, label: 'Primary', isMaster: true }] : [];
        const phoneArray = rawContactPhone ? [{ number: rawContactPhone, label: 'Primary', isMaster: true }] : [];
        
        // Log the processed lead data before validation
        console.log('Backend DEBUG: Processed data for Lead Model:', {
            contactPersonName: leadData.contactPersonName,
            email: emailArray,
            phone: phoneArray,
            companyName: leadData.companyName,
            address: leadData.address,
            additionalFieldsForNotes: additionalFieldsForNotes
        });

        // Backend side validation check for primary fields
        const validationErrors = [];
        if (isValueEmpty(leadData.contactPersonName)) {
            validationErrors.push('Contact Name is required.');
        }
        if (emailArray.length === 0 || isValueEmpty(emailArray[0].email)) {
            validationErrors.push('A valid Primary Email address is required.');
        }
        // ADDED: Explicit check for phone number presence if it's strictly required
        if (phoneArray.length === 0 || isValueEmpty(phoneArray[0].number)) {
             validationErrors.push('A valid Primary Phone number is required.');
        }
        // You can add more specific phone number regex validation here if your LeadSchema doesn't have it
        // and you need a custom one for form submissions only.

        if (validationErrors.length > 0) {
            console.log('Backend DEBUG: Custom Validation Failed:', validationErrors);
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Validation Failed', errors: validationErrors });
        }
        
        const adminUser = await User.findById(form.adminId).session(session);
        if (!adminUser || !adminUser.company) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({ message: 'Form is not associated with a valid company.' });
        }
        const companyId = adminUser.company;

        let notesContent = `--- Form Submission: ${form.name} ---\nSubmitted: ${new Date().toLocaleString()}\n`;
        notesContent += `Contact Name: ${leadData.contactPersonName || 'N/A'}\n`;
        notesContent += `Email: ${emailArray[0]?.email || 'N/A'}\n`;
        notesContent += `Phone: ${phoneArray[0]?.number || 'N/A'}\n`;
        notesContent += `Company: ${leadData.companyName || 'N/A'}\n`;

        if (leadData.address && leadData.address.fullAddress) {
            notesContent += `Address: ${leadData.address.fullAddress}\n`;
            // Or if you prefer structured address:
            // notesContent += `Address: ${leadData.address.street}, ${leadData.address.city}, ${leadData.address.postcode}\n`;
        } else if (leadData.address && Object.keys(leadData.address).length > 0) {
             notesContent += `Address (Partial): ${JSON.stringify(leadData.address)}\n`;
        }

        // Add additional fields to notes, trying to use original labels from form schema
        for (const [dynamicName, value] of Object.entries(additionalFieldsForNotes)) {
            const originalFieldDef = form.formSchema.flatMap(row => row.columns.flatMap(col => col.fields)).find(f => f.name === dynamicName); // Find by field.name now
            const displayLabel = originalFieldDef ? originalFieldDef.label : dynamicName;
            notesContent += `${displayLabel}: ${value}\n`;
        }
        
        const newLead = new Lead({
            company: companyId,
            contactPersonName: leadData.contactPersonName,
            companyName: leadData.companyName, // Use the processed companyName
            email: emailArray,
            phone: phoneArray,
            leadSource: 'Website Quote Form',
            leadStatus: 'New Quote Request',
            notes: notesContent
        });
        
        // This is the point where Mongoose Schema validation occurs
        await newLead.save({ session });
        console.log('Backend DEBUG: Lead saved successfully with ID:', newLead._id);

        const newSubmission = new Submission({
            form: form._id,
            company: companyId,
            submittedBy: emailArray[0]?.email || 'N/A',
            data: formSubmittedValues, // Save the full submitted data for the submission record
            purpose: form.purpose,
            lead: newLead._id
        });
        await newSubmission.save({ session });
        console.log('Backend DEBUG: Submission saved successfully with ID:', newSubmission._id);
        
        if (adminUser && adminUser.email) {
            const subject = `New Quote Request from ${leadData.contactPersonName || 'A new client'}`;
            let emailBody = `A new quote request has been submitted through your public form (${form.name}).\n\n` +
                            `Contact: ${leadData.contactPersonName || 'N/A'}\n` +
                            `Email: ${emailArray[0]?.email || 'N/A'}\n` +
                            `Phone: ${phoneArray[0]?.number || 'N/A'}\n` +
                            `Company: ${leadData.companyName || 'N/A'}\n\n` +
                            `--- Other Form Data ---\n`;
            
            // Re-iterate over submittedData to ensure all non-CRM mapped fields are in the email
            for (const key in submittedData) {
                // Skip the CRM main fields and purpose/associatedLeadId as they are handled above
                if (['contactPersonName', 'email', 'phone', 'companyName', 'address', 'purpose', 'associatedLeadId'].includes(key)) {
                    continue;
                }
                const originalFieldDef = form.formSchema.flatMap(row => row.columns.flatMap(col => col.fields)).find(f => f.name === key);
                const displayLabel = originalFieldDef ? originalFieldDef.label : key;
                emailBody += `${displayLabel}: ${submittedData[key]}\n`;
            }

            await sendEmail(adminUser.email, subject, emailBody, `<pre>${emailBody}</pre>`);
            console.log('Backend DEBUG: Notification email sent to admin.');
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: 'Your quote request has been received!', leadId: newLead._id });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Backend DEBUG: Error in submitPublicForm:", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => {
                // Attempt to provide more user-friendly messages for subdocument validation
                if (err.path && (err.path.includes('email') || err.path.includes('phone'))) {
                    if (err.path.includes('.email')) return `Primary Email: ${err.message}`;
                    if (err.path.includes('.number')) return `Primary Phone: ${err.message}`;
                }
                return err.message;
            });
            return res.status(400).json({ message: `Validation Failed`, errors: errors.join(', ') });
        }
        res.status(500).json({ message: error.message || 'An internal server error occurred.' });
    }
});

// IMPORTANT: module.exports MUST be at the very end of the file
// after all functions have been defined.
module.exports = {
    getPublicFormById,
    getPublicFormByPurpose,
    submitPublicForm,
};