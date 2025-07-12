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
        payType: { // This seems related to the job itself rather than just address
            type: String,
            enum: ['Fixed', 'Hourly', ''],
        },
        amount: { // This also seems job-related, potentially price breakdown per address
            type: Number,
        },
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
        enum: ['Booked', 'On Route', 'In Progress', 'Pending Completion', 'Completed', 'Cancelled', 'Invoiced'],
        default: 'Booked',
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium',
    },
    price: { // This is your total job amount
        type: Number,
        required: [true, 'Please add a price'],
        min: [0, 'Price cannot be negative'],
    },
    // --- NEW FIELDS FOR DEPOSIT PAYMENT ---
    depositRequired: { // The amount expected as a deposit for this job
        type: Number,
        default: 0,
        min: [0, 'Deposit required cannot be negative'],
    },
    depositPaid: { // The amount actually paid as a deposit
        type: Number,
        default: 0,
        min: [0, 'Deposit paid cannot be negative'],
    },
    depositPaymentIntentId: { // Stripe Payment Intent ID for the deposit transaction
        type: String,
        default: null,
        trim: true,
    },
    depositStatus: { // Status of the deposit payment (e.g., pending, paid, refunded)
        type: String,
        enum: ['Not Required', 'Pending', 'Paid', 'Refunded', 'Failed'],
        default: 'Not Required', // Default to not required
    },
    // --- END NEW FIELDS ---
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
    formTemplate: {
        type: mongoose.Schema.ObjectId,
        ref: 'Form',
        default: null,
    },
    tasks: [
        {
            taskId: {
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

// --- NEW pre-save hook to manage depositStatus ---
JobSchema.pre('save', function (next) {
    // Update updatedAt timestamp
    this.updatedAt = Date.now();

    // Logic for depositStatus
    // If deposit is required but nothing paid, or partial paid, it's 'Pending'
    if (this.depositRequired > 0) {
        if (this.depositPaid >= this.depositRequired) {
            this.depositStatus = 'Paid';
        } else if (this.depositPaid > 0 && this.depositPaid < this.depositRequired) {
            this.depositStatus = 'Pending'; // Still pending if partially paid
        } else { // depositPaid is 0
            this.depositStatus = 'Pending';
        }
    } else { // depositRequired is 0 or less
        this.depositStatus = 'Not Required';
        this.depositPaid = 0; // Ensure paid is 0 if not required
        this.depositPaymentIntentId = null; // Clear intent ID if not required
    }

    next();
});

module.exports = mongoose.model('Job', JobSchema);