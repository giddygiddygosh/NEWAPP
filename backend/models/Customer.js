// backend/models/Customer.js

const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    county: { type: String, trim: true, default: '' },
    postcode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' }, // This 'name' field seems a bit redundant in an AddressSchema, but keeping as per your draft.
    payType: { // This seems like a customer-level field, unusual in AddressSchema, but keeping as per your draft.
        type: String,
        enum: ['Fixed', 'Hourly', ''],
        default: '',
    },
    amount: { // This seems like a customer-level field, unusual in AddressSchema, but keeping as per your draft.
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