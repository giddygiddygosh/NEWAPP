// File: backend/models/Job.js (Correct Mongoose Schema)

const mongoose = require('mongoose');

const UsedStockItemSchema = new mongoose.Schema({
    stockItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockItem',
        required: true,
    },
    quantityUsed: {
        type: Number,
        required: true,
        min: 0,
    },
}, { _id: false });

const JobSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'A customer is required for the job.'],
    },
    serviceType: {
        type: String,
        required: [true, 'Service type is required.'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    date: {
        type: Date,
        required: [true, 'Job date is required.'],
    },
    endDate: {
        type: Date,
    },
    time: {
        type: String,
        required: [true, 'Job time is required.'],
    },
    duration: {
        type: Number,
        required: [true, 'Job duration is required.'],
        default: 60,
    },
    assignedStaff: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
    }],
    status: {
        type: String,
        enum: ['Booked', 'Confirmed', 'In Progress', 'Completed', 'Invoiced', 'Invoice Paid', 'Cancelled', 'Pending', 'On Hold'],
        default: 'Booked',
    },
    address: {
        street: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        county: { type: String, trim: true, default: '' },
        postcode: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' },
    },
    recurring: {
        pattern: {
            type: String,
            enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
            default: 'none',
        },
        endDate: {
            type: Date,
        },
    },
    usedStockItems: [UsedStockItemSchema],
    notes: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Job', JobSchema);