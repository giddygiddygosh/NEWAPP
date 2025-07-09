const mongoose = require('mongoose');

const PayslipSchema = new mongoose.Schema({
    staff: {
        type: mongoose.Schema.ObjectId,
        ref: 'Staff',
        required: true,
        index: true
    },
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    payPeriodStart: {
        type: Date,
        required: true
    },
    payPeriodEnd: {
        type: Date,
        required: true
    },
    grossPay: {
        type: Number,
        default: 0
    },
    // You can add more detailed breakdown fields here later, e.g.:
    // totalHoursWorked: { type: Number, default: 0 },
    // totalJobsCompleted: { type: Number, default: 0 },
    // deductions: { type: Number, default: 0 },
    // bonuses: { type: Number, default: 0 },
    // netPay: { type: Number, default: 0 },
    // payDetails: { // Store the detailed breakdown from payrollController
    //     type: mongoose.Schema.Types.Mixed, // Use Mixed for flexible schema
    //     default: {}
    // },
    // status: { // e.g., 'Generated', 'Paid'
    //     type: String,
    //     enum: ['Generated', 'Approved', 'Paid'],
    //     default: 'Generated'
    // }
}, {
    timestamps: true
});

module.exports = mongoose.models.Payslip || mongoose.model('Payslip', PayslipSchema);