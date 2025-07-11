const mongoose = require('mongoose');

const FormSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: [true, 'Form name is required'],
        trim: true,
    },
    formSchema: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Form schema is required'],
    },
    purpose: {
        type: String,
        enum: ['customer_lead', 'booking_form', 'job_checklist', 'other', 'general', 'reminder_task_list', 'customer_quote'],
        default: 'other',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    companySpecific: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true // This automatically handles createdAt and updatedAt
});

FormSchema.index({ name: 1, adminId: 1 }, { unique: true });

module.exports = mongoose.model('Form', FormSchema);