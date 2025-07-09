const asyncHandler = require('express-async-handler');
const CompanySetting = require('../models/CompanySetting');
const Company = require('../models/Company'); // Ensure this import is correct

/**
 * @desc Get company settings for the authenticated company
 * @route GET /api/settings
 * @access Private (Admin, Manager, Staff)
 */
const getCompanySettings = asyncHandler(async (req, res) => {
    const companyId = req.user.company;

    // FIX: Add 'settings.taxId' and other nested 'settings' fields to the populate fields for 'company'
    const settings = await CompanySetting.findOne({ company: companyId })
                                         .populate('company', 'name appId settings.taxId settings.address settings.phone settings.email settings.website settings.currency settings.invoiceSettings'); 
                                         // Included other common nested fields for a complete picture.
                                         // Adjust this string to include only the 'company' sub-fields you actually need in the response.

    if (!settings) {
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
        defaultCurrency, // This is for CompanySetting model
        emailAutomation,
        invoiceSettings, // This is for CompanySetting model

        // These fields are for the Company model, but they are NESTED under 'settings'
        name, // This is a root field on the Company model
        address, // This is for Company.settings.address (an object)
        phone, // This is for Company.settings.phone
        email, // This is for Company.settings.email
        website, // This is for Company.settings.website
        taxId // This is for Company.settings.taxId
    } = req.body;

    // console.log('Received taxId in payload:', taxId); // Uncomment for debugging if needed

    let settings = await CompanySetting.findOne({ company: companyId });

    if (!settings) {
        // If no settings exist, create a new one
        settings = await CompanySetting.create({
            company: companyId,
            companyLogoUrl,
            defaultFormName,
            backgroundColor,
            primaryColor,
            borderColor,
            labelColor,
            inputButtonBorderRadius,
            // Ensure defaultCurrency and invoiceSettings are initialized or spread from req.body
            defaultCurrency: defaultCurrency || {},
            emailAutomation: emailAutomation || {},
            invoiceSettings: invoiceSettings || {},
        });
    }

    // Update fields belonging to the CompanySetting model
    settings.companyLogoUrl = companyLogoUrl ?? settings.companyLogoUrl;
    settings.defaultFormName = defaultFormName ?? settings.defaultFormName;
    settings.backgroundColor = backgroundColor ?? settings.backgroundColor;
    settings.primaryColor = primaryColor ?? settings.primaryColor;
    settings.borderColor = borderColor ?? settings.borderColor;
    settings.labelColor = labelColor ?? settings.labelColor;
    settings.inputButtonBorderRadius = inputButtonBorderRadius ?? settings.inputButtonBorderRadius;
    
    // Handle nested defaultCurrency for CompanySetting
    if (defaultCurrency) {
        settings.defaultCurrency.code = defaultCurrency.code ?? settings.defaultCurrency.code;
        settings.defaultCurrency.symbol = defaultCurrency.symbol ?? settings.defaultCurrency.symbol;
        settings.defaultCurrency.decimalPlaces = defaultCurrency.decimalPlaces ?? settings.defaultCurrency.decimalPlaces;
        settings.defaultCurrency.thousandSeparator = defaultCurrency.thousandSeparator ?? settings.defaultCurrency.thousandSeparator;
        settings.defaultCurrency.decimalSeparator = defaultCurrency.decimalSeparator ?? settings.defaultCurrency.decimalSeparator;
        settings.defaultCurrency.formatTemplate = defaultCurrency.formatTemplate ?? settings.defaultCurrency.formatTemplate;
    }

    // Handle nested emailAutomation for CompanySetting
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

    // Handle nested invoiceSettings for CompanySetting
    if (invoiceSettings) {
        settings.invoiceSettings.invoicePrefix = invoiceSettings.invoicePrefix ?? settings.invoiceSettings.invoicePrefix;
        settings.invoiceSettings.nextInvoiceSeqNumber = invoiceSettings.nextInvoiceSeqNumber ?? settings.invoiceSettings.nextInvoiceSeqNumber;
        settings.invoiceSettings.defaultTaxRate = invoiceSettings.defaultTaxRate ?? settings.invoiceSettings.defaultTaxRate;
    }

    // Handle updates to the Company model directly
    const companyDoc = await Company.findById(companyId);
    if (companyDoc) {
        companyDoc.name = name ?? companyDoc.name; // Top-level field, correct

        // **CRITICAL FIX:** Update nested fields under `companyDoc.settings`
        companyDoc.settings.phone = phone ?? companyDoc.settings.phone;
        companyDoc.settings.email = email ?? companyDoc.settings.email;
        companyDoc.settings.website = website ?? companyDoc.settings.website;
        companyDoc.settings.taxId = taxId ?? companyDoc.settings.taxId;

        // For the 'address' object, update its sub-fields
        if (address) {
            companyDoc.settings.address.street = address.street ?? companyDoc.settings.address.street;
            companyDoc.settings.address.city = address.city ?? companyDoc.settings.address.city;
            companyDoc.settings.address.county = address.county ?? companyDoc.settings.address.county;
            companyDoc.settings.address.postcode = address.postcode ?? companyDoc.settings.address.postcode;
            companyDoc.settings.address.country = address.country ?? companyDoc.settings.address.country;
        }

        // IMPORTANT: If you are sending `currency` or `invoiceSettings` in the request body
        // and these are intended to update the Company model's `settings.currency` or `settings.invoiceSettings`,
        // you would need to add similar update logic here.
        // Based on your original code, it seemed `defaultCurrency` and `invoiceSettings` were primarily for `CompanySetting` model.
        // Make sure you don't have conflicting updates or duplicate data.

        await companyDoc.save(); // Save the Company document changes
    } else {
        console.warn(`Company document with ID ${companyId} not found during settings update. This should not happen.`);
    }

    const updatedSettings = await settings.save(); // Save the CompanySetting document changes

    // FIX: Add 'settings.taxId' and other nested 'settings' fields to the populate fields for 'company' here as well
    const finalSettings = await CompanySetting.findById(updatedSettings._id)
                                              .populate('company', 'name appId settings.taxId settings.address settings.phone settings.email settings.website settings.currency settings.invoiceSettings');
                                              // Ensure consistency with the getCompanySettings populate string.

    res.status(200).json({
        message: 'Company settings updated successfully.',
        settings: finalSettings
    });
});

module.exports = {
    getCompanySettings,
    updateCompanySettings,
};