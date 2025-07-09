// backend/models/CompanySetting.js

const mongoose = require('mongoose');

const CompanySettingSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
        unique: true // Ensures only one settings document per company
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
    // Default Currency Setting
    defaultCurrency: {
        code: { type: String, default: 'GBP' }, // e.g., GBP, USD, EUR
        symbol: { type: String, default: '£' }, // e.g., £, $, €
        decimalPlaces: { type: Number, default: 2 },
        thousandSeparator: { type: String, default: ',' },
        decimalSeparator: { type: String, default: '.' },
        formatTemplate: { type: String, default: '{symbol}{amount}' } // e.g., {symbol}{amount}, {amount}{symbol}
    },
    // Email Automation Settings
    emailAutomation: {
        welcome_email: { enabled: { type: Boolean, default: true } },
        appointment_reminder: {
            enabled: { type: Boolean, default: false },
            daysBefore: { type: Number, default: 1, min: 0 },
        },
        job_completion: { enabled: { type: Boolean, default: false } },
        invoice_email: { enabled: { type: Boolean, default: false } },
        invoice_reminder: {
            enabled: { type: Boolean, default: false },
            daysAfter: { type: Number, default: 7, min: 0 },
        },
        review_request: {
            enabled: { type: Boolean, default: false },
            daysAfter: { type: Number, default: 3, min: 0 },
        },
    },

    // NEW: Invoice Settings
    invoiceSettings: {
        nextInvoiceSeqNumber: {
            type: Number,
            default: 1, // Next sequential number to be used, e.g., for INV-0001
            min: 1,
        },
        invoicePrefix: {
            type: String,
            default: 'INV-', // Prefix for invoice numbers, e.g., "INV-001"
            trim: true,
        },
        defaultTaxRate: {
            type: Number,
            default: 0, // Default tax rate as a decimal (e.g., 0.20 for 20%)
            min: 0,
            max: 1, // Max 100% (for rates represented as decimals)
        },
        // Add other invoice-related settings here if needed, e.g., default payment terms days
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