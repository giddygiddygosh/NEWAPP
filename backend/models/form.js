// backend/models/Form.js

const mongoose = require('mongoose');

const FormSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    name: {
        type: String,
        required: [true, 'Form name is required'],
        trim: true,
    },
    schema: {
        type: mongoose.Schema.Types.Mixed, // Use Mixed to store arbitrary data structures
        required: [true, 'Form schema is required'],
    },
    purpose: {
        type: String,
        // FIXED: Added 'reminder_task_list' to the enum
        enum: ['customer_lead', 'booking_form', 'job_checklist', 'other', 'general', 'reminder_task_list'],
        default: 'other',
    },
    companySpecific: {
        type: Boolean,
        default: true,
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

FormSchema.index({ name: 1, company: 1 }, { unique: true });

FormSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Form', FormSchema);