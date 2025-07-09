// backend/models/Absence.js

const mongoose = require('mongoose');

const AbsenceSchema = new mongoose.Schema({
    staff: { // This links the absence record to a specific staff member
        type: mongoose.Schema.ObjectId,
        ref: 'Staff',
        required: true,
        index: true // Add an index for faster lookups by staff member
    },
    company: { // To easily filter absences by company
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    start: {
        type: Date,
        required: [true, 'Start date is required for absence period'],
    },
    end: {
        type: Date,
        required: [true, 'End date is required for absence period'],
    },
    type: { // e.g., 'Holiday', 'Sick', 'Other'
        type: String,
        enum: ['Holiday', 'Sick', 'Other', 'Training', 'Emergency Holiday'],
        required: [true, 'Absence type is required'],
    },
    reason: { // Optional reason/notes
        type: String,
        trim: true,
        default: '',
    },
    // --- NEW FIELD FOR APPROVAL WORKFLOW ---
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], // Added 'Cancelled' for completeness
        default: 'Pending', // New requests should start as 'Pending'
        required: true,
    },
    // --- END NEW FIELD ---
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

AbsenceSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// If you also use findByIdAndUpdate or findOneAndUpdate, you might want a pre-update hook:
AbsenceSchema.pre('findOneAndUpdate', function() {
    this.set({ updatedAt: new Date() });
});


module.exports = mongoose.models.Absence || mongoose.model('Absence', AbsenceSchema);