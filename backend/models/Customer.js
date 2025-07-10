const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    county: { type: String, trim: true, default: '' },
    postcode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    payType: {
        type: String,
        enum: ['Fixed', 'Hourly', ''],
        default: '',
    },
    amount: {
        type: Number,
        default: 0,
    },
}, { _id: false });

const EmailPreferenceSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        unique: false,
    },
    enabled: {
        type: Boolean,
        default: true,
    },
    daysOffset: {
        type: Number,
        default: 0,
    },
}, { _id: false });


const customerSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    companyName: {
        type: String,
        trim: true,
    },
    contactPersonName: {
        type: String,
        required: [true, 'Contact person name is required'],
        trim: true,
    },
    email: {
        type: [new mongoose.Schema({
            email: {
                type: String, trim: true, lowercase: true,
                required: [true, 'Email address is required.'],
                match: [/.+@.+\..+/, 'Please fill a valid email address'],
            },
            label: { type: String, trim: true, default: 'Primary' },
            isMaster: { type: Boolean, default: false },
        }, { _id: false })],
        default: [],
        validate: {
            validator: function(v) {
                const masterEmails = v.filter(e => e.isMaster);
                return masterEmails.length <= 1;
            },
            message: props => `Only one master email is allowed.`
        }
    },
    phone: {
        type: [new mongoose.Schema({
            number: { type: String, trim: true, required: [true, 'Phone number is required.'] },
            label: { type: String, trim: true, default: 'Primary' },
            isMaster: { type: Boolean, default: false },
        }, { _id: false })],
        default: [],
        validate: {
            validator: function(v) {
                const masterPhones = v.filter(p => p.isMaster);
                return masterPhones.length <= 1;
            },
            message: props => `Only one master phone number is allowed.`
        }
    },
    address: {
        type: AddressSchema,
        default: {}
    },
    serviceAddresses: {
        type: [AddressSchema],
        default: []
    },
    salesPersonName: {
        type: String,
        trim: true,
        default: ''
    },
    commissionEarned: {
        type: Number,
        default: 0
    },
    convertedFromLead: {
        type: mongoose.Schema.ObjectId,
        ref: 'Lead',
        sparse: true
    },
    customerType: {
        type: String,
        trim: true,
        default: ''
    },
    industry: {
        type: String,
        trim: true,
        default: ''
    },
    emailPreferences: { // Already exists, but for clarity on specific preferences
        type: [EmailPreferenceSchema],
        default: [],
    },
    // --- NEW FIELDS FOR AUTOMATED EMAIL SETTINGS ---
    // Welcome Email
    sendWelcomeEmail: {
        type: Boolean,
        default: true,
    },
    // Invoice Email
    sendInvoiceEmail: {
        type: Boolean,
        default: true,
    },
    invoiceEmailTrigger: { // e.g., 'On Completion', 'Weekly', 'Bi-Weekly', 'Monthly'
        type: String,
        enum: ['On Completion', 'Weekly', 'Bi-Weekly', '4-Weekly', 'Monthly', ''],
        default: 'On Completion',
    },
    invoicePatternStartDate: { // <--- ADD THIS FIELD FOR PATTERNED INVOICING
        type: Date,
        default: null, // It should be null if not a patterned trigger
    },
    // Invoice Reminder
    sendInvoiceReminderEmail: {
        type: Boolean,
        default: false,
    },
    invoiceReminderDaysOffset: { // Days after due date
        type: Number,
        default: 7, // Default to 7 days after
        min: 0,
    },
    // Review Request
    sendReviewRequestEmail: {
        type: Boolean,
        default: false,
    },
    reviewRequestDaysOffset: { // Days after job completion
        type: Number,
        default: 3, // Default to 3 days after
        min: 0,
    },
    // Appointment Reminder
    sendAppointmentReminderEmail: {
        type: Boolean,
        default: true,
    },
    appointmentReminderDaysOffset: { // Days *before* appointment
        type: Number,
        default: 1, // Default to 1 day before
        min: 0,
    },
    // Quote Email
    sendQuoteEmail: {
        type: Boolean,
        default: true,
    },
    // --- END NEW FIELDS ---
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

customerSchema.pre('save', function(next) {
    if (this.email && this.email.length > 0 && this.email.filter(e => e.isMaster).length === 0) {
        this.email[0].isMaster = true;
    }
    if (this.phone && this.phone.length > 0 && this.phone.filter(p => p.isMaster).length === 0) {
        this.phone[0].isMaster = true;
    }
    this.updatedAt = Date.now();
    next();
});


module.exports = mongoose.model('Customer', customerSchema);