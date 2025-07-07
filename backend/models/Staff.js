// backend/models/Staff.js

const mongoose = require('mongoose');

// Define sub-schema for individual unavailability periods
const UnavailabilityPeriodSchema = new mongoose.Schema({
    start: {
        type: Date,
        required: [true, 'Start date is required for unavailability period'],
    },
    end: {
        type: Date,
        required: [true, 'End date is required for unavailability period'],
    },
    type: { // e.g., 'Holiday', 'Sick', 'Other'
        type: String,
        enum: ['Holiday', 'Sick', 'Other', 'Training', 'Emergency Holiday'], // Ensure enum matches frontend
        required: [true, 'Absence type is required'],
    },
    reason: { // Optional reason/notes for the absence
        type: String,
        trim: true,
        default: '',
    },
}, { _id: true }); // Explicitly set _id to true, though it's default behavior


const StaffSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    contactPersonName: {
        type: String,
        required: [true, 'Staff name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Staff email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    phone: {
        type: String,
        trim: true,
        default: ''
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
        enum: ['staff', 'manager'],
        default: 'staff',
    },
    employeeId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
    },
    hireDate: {
        type: Date,
        default: Date.now,
    },
    // THIS IS THE CRITICAL FIELD
    unavailabilityPeriods: {
        type: [UnavailabilityPeriodSchema], // Array of subdocuments
        default: [], // Default to an empty array
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

StaffSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// THIS IS THE FIX FOR OverwriteModelError
// Check if the 'Staff' model already exists before compiling it.
module.exports = mongoose.models.Staff || mongoose.model('Staff', StaffSchema);
