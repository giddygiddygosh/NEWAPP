// backend/models/EmailTemplate.js

const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
    company: { // Link to the company this template belongs to
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    templateType: { // e.g., 'welcome_email', 'appointment_reminder' (from TEMPLATE_TYPES IDs)
        type: String,
        required: [true, 'Template type is required'],
        unique: true, // Assuming one template per type per company
        // If you want one template per type across ALL companies (less likely), remove `company` from unique index.
        // If you want unique per company, create a compound index below.
    },
    name: { // User-editable name for the template
        type: String,
        required: [true, 'Template name is required'],
        trim: true,
    },
    subject: { // Email subject line
        type: String,
        required: [true, 'Template subject is required'],
        trim: true,
    },
    body: { // HTML or plain text body of the email
        type: String,
        required: [true, 'Template body is required'],
    },
    headerImageUrl: { // URL for an optional header image
        type: String,
        trim: true,
        default: '',
    },
    // We'll rely on Mongoose's built-in _id for unique template identification
    // No ownerId field as authorization will be via company/user role.
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Ensure templateType is unique per company for better data integrity
EmailTemplateSchema.index({ templateType: 1, company: 1 }, { unique: true });


module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);