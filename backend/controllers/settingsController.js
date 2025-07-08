// backend/controllers/settingsController.js

const asyncHandler = require('express-async-handler');
const CompanySetting = require('../models/CompanySetting');
const Company = require('../models/Company'); // Ensure Company model is imported if not already

/**
 * @desc Get company settings for the authenticated company
 * @route GET /api/settings
 * @access Private (Admin, Manager, Staff)
 */
const getCompanySettings = asyncHandler(async (req, res) => {
    const companyId = req.user.company;

    // FIX: Add .populate('company', 'name appId') to fetch the company details
    const settings = await CompanySetting.findOne({ company: companyId })
                                         .populate('company', 'name appId'); // <--- ADDED THIS LINE

    if (!settings) {
        // If no settings exist for the company, you might want to create default ones
        // or return a 404/empty response depending on your app's logic.
        // For now, let's return a default or 404.
        res.status(404);
        throw new Error('Company settings not found.');
    }

    res.status(200).json(settings); // The 'settings' object sent here will now have 'company' populated
});

/**
 * @desc Update company settings for the authenticated company
 * @route PUT /api/settings
 * @access Private (Admin, Manager)
 */
const updateCompanySettings = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const {
        companyLogoUrl,
        defaultFormName,
        backgroundColor,
        primaryColor,
        borderColor,
        labelColor,
        inputButtonBorderRadius,
        defaultCurrency,
        emailAutomation,
        // These fields are for the Company model, not CompanySetting directly
        name, // This is the companyName from frontend payload
        address, // This is companyAddress from frontend payload
        phone, // This is companyPhone from frontend payload
        email, // This is companyEmail from frontend payload
        website, // This is companyWebsite from frontend payload
        taxId // This is companyTaxId from frontend payload
    } = req.body;

    // Find the CompanySetting document
    let settings = await CompanySetting.findOne({ company: companyId });

    if (!settings) {
        // If settings don't exist, create them (this path is less common for updates)
        settings = await CompanySetting.create({
            company: companyId,
            companyLogoUrl,
            defaultFormName,
            backgroundColor,
            primaryColor,
            borderColor,
            labelColor,
            inputButtonBorderRadius,
            defaultCurrency,
            emailAutomation
        });
    }

    // Update CompanySetting fields
    settings.companyLogoUrl = companyLogoUrl ?? settings.companyLogoUrl;
    settings.defaultFormName = defaultFormName ?? settings.defaultFormName;
    settings.backgroundColor = backgroundColor ?? settings.backgroundColor;
    settings.primaryColor = primaryColor ?? settings.primaryColor;
    settings.borderColor = borderColor ?? settings.borderColor;
    settings.labelColor = labelColor ?? settings.labelColor;
    settings.inputButtonBorderRadius = inputButtonBorderRadius ?? settings.inputButtonBorderRadius;
    
    // Update nested currency object
    if (defaultCurrency) {
        settings.defaultCurrency.code = defaultCurrency.code ?? settings.defaultCurrency.code;
        settings.defaultCurrency.symbol = defaultCurrency.symbol ?? settings.defaultCurrency.symbol;
        settings.defaultCurrency.decimalPlaces = defaultCurrency.decimalPlaces ?? settings.defaultCurrency.decimalPlaces;
        settings.defaultCurrency.thousandSeparator = defaultCurrency.thousandSeparator ?? settings.defaultCurrency.thousandSeparator;
        settings.defaultCurrency.decimalSeparator = defaultCurrency.decimalSeparator ?? settings.defaultCurrency.decimalSeparator;
        settings.defaultCurrency.formatTemplate = defaultCurrency.formatTemplate ?? settings.defaultCurrency.formatTemplate;
    }

    // Update nested emailAutomation object
    if (emailAutomation) {
        for (const key in emailAutomation) {
            if (settings.emailAutomation.hasOwnProperty(key)) {
                if (typeof emailAutomation[key] === 'object' && emailAutomation[key] !== null) {
                    for (const subKey in emailAutomation[key]) {
                        if (settings.emailAutomation[key].hasOwnProperty(subKey)) {
                            settings.emailAutomation[key][subKey] = emailAutomation[key][subKey];
                        }
                    }
                } else {
                    settings.emailAutomation[key] = emailAutomation[key];
                }
            }
        }
    }

    // --- Handle updates to the Company model directly ---
    const companyDoc = await Company.findById(companyId);
    if (companyDoc) {
        companyDoc.name = name ?? companyDoc.name; // Update company name
        companyDoc.address = address ?? companyDoc.address; // Update company address
        companyDoc.phone = phone ?? companyDoc.phone;
        companyDoc.email = email ?? companyDoc.email;
        companyDoc.website = website ?? companyDoc.website;
        companyDoc.taxId = taxId ?? companyDoc.taxId;
        await companyDoc.save();
    } else {
        console.warn(`Company document with ID ${companyId} not found during settings update.`);
    }

    const updatedSettings = await settings.save();

    // When returning, populate company again to ensure frontend gets the updated name
    const finalSettings = await CompanySetting.findById(updatedSettings._id)
                                              .populate('company', 'name appId'); // <--- Populate here for response

    res.status(200).json({
        message: 'Company settings updated successfully.',
        settings: finalSettings // Send the populated settings
    });
});


module.exports = {
    getCompanySettings,
    updateCompanySettings,
};
