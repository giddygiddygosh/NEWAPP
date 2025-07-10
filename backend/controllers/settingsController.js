// backend/controllers/settingsController.js

const CompanySetting = require('../models/CompanySetting');
const Company = require('../models/Company'); // Assuming you have a Company model for company.name, address, etc.

/**
 * @desc    Get company settings
 * @route   GET /api/settings
 * @access  Private (admin, manager, staff)
 */
exports.getCompanySettings = async (req, res) => {
    try {
        // Assuming req.user.company._id is available from your authentication middleware
        const companyId = req.user.company._id; 

        const settings = await CompanySetting.findOne({ company: companyId })
            .populate('company'); // Populate the company details if needed

        if (!settings) {
            // If no settings exist for the company, return a default or 404
            return res.status(404).json({ 
                success: false, 
                message: 'Company settings not found. Please create them first.' 
            });
        }

        res.status(200).json({
            success: true,
            settings: settings
        });

    } catch (error) {
        console.error('Error in getCompanySettings:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to fetch company settings.' });
    }
};

/**
 * @desc    Update company settings
 * @route   PUT /api/settings
 * @access  Private (admin, manager)
 */
exports.updateCompanySettings = async (req, res) => {
    // --- START DEBUG LOGGING ---
    console.log('--- BACKEND RECEIVED REQ.BODY (Company Settings) ---');
    console.log('Original req.body:', req.body); // Log full body for inspection
    console.log('Company Name (from req.body):', req.body.name); // Specific check for company name
    console.log('Global Invoice Email Enabled (from req.body):', req.body.emailAutomation?.invoice_email?.enabled); // Specific check for global email setting
    console.log('--- END BACKEND REQ.BODY ---');
    // --- END DEBUG LOGGING ---

    try {
        const {
            // CompanySetting fields (direct properties)
            companyLogoUrl,
            defaultFormName,
            backgroundColor,
            primaryColor,
            borderColor,
            labelColor,
            inputButtonBorderRadius,
            
            // Nested CompanySetting sub-documents
            defaultCurrency,
            invoiceSettings,
            emailAutomation, // This is correctly destructured

            // Fields that belong to the 'Company' model (passed as top-level fields from frontend)
            name,    // This is 'companyName' from frontend
            address, // This is 'companyAddress' from frontend
            phone,   // This is 'companyPhone' from frontend
            email,   // This is 'companyEmail' from frontend
            website, // This is 'companyWebsite' from frontend
            taxId    // This is 'companyTaxId' from frontend
        } = req.body;

        const companyId = req.user.company._id; // Get company from authenticated user

        // 1. Update the Company model
        // This targets fields directly on the Company model or its nested 'settings' subdocument
        const updatedCompanyDoc = await Company.findByIdAndUpdate(companyId, {
            name: name, // Update the company's name directly
            'settings.address': address, // Dot notation for nested fields on Company model
            'settings.phone': phone,
            'settings.email': email,
            'settings.website': website,
            'settings.taxId': taxId,
        }, { new: true, runValidators: true, upsert: false }); // `new: true` returns updated doc, `upsert: false` means it must exist

        if (!updatedCompanyDoc) {
            // If company itself isn't found/updated, something is wrong.
            return res.status(404).json({ success: false, message: 'Associated company not found or could not be updated.' });
        }

        // 2. Update the CompanySetting model
        // This targets the CompanySetting document itself.
        const updatedCompanySetting = await CompanySetting.findOneAndUpdate(
            { company: companyId }, // Find the CompanySetting document linked to this company
            {
                // Direct properties of CompanySetting
                companyLogoUrl,
                defaultFormName,
                backgroundColor,
                primaryColor,
                borderColor,
                labelColor,
                inputButtonBorderRadius,

                // Nested sub-documents of CompanySetting
                defaultCurrency,
                invoiceSettings,
                emailAutomation, // Pass the full emailAutomation object from req.body
            },
            {
                new: true,         // Return the updated document
                upsert: true,      // Create the document if it doesn't exist
                runValidators: true // Run schema validators on the update
            }
        ).populate('company'); // Populate company to return full company details in response

        if (!updatedCompanySetting) {
            return res.status(404).json({ success: false, message: 'Company settings document not found or could not be updated.' });
        }

        // --- START DEBUG LOGGING: What Mongoose returns after saving ---
        console.log('--- BACKEND Mongoose CompanySetting after update ---');
        console.log('Company Name (from DB object):', updatedCompanySetting.company?.name); // Now accessed from populated company
        console.log('Global Invoice Email Enabled (from DB object):', updatedCompanySetting.emailAutomation?.invoice_email?.enabled);
        console.log('Full saved CompanySetting object:', updatedCompanySetting); // Log full object
        console.log('--- END BACKEND Mongoose CompanySetting ---');
        // --- END DEBUG LOGGING ---


        res.status(200).json({
            success: true,
            settings: updatedCompanySetting, // Send the full updated settings object back
            message: 'Company settings updated successfully!'
        });

    } catch (error) {
        console.error('--- BACKEND ERROR during Company Settings update ---');
        console.error('Error object:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.errors) { // Mongoose validation errors
            console.error('Validation errors:', Object.values(error.errors).map(err => err.message));
        }
        console.error('--- END BACKEND ERROR ---');

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: error.message || 'Failed to update company settings.' });
    }
};

// All other exports like getCustomers, createCustomer, updateCustomer, deleteCustomer, etc.
module.exports = {
    createCustomer: exports.createCustomer, // Ensure all original exports are present
    getCustomers: exports.getCustomers,
    getCustomerById: exports.getCustomerById,
    updateCustomer: exports.updateCustomer,
    deleteCustomer: exports.deleteCustomer,
    bulkUploadCustomers: exports.bulkUploadCustomers,
    getCompanySettings: exports.getCompanySettings, // Ensure this is exported
    updateCompanySettings: exports.updateCompanySettings, // Ensure this is exported
};