// backend/models/Invoice.js

const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
    },
    unitPrice: {
        type: Number,
        required: true,
        default: 0,
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0,
    },
}, { _id: false });


const InvoiceSchema = new mongoose.Schema({
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
    job: {
        type: mongoose.Schema.ObjectId,
        ref: 'Job',
        required: true,
    },
    invoiceNumber: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'void'],
        default: 'draft',
    },
    issueDate: {
        type: Date,
        required: true,
        default: Date.now,
    },
    dueDate: {
        type: Date,
        required: true,
    },
    lineItems: [LineItemSchema],
    subtotal: {
        type: Number,
        required: true,
        default: 0,
    },
    taxAmount: {
        type: Number,
        default: 0,
    },
    total: {
        type: Number,
        required: true,
        default: 0,
    },
    amountPaid: {
        type: Number,
        default: 0,
    },
    notes: {
        type: String,
        trim: true,
    },
    currency: {
        code: { type: String, default: 'GBP' },
        symbol: { type: String, default: '£' },
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Invoice', InvoiceSchema);