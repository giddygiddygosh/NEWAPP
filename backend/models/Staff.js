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
        enum: ['Holiday', 'Sick', 'Training', 'Appointment', 'Other', 'Emergency Holiday'],
        default: 'Other',
    },
    reason: { // Staff's reason for the request
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending',
        required: true,
    },
    // --- NEW FIELD: Admin's reason for approval/rejection ---
    resolutionReason: { // Reason provided by admin for Approved/Rejected status
        type: String,
        trim: true,
        default: '',
    },
    // --- END NEW FIELD ---
}, { timestamps: true }); // Ensure timestamps are active for these subdocuments too if you need them

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
        sparse: true,
    },
    unavailabilityPeriods: {
        type: [UnavailabilityPeriodSchema],
        default: [],
        select: false, // Hide from default queries unless explicitly requested
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Staff', StaffSchema);