// backend/models/Job.js

const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    customer: {
        type: mongoose.Schema.ObjectId,
        ref: 'Customer',
        required: true,
    },
    staff: [{ // Array of ObjectIds for multiple assigned staff
        type: mongoose.Schema.ObjectId,
        ref: 'Staff',
        required: true,
    }],
    serviceType: {
        type: String,
        required: [true, 'Please add a service type'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        postcode: { type: String, trim: true },
        country: { type: String, trim: true },
    },
    date: {
        type: Date,
        required: [true, 'Please add a job date'],
    },
    time: { // Expected format "HH:MM" e.g., "09:00"
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please use HH:MM format for time'],
    },
    status: {
        type: String,
        enum: ['Booked', 'On Route', 'In Progress', 'Pending Completion', 'Completed', 'Cancelled'],
        default: 'Booked',
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium',
    },
    price: {
        type: Number,
        required: [true, 'Please add a price'],
        min: [0, 'Price cannot be negative'],
    },
    usedStock: [
        {
            stockId: {
                type: mongoose.Schema.ObjectId,
                ref: 'StockItem',
                required: true,
            },
            name: String,
            quantity: {
                type: Number,
                required: true,
                min: 0,
            },
        },
    ],
    clockInTime: {
        type: Date,
        default: null,
    },
    clockOutTime: {
        type: Date,
        default: null,
    },
    photos: [
        {
            url: {
                type: String,
                required: true,
            },
            label: {
                type: String,
                trim: true,
                required: true,
            },
            type: {
                type: String,
                enum: ['before', 'after', 'other'],
                default: 'other',
            },
            uploadedAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    // NEW FIELD: Reference to the Form (task list template) used for this job
    formTemplate: {
        type: mongoose.Schema.ObjectId,
        ref: 'Form',
        default: null, // Optional, not all jobs might have a template
    },
    // Tasks list for the job (populated from formTemplate's schema, or manually added)
    tasks: [
        {
            taskId: { // Unique ID for the task, could be generated or from form template
                type: String,
                required: true,
            },
            description: {
                type: String,
                required: true,
                trim: true,
            },
            isCompleted: {
                type: Boolean,
                default: false,
            },
            completedAt: {
                type: Date,
                default: null,
            },
        },
    ],
    returnedStock: [
        {
            stockId: {
                type: mongoose.Schema.ObjectId,
                ref: 'StockItem',
                required: true,
            },
            name: String,
            quantity: {
                type: Number,
                required: true,
                min: 0,
            },
            returnedAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

JobSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Job', JobSchema);
