// backend/models/EmergencyRequest.js

const mongoose = require('mongoose');

const EmergencyRequestSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
    },
    customerName: {
        type: String,
        required: true,
        trim: true,
    },
    customerEmail: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
    },
    customerPhone: { // Primary phone from customer's profile (can differ from contactPhone if provided in form)
        type: String,
        trim: true,
    },
    serviceNeeded: {
        type: String,
        enum: ['Plumbing Emergency', 'Electrical Fault', 'Heating System Failure', 'Other'],
        required: true,
    },
    description: {
        type: String,
        trim: true,
        required: function() { return this.serviceNeeded === 'Other'; } // Required only if serviceNeeded is 'Other'
    },
    contactPhone: { // The specific phone number provided by the customer for this emergency
        type: String,
        trim: true,
        required: [true, 'Contact phone is required for emergency request.'],
    },
    preferredTime: {
        type: String,
        enum: ['Any Time', 'ASAP', 'Morning (8-12)', 'Afternoon (12-5)', 'Evening (5-9)'],
        default: 'Any Time',
    },
    status: {
        type: String,
        enum: ['New', 'In Progress', 'Resolved', 'Closed', 'Cancelled'],
        default: 'New',
    },
    company: { // Link to the company that manages this request (from the customer's company)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
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

EmergencyRequestSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('EmergencyRequest', EmergencyRequestSchema);