const CompanySetting = require('../models/CompanySetting');
const Company = require('../models/Company');
const mongoose = require('mongoose');

/**
 * @desc    Get all company settings and company info
 * @route   GET /api/settings
 * @access  Private
 */
exports.getCompanySettings = async (req, res) => {
    try {
        const companyId = req.user.company._id;

        // 1. Get the main settings document
        const settings = await CompanySetting.findOne({ company: companyId }).lean();

        if (!settings) {
            return res.status(404).json({ message: 'Settings not found.' });
        }

        // 2. Get the company document separately, explicitly selecting stripeAccountId AND stripeDetailsSubmitted
        const company = await Company.findById(companyId).select('+stripeAccountId +stripeDetailsSubmitted').lean(); // Modified this line

        if (!company) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        // 3. Manually combine them into the structure the frontend expects
        const combinedSettings = {
            ...settings,
            company: company, // Attach the full company object
        };

        res.status(200).json({
            success: true,
            settings: combinedSettings
        });

    } catch (error) {
        console.error('Error in getCompanySettings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch company settings.' });
    }
};

/**
 * @desc    Update company settings
 * @route   PUT /api/settings
 * @access  Private
 */
exports.updateCompanySettings = async (req, res) => {
    try {
        const {
            companyLogoUrl, defaultFormName, backgroundColor, primaryColor, borderColor, labelColor,
            inputButtonBorderRadius, defaultCurrency, invoiceSettings, emailAutomation, name,
            address, phone, email, website, taxId, stripeAccountId // Include stripeAccountId in destructuring
        } = req.body;

        const companyId = req.user.company._id;

        // --- 1. Update the Company model ---
        const companyUpdatePayload = {};
        if (name !== undefined) companyUpdatePayload.name = name;
        if (address !== undefined) companyUpdatePayload['settings.address'] = address;
        if (phone !== undefined) companyUpdatePayload['settings.phone'] = phone;
        if (email !== undefined) companyUpdatePayload['settings.email'] = email;
        if (website !== undefined) companyUpdatePayload['settings.website'] = website;
        if (taxId !== undefined) companyUpdatePayload['settings.taxId'] = taxId;
        // Allow updating stripeAccountId to clear it (disconnect)
        if (stripeAccountId !== undefined) {
             companyUpdatePayload.stripeAccountId = stripeAccountId;
             // If disconnecting, set stripeDetailsSubmitted to false
             if (!stripeAccountId) {
                 companyUpdatePayload.stripeDetailsSubmitted = false;
             }
        }


        if (Object.keys(companyUpdatePayload).length > 0) {
            await Company.findByIdAndUpdate(companyId, { $set: companyUpdatePayload });
        }

        // --- 2. Update the CompanySetting model ---
        const settingsUpdatePayload = {
            companyLogoUrl, defaultFormName, backgroundColor, primaryColor, borderColor, labelColor,
            inputButtonBorderRadius, defaultCurrency, invoiceSettings, emailAutomation
        };

        Object.keys(settingsUpdatePayload).forEach(key => settingsUpdatePayload[key] === undefined && delete settingsUpdatePayload[key]);

        const updatedSettings = await CompanySetting.findOneAndUpdate(
            { company: companyId },
            { $set: settingsUpdatePayload },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        // Ensure stripeAccountId and stripeDetailsSubmitted are fetched after update
        const updatedCompany = await Company.findById(companyId).select('+stripeAccountId +stripeDetailsSubmitted').lean(); // Modified this line

        res.status(200).json({
            success: true,
            settings: { ...updatedSettings, company: updatedCompany },
            message: 'Company settings updated successfully!'
        });

    } catch (error) {
        console.error('Error updating company settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update company settings.' });
    }
};