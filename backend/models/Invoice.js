const mongoose = require('mongoose');

// Define LineItemSchema FIRST, as it's used by InvoiceSchema
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
}, { _id: false }); // _id: false means Mongoose won't create an _id for subdocuments of this type


// Sub-schema for individual payment records
const PaymentRecordSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    paymentIntentId: { // Stripe Payment Intent ID
        type: String,
        trim: true,
        default: null,
    },
    method: { // e.g., 'card', 'cash', 'bank_transfer', 'stripe'
        type: String,
        default: 'stripe',
    },
    notes: { // Any notes about this specific payment
        type: String,
        trim: true,
        default: '',
    }
}, { _id: true }); // Ensure _id is generated for each payment record


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
        default: null,
    },
    invoiceNumber: {
        type: String,
        required: true,
        unique: true, // Invoice numbers should be unique per company (or globally)
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'void', 'refunded'], // Added 'refunded'
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
    lineItems: [LineItemSchema], // <--- Reference to LineItemSchema here
    subtotal: {
        type: Number,
        required: true,
        default: 0,
    },
    taxAmount: {
        type: Number,
        default: 0,
    },
    total: { // This is the total amount of the invoice
        type: Number,
        required: true,
        default: 0,
    },
    // --- NEW FIELDS FOR PARTIAL PAYMENTS ---
    payments: [PaymentRecordSchema], // Array to store individual payment transactions
    balanceDue: { // Calculated field: total - sum of payments
        type: Number,
        required: true,
        default: 0,
    },
    // --- END NEW FIELDS ---
    notes: {
        type: String,
        trim: true,
    },
    currency: {
        code: { type: String, default: 'GBP' },
        symbol: { type: String, default: '£' },
    },
    lastInvoiceReminderSent: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps
});

// --- Pre-save hook to calculate balanceDue and update status ---
InvoiceSchema.pre('save', function (next) {
    this.updatedAt = Date.now(); // Update updatedAt timestamp

    // Calculate total amount paid from the payments array
    const totalPaymentsMade = this.payments.reduce((sum, payment) => sum + payment.amount, 0);

    // Set amountPaid (for backward compatibility if needed, though 'payments' array is primary)
    // This 'amountPaid' field might become redundant if 'payments' array is the source of truth
    // For now, let's keep it in sync.
    this.amountPaid = totalPaymentsMade;

    // Calculate balance due
    this.balanceDue = this.total - totalPaymentsMade;

    // Update status based on payment and due date
    if (this.balanceDue <= 0.01) { // Use a small epsilon for floating point comparisons
        this.status = 'paid';
    } else if (totalPaymentsMade > 0 && this.balanceDue > 0) {
        this.status = 'partially_paid';
    } else if (this.status !== 'void' && this.status !== 'draft' && this.status !== 'refunded') {
        // Only mark as overdue if not void/draft/refunded and not fully/partially paid
        const now = new Date();
        if (this.dueDate < now) {
            this.status = 'overdue';
        } else {
            this.status = 'sent'; // Default to 'sent' if not paid, not overdue, not draft
        }
    }
    // If status is 'draft', it remains 'draft' until explicitly sent.
    // If status is 'void' or 'refunded', it should remain so.

    next();
});

// Ensure invoiceNumber is unique per company
InvoiceSchema.index({ company: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);