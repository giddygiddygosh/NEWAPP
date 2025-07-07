// backend/controllers/settingsController.js

const CompanySetting = require('../models/CompanySetting');
const Company = require('../models/Company'); // Ensure Company model is imported for population
const mongoose = require('mongoose');

/**
 * @desc Get company settings
 * @route GET /api/settings
 * @access Private (Admin, Manager)
 */
exports.getCompanySettings = async (req, res) => {
    try {
        const companyId = req.user.company;

        if (!companyId) {
            console.error('[SettingsController] Attempted to get settings without companyId in req.user.');
            return res.status(400).json({ message: 'Company ID not found in user session. Please re-login.' });
        }

        let settings = await CompanySetting.findOne({ company: companyId })
            // --- FIX: Populate the 'company' field to get its name and appId ---
            .populate('company', 'name appId') // Specify fields to retrieve from the Company model
            .lean(); // Use .lean() for faster queries if you don't need Mongoose document methods

        if (!settings) {
            // If settings don't exist, create default ones
            console.log(`[SettingsController] No existing settings found for company ${companyId}. Creating defaults.`);
            settings = await CompanySetting.create({ company: companyId });
            // After creating, we need to re-fetch/populate it to send the full company object back
            settings = await CompanySetting.findById(settings._id)
                .populate('company', 'name appId')
                .lean();
            console.log(`[SettingsController] Created and fetched default settings for company: ${companyId}`);
        }

        // Add a debug log to see what's being sent to the frontend
        console.log('[SettingsController] Sending settings to frontend:', settings);

        res.status(200).json(settings);
    } catch (error) {
        console.error('Error fetching company settings:', error);
        res.status(500).json({ message: 'Server Error fetching settings', error: error.message });
    }
};

/**
 * @desc Update company settings
 * @route PUT /api/settings
 * @access Private (Admin)
 */
exports.updateCompanySettings = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const companyId = req.user.company;
        const updates = req.body;

        let settings = await CompanySetting.findOne({ company: companyId }).session(session);

        if (!settings) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Settings not found for this company.' });
        }

        // Handle updates for nested objects like address or defaultCurrency
        // Ensure that if 'address' is part of updates, it's correctly merged.
        // The frontend sends `address` as a flat object, assuming it maps to CompanySetting.address
        // If address is part of the Company model, this needs to be split and handled in Company update.
        // Based on SettingsPage.jsx, `address` is sent as `localSettings.companyAddress` to /settings PUT,
        // which implies it's on CompanySetting.
        if (updates.address && typeof updates.address === 'object') {
            settings.address = {
                ...settings.address, // Merge with existing address to keep non-updated fields
                ...updates.address
            };
            delete updates.address; // Remove from general updates to avoid overwriting the merged object
        }

        if (updates.defaultCurrency && typeof updates.defaultCurrency === 'object') {
            settings.defaultCurrency = {
                ...settings.defaultCurrency,
                ...updates.defaultCurrency,
            };
            delete updates.defaultCurrency; // Remove from general updates
        }

        // Handle company-level updates that might be sent in the same payload
        // The frontend sends `name`, `phone`, `email`, `website`, `taxId` for the Company model
        // These need to be updated on the Company model, not CompanySetting.
        const companyUpdates = {};
        const companyFields = ['name', 'phone', 'email', 'website', 'taxId'];
        companyFields.forEach(field => {
            if (updates[field] !== undefined) {
                companyUpdates[field] = updates[field];
                delete updates[field]; // Remove from settings updates
            }
        });

        // Apply remaining updates (CompanySetting fields)
        for (const key of Object.keys(updates)) {
            settings[key] = updates[key];
        }
        settings.updatedAt = Date.now();

        // Save CompanySetting
        await settings.save({ session });

        // Update Company model if there are company-specific updates
        let company;
        if (Object.keys(companyUpdates).length > 0) {
            company = await Company.findById(companyId).session(session);
            if (company) {
                // Ensure the appId is not updated here if it's derived from email domain and meant to be immutable
                if (companyUpdates.name !== undefined) company.name = companyUpdates.name;
                if (companyUpdates.phone !== undefined) company.phone = companyUpdates.phone;
                if (companyUpdates.email !== undefined) company.email = companyUpdates.email;
                if (companyUpdates.website !== undefined) company.website = companyUpdates.website;
                if (companyUpdates.taxId !== undefined) company.taxId = companyUpdates.taxId;
                await company.save({ session });
            } else {
                console.warn(`[SettingsController] Company not found for ID ${companyId} during update.`);
            }
        }

        await session.commitTransaction();
        session.endSession();

        // Re-fetch settings with populated company data to send back a consistent response
        const updatedSettings = await CompanySetting.findById(settings._id)
            .populate('company', 'name appId')
            .lean();

        res.status(200).json({ message: 'Settings updated successfully', settings: updatedSettings });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error updating company settings:', error);
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: `Validation failed: ${Object.values(errors).join(', ')}`, errors: errors });
        }
        if (error.code === 11000) {
             // Handle duplicate key error for company name if it has a unique index
            return res.status(400).json({ message: 'A company with this name already exists.' });
        }
        res.status(500).json({ message: 'Failed to update settings.', error: error.message });
    }
};

// NEW: Export all functions for use in routes
module.exports = {
    getCompanySettings: exports.getCompanySettings,
    updateCompanySettings: exports.updateCompanySettings,
};
