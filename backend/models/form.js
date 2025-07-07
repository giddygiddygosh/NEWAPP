// backend/models/Form.js

const mongoose = require('mongoose');

const FormSchema = new mongoose.Schema({
    // Name of the form (for internal identification in the builder)
    name: {
        type: String,
        required: [true, 'Form name is required'],
        trim: true,
        unique: true, // Form names should be unique within a company
    },
    // The JSON schema representing the form fields and their layout
    schema: {
        type: mongoose.Schema.Types.Mixed, // Use Mixed type to store a flexible JSON object
        required: [true, 'Form schema is required'],
    },
    // Optional: Settings for the form, e.g., submission message, redirect URL
    settings: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    // UPDATED FIELD: Purpose of the form (e.g., 'general', 'customer_booking', 'customer_quote', 'reminder_task_list')
    purpose: {
        type: String,
        enum: ['general', 'customer_booking', 'customer_quote', 'reminder_task_list'], // ADDED 'reminder_task_list'
        default: 'general',
        required: true,
    },
    // Reference to the company this form belongs to
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    // Reference to the user who created this form
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
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

// Update `updatedAt` field on save
FormSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Form', FormSchema);