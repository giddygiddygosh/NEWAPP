// backend/models/CompanySetting.js

const mongoose = require('mongoose');

const CompanySettingSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
        unique: true
    },
    // ... (other settings like companyLogoUrl, defaultCurrency, etc.)
    
    // Email Automation Settings
    emailAutomation: {
        welcome_email: { enabled: { type: Boolean, default: true } },
        appointment_reminder: {
            enabled: { type: Boolean, default: true },
            daysBefore: { type: Number, default: 1, min: 0 },
        },
        job_completion: { enabled: { type: Boolean, default: true } },
        // --- THIS IS THE FIX ---
        // The default is now 'true', so invoices will be enabled unless turned off.
        invoice_email: { enabled: { type: Boolean, default: true } }, 
        invoice_reminder: {
            enabled: { type: Boolean, default: true },
            daysAfter: { type: Number, default: 7, min: 0 },
        },
        review_request: {
            enabled: { type: Boolean, default: true },
            daysAfter: { type: Number, default: 3, min: 0 },
        },
    },

    // Invoice Settings
    invoiceSettings: {
        nextInvoiceSeqNumber: {
            type: Number,
            default: 1,
            min: 1,
        },
        invoicePrefix: {
            type: String,
            default: 'INV-',
            trim: true,
        },
        defaultTaxRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 1,
        },
    },
    // ... (timestamps)
}, { timestamps: true });

CompanySettingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('CompanySetting', CompanySettingSchema);

