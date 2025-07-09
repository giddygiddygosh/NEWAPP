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
    resolutionReason: { // Reason provided by admin for Approved/Rejected status
        type: String,
        trim: true,
        default: '',
    },
}, { timestamps: true });

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
        select: false,
    },
    // --- NEW FIELDS FOR PAYROLL ---
    payRateType: {
        type: String,
        enum: ['Hourly', 'Fixed per Job', 'Percentage per Job', 'Daily Rate'], // Added 'Daily Rate' for daily clock-in/out
        default: 'Hourly', // Set a reasonable default
    },
    hourlyRate: {
        type: Number,
        min: 0,
        default: 0,
    },
    jobFixedAmount: {
        type: Number,
        min: 0,
        default: 0,
    },
    jobPercentage: {
        type: Number,
        min: 0,
        max: 100, // Assuming 0-100%
        default: 0,
    },
    dailyClockInThresholdMins: { // For 'Daily Rate' type, e.g., if they clock in/out for >= 480 mins, count as full day
        type: Number,
        min: 0,
        default: 480, // Default to 8 hours for a full day (8 * 60 minutes)
    }
    // --- END NEW FIELDS ---
}, {
    timestamps: true,
});

module.exports = mongoose.model('Staff', StaffSchema);