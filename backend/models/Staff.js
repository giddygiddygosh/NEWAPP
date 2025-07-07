// File: backend/models/Staff.js

const mongoose = require('mongoose');

// This defines the structure for each individual absence period
const UnavailabilityPeriodSchema = new mongoose.Schema({
    start: {
        type: Date,
        required: true,
    },
    end: {
        type: Date,
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['Holiday', 'Sick', 'Training', 'Appointment', 'Other'],
        default: 'Other',
    },
    reason: {
        type: String,
        trim: true,
    },
});

const StaffSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    contactPersonName: {
        type: String,
        required: [true, 'Contact person name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    address: {
        street: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        county: { type: String, trim: true, default: '' },
        postcode: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' },
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'staff'],
        default: 'staff',
    },
    employeeId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true, // Allows multiple null values but unique if value exists
    },
    // This is the critical part: an array of absence periods embedded in the staff document
    unavailabilityPeriods: {
        type: [UnavailabilityPeriodSchema],
        default: [],
        select: false, // Hide from default queries unless explicitly requested
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Staff', StaffSchema);
