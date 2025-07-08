// backend/controllers/settingController.js

const asyncHandler = require('express-async-handler');
const CompanySetting = require('../models/CompanySetting'); // Assuming your CompanySetting model is here
const Company = require('../models/Company'); // Assuming you might need Company for getting company name

/**
 * @desc Get company settings for the authenticated company
 * @route GET /api/settings
 * @access Private (Admin, Manager, Staff)
 */
const getCompanySettings = asyncHandler(async (req, res) => {
    // req.user.company should be available from your protect middleware
    const companyId = req.user.company;

    const settings = await CompanySetting.findOne({ company: companyId });

    if (!settings) {
        // If no settings exist for the company, you might want to create default ones
        // or return a 404/empty response depending on your app's logic.
        // For now, let's return a default or 404.
        res.status(404);
        throw new Error('Company settings not found.');
    }

    res.status(200).json(settings);
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
        emailAutomation // This will contain all email settings (welcome_email, staff_welcome_email etc.)
    } = req.body;

    let settings = await CompanySetting.findOne({ company: companyId });

    if (!settings) {
        // If settings don't exist, create them
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
        return res.status(201).json(settings);
    }

    // Update existing settings
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
        // Iterate over the keys in emailAutomation and update them
        for (const key in emailAutomation) {
            if (settings.emailAutomation.hasOwnProperty(key)) {
                // Ensure nested properties like 'enabled' are updated correctly
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

    const updatedSettings = await settings.save();
    res.status(200).json(updatedSettings);
});


module.exports = {
    getCompanySettings,
    updateCompanySettings,
};
