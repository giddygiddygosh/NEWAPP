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

// @desc    Get a form by ID for public viewing
// @route   GET /api/public/forms/:id
// @access  Public
const getPublicFormById = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id).select('-__v -adminId');

    if (!form) {
        return res.status(404).json({ message: 'Form not found.' });
    }

    res.status(200).json(form);
});

// @desc    Get a form by its purpose for public viewing
// @route   GET /api/public/forms/purpose/:purpose
// @access  Public
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

// @desc    Handle public form submissions
// @route   POST /api/public/forms/:id/submit
// @access  Public
const submitPublicForm = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const formId = req.params.id;
        const submittedFields = req.body.formData; 
        
        if (!submittedFields || !Array.isArray(submittedFields)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid submission data format. Expected an array of form fields under "formData".' });
        }

        const form = await Form.findById(formId).session(session);
        if (!form) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Form not found.' });
        }

        const leadData = {};
        let rawContactEmail = '';
        let rawContactPhone = '';
        const additionalFieldsForNotes = {};
        const formSubmittedValues = {}; 

        submittedFields.forEach(field => {
            formSubmittedValues[field.name] = field.value;
            
            // Log for debugging what the backend sees
            // console.log(`Processing field: name='${field.name}', value='${field.value}', mapping='${field.mapping}'`);

            if (field.mapping) {
                const mappingPath = field.mapping.split('.');
                const parent = mappingPath[0];
                const property = mappingPath[1];

                if (parent === 'lead') {
                    if (property === 'email') {
                        rawContactEmail = field.value;
                    } else if (property === 'phone') {
                        rawContactPhone = field.value;
                    } else {
                        leadData[property] = field.value;
                    }
                }
            } else {
                additionalFieldsForNotes[field.name] = field.value;
            }
        });
        
        const emailArray = rawContactEmail ? [{ email: rawContactEmail, label: 'Primary', isMaster: true }] : [];
        const phoneArray = rawContactPhone ? [{ number: rawContactPhone, label: 'Primary', isMaster: true }] : [];
        
        if (isValueEmpty(leadData.contactPersonName) || emailArray.length === 0 || isValueEmpty(emailArray[0].email)) {
            // Log values that caused validation failure for debugging
            // console.log('Validation failed details:', {
            //     contactPersonName: leadData.contactPersonName,
            //     emailArray: emailArray,
            //     rawContactEmail: rawContactEmail
            // });
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Validation failed: Contact Name and a valid Primary Email address are required.' });
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

        if (leadData.address) {
            notesContent += `Address: ${JSON.stringify(leadData.address)}\n`;
        }

        for (const [dynamicName, value] of Object.entries(additionalFieldsForNotes)) {
            const originalFieldDef = form.formSchema.flatMap(row => row.columns.flatMap(col => col.fields)).find(f => {
                let currentFieldDynamicName;
                if (f.fieldType && f.fieldType.startsWith('crm_')) {
                    currentFieldDynamicName = f.mapping.split('.')[1]; 
                } else if (f.fieldType === 'task_item') {
                    currentFieldDynamicName = f.name;
                } else {
                    currentFieldDynamicName = f.type.toLowerCase().replace(' ', '_') + '_' + f.id.slice(0, 4);
                }
                return currentFieldDynamicName === dynamicName;
            });
            const displayLabel = originalFieldDef ? originalFieldDef.label : dynamicName;
            notesContent += `${displayLabel}: ${value}\n`;
        }
        
        const newLead = new Lead({
            company: companyId,
            contactPersonName: leadData.contactPersonName,
            companyName: leadData.companyName || '',
            email: emailArray, 
            phone: phoneArray, 
            leadSource: 'Website Quote Form',
            leadStatus: 'New Quote Request',
            notes: notesContent
        });
        await newLead.save({ session });

        const newSubmission = new Submission({
            form: form._id,
            company: companyId,
            submittedBy: emailArray[0]?.email || 'N/A',
            data: formSubmittedValues, 
            purpose: form.purpose,
            lead: newLead._id
        });
        await newSubmission.save({ session });
        
        if (adminUser && adminUser.email) {
            const subject = `New Quote Request from ${leadData.contactPersonName}`;
            const emailBody = `A new quote request has been submitted through your public form (${form.name}).\n\n` +
                              `Contact: ${leadData.contactPersonName || 'N/A'}\n` +
                              `Email: ${emailArray[0]?.email || 'N/A'}\n` +
                              `Phone: ${phoneArray[0]?.number || 'N/A'}\n` +
                              `Company: ${leadData.companyName || 'N/A'}\n\n` +
                              `--- Other Form Data ---\n`;
            
            for (const [key, value] of Object.entries(additionalFieldsForNotes)) {
                const originalFieldDef = form.formSchema.flatMap(row => row.columns.flatMap(col => col.fields)).find(f => {
                    let currentFieldDynamicName;
                    if (f.fieldType && f.fieldType.startsWith('crm_')) {
                        currentFieldDynamicName = f.mapping.split('.')[1]; 
                    } else if (f.fieldType === 'task_item') {
                        currentFieldDynamicName = f.name;
                    } else {
                        currentFieldDynamicName = f.type.toLowerCase().replace(' ', '_') + '_' + f.id.slice(0, 4);
                    }
                    return currentFieldDynamicName === key;
                });
                const displayLabel = originalFieldDef ? originalFieldDef.label : key;
                emailBody += `${displayLabel}: ${value}\n`;
            }
            
            await sendEmail(adminUser.email, subject, emailBody, `<pre>${emailBody}</pre>`); 
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: 'Your quote request has been received!', leadId: newLead._id });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error in submitPublicForm:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Submission Error: ${error.message}`, errors: error.errors });
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