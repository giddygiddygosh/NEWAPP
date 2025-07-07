// backend/models/Staff.js

const mongoose = require('mongoose');

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
    email: { // Staff member's primary email (should match their User.email)
        type: String,
        required: [true, 'Staff email is required'],
        unique: true, // This *should* be unique for staff members within a company
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

module.exports = mongoose.model('Staff', StaffSchema);