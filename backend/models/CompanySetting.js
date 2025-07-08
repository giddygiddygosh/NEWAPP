// backend/models/CompanySetting.js

const mongoose = require('mongoose');

const CompanySettingSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
        unique: true // Keep this one, it's concise for a single-field unique index
    },
    // General Settings
    companyLogoUrl: {
        type: String,
        trim: true,
        default: ''
    },
    defaultFormName: {
        type: String,
        trim: true,
        default: 'New Form'
    },
    // UI Styling Overrides
    backgroundColor: {
        type: String,
        default: '#FFFFFF'
    },
    primaryColor: {
        type: String,
        default: '#3B82F6' // blue-500
    },
    borderColor: {
        type: String,
        default: '#D1D5DB' // gray-300
    },
    labelColor: {
        type: String,
        default: '#111827' // gray-900
    },
    inputButtonBorderRadius: {
        type: String,
        default: '0.375rem' // rounded-md
    },
    // NEW: Default Currency Setting
    defaultCurrency: {
        code: { type: String, default: 'GBP' }, // e.g., GBP, USD, EUR
        symbol: { type: String, default: '£' }, // e.g., £, $, €
        decimalPlaces: { type: Number, default: 2 },
        thousandSeparator: { type: String, default: ',' },
        decimalSeparator: { type: String, default: '.' },
        formatTemplate: { type: String, default: '{symbol}{amount}' } // e.g., {symbol}{amount}, {amount}{symbol}
    },
    // NEW: Email Automation Settings
    emailAutomation: {
        welcome_email: { enabled: { type: Boolean, default: true } }, // <--- CHANGED THIS FROM 'false' TO 'true'
        appointment_reminder: {
            enabled: { type: Boolean, default: false },
            daysBefore: { type: Number, default: 1, min: 0 }, // e.g., 1 day before
        },
        job_completion: { enabled: { type: Boolean, default: false } },
        invoice_email: { enabled: { type: Boolean, default: false } }, // For the missing invoice email
        invoice_reminder: {
            enabled: { type: Boolean, default: false },
            daysAfter: { type: Number, default: 7, min: 0 }, // e.g., 7 days after
        },
        review_request: {
            enabled: { type: Boolean, default: false },
            daysAfter: { type: Number, default: 3, min: 0 }, // e.g., 3 days after completion
        },
        // Add other configurable email types here if needed
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

CompanySettingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('CompanySetting', CompanySettingSchema);