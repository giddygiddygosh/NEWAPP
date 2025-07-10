const mongoose = require('mongoose');

const PayslipSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    staff: {
        type: mongoose.Schema.ObjectId,
        ref: 'Staff',
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
    earnings: [{ // Added earnings array
        description: { type: String, required: true },
        amount: { type: Number, required: true, default: 0 }
    }],
    deductions: [{ // Added deductions array
        description: { type: String, required: true },
        amount: { type: Number, required: true, default: 0 }
    }],
    totalDeductions: { // Added totalDeductions
        type: Number,
        default: 0
    },
    netPay: { // Added netPay
        type: Number,
        default: 0
    },
    payDetailsBreakdown: { // Added for detailed breakdown
        type: mongoose.Schema.Types.Mixed, // Use Mixed for flexible schema
        default: {}
    },
    status: { // e.g., 'Generated', 'Paid'
        type: String,
        enum: ['Generated', 'Approved', 'Paid'],
        default: 'Generated'
    }
}, {
    timestamps: true
});

// Pre-save hook to calculate totalDeductions and netPay before saving
PayslipSchema.pre('save', function(next) {
    // Calculate totalDeductions from the deductions array
    this.totalDeductions = this.deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
    // Calculate netPay
    this.netPay = (this.grossPay || 0) - this.totalDeductions;
    next();
});

module.exports = mongoose.models.Payslip || mongoose.model('Payslip', PayslipSchema);