// backend/models/Submission.js

const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    form: {
        type: mongoose.Schema.ObjectId,
        ref: 'Form',
        required: true,
    },
    company: { // The company this submission belongs to (from the form's company)
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    submittedBy: { // Email or identifier of the person submitting the form
        type: String,
        trim: true,
        // This won't be required as some forms might be anonymous,
        // but it's good to capture if an email field is present.
    },
    data: { // Raw data submitted from the form
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    // Optional: Link to a Customer or Lead if one was created/updated from this submission
    customer: {
        type: mongoose.Schema.ObjectId,
        ref: 'Customer',
        required: false,
    },
    lead: {
        type: mongoose.Schema.ObjectId,
        ref: 'Lead',
        required: false,
    },
    // Optional: If it's a quote form submission, store the lead ID it was intended for
    associatedLeadId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Lead',
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true // Adds updatedAt automatically
});

module.exports = mongoose.model('Submission', SubmissionSchema);