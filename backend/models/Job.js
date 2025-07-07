// backend/models/Job.js

const mongoose = require('mongoose');

// --- Subdocument Schema for Recurring Job Information ---
const RecurringSchema = new mongoose.Schema({
    pattern: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        required: true,
        default: 'none',
    },
    endDate: {
        type: Date,
        required: function() { return this.pattern !== 'none'; }
    }
}, { _id: false });

// --- Subdocument Schema for Stock Items Used in a Job ---
const UsedStockItemSchema = new mongoose.Schema({
    stockItem: { // Reference to the actual StockItem document
        type: mongoose.Schema.ObjectId,
        ref: 'StockItem',
        required: true,
    },
    quantityUsed: { // Quantity of this stock item used for this specific job
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
}, { _id: false });


const JobSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    customer: {
        type: mongoose.Schema.ObjectId,
        ref: 'Customer',
        required: [true, 'Job must be linked to a customer'],
    },
    customerName: {
        type: String,
        required: [true, 'Customer name is required for job'],
        trim: true,
    },
    assignedStaff: [{ // REFERS TO THE STAFF MODEL
        type: mongoose.Schema.ObjectId,
        ref: 'Staff', // Correctly references the Staff model
    }],
    serviceType: {
        type: String,
        required: [true, 'Service type is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    date: { // Scheduled start date of the job
        type: Date,
        required: [true, 'Job date is required'],
    },
    time: { // Scheduled start time of the job (HH:MM string)
        type: String,
        required: [true, 'Job time is required'],
        match: [/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Please use HH:MM format for job time'],
    },
    duration: { // Estimated duration of the job in minutes
        type: Number,
        required: [true, 'Job duration is required'],
        min: 5,
    },
    recurring: {
        type: RecurringSchema,
        required: false
    },
    endDate: { // This is now ONLY for non-recurring, multi-day jobs
        type: Date,
        required: false,
    },
    status: {
        type: String,
        enum: ['Booked', 'Confirmed', 'In Progress', 'Completed', 'Invoiced', 'Invoice Paid', 'Cancelled', 'Pending', 'On Hold'],
        default: 'Booked',
    },
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        county: { type: String, trim: true },
        postcode: { type: String, trim: true },
        country: { type: String, trim: true },
    },
    notes: {
        type: String,
        trim: true,
    },
    usedStockItems: { // Field to store stock items used for this job
        type: [UsedStockItemSchema],
        default: [],
    },
    convertedFromQuote: {
        type: mongoose.Schema.ObjectId,
        ref: 'Quote',
        required: false,
    },
    convertedFromBookingForm: {
        type: mongoose.Schema.ObjectId,
        ref: 'Submission',
        required: false,
    },
    clockIn: { type: Date },
    clockOut: { type: Date },
    clockInLocation: { latitude: Number, longitude: Number },
    clockOutLocation: { latitude: Number, longitude: Number },
    photos: [{ url: String, caption: String }],
    completedTasks: mongoose.Schema.Types.Mixed,
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
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

JobSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Job', JobSchema);

