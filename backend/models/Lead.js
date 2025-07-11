const mongoose = require('mongoose');

// NEW: Sub-schema for Email Contact (Mirroring Customer's)
const EmailContactSchema = new mongoose.Schema({
    email: {
        type: String,
        trim: true,
        lowercase: true,
        required: [true, 'Email address is required.'], // This requires at least one valid email to be present
        match: [/.+@.+\..+/, 'Please fill a valid email address'],
    },
    label: {    
        type: String,
        trim: true,
        default: 'Primary',
    },
    isMaster: {    
        type: Boolean,
        default: false,
    },
}, { _id: false });

// NEW: Sub-schema for Phone Contact (Mirroring Customer's)
const PhoneContactSchema = new mongoose.Schema({
    number: {
        type: String,
        trim: true,
        required: [true, 'Phone number is required.'], // You may want to make phone number optional if not always provided
    },
    label: {    
        type: String,
        trim: true,
        default: 'Primary',
    },
    isMaster: {    
        type: Boolean,
        default: false,
    },
}, { _id: false });

// Reusable Address Schema for Lead    
const AddressSchema = new mongoose.Schema({
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    county: { type: String, trim: true },
    postcode: { type: String, trim: true },
    country: { type: String, trim: true },
}, { _id: false });

const LeadSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    companyName: {
        type: String,
        trim: true,
    },
    contactPersonName: {
        type: String,
        required: [true, 'Contact person name is required'], // REQUIRED FIELD
        trim: true,
    },
    // MODIFIED: 'email' field is now an array of EmailContactSchema
    email: {
        type: [EmailContactSchema],
        default: [],    
        validate: {
            validator: function(v) {
                // At least one email object must exist and have a non-empty email property if the array is not empty
                const hasAtLeastOneEmail = v.length === 0 || v.some(e => e.email && e.email.trim() !== '');
                if (!hasAtLeastOneEmail) {
                    return false; // Fail validation if no emails provided or all are empty
                }
                const masterEmails = v.filter(e => e.isMaster);
                return masterEmails.length <= 1; // Only one master email allowed
            },
            message: props => `At least one valid email address is required, and only one master email is allowed.` // CUSTOM ERROR MESSAGE
        }
    },
    // MODIFIED: 'phone' field is now an array of PhoneContactSchema
    phone: {
        type: [PhoneContactSchema],
        default: [],    
        validate: {
            validator: function(v) {
                // If you want phone to be strictly required for leads, uncomment the next line
                // if (v.length === 0 || v.every(p => !p.number || p.number.trim() === '')) {
                //     return false; // Fail validation if no phones provided or all are empty
                // }
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
    leadStatus: {
        type: String,
        // UPDATED: Added 'New Quote Request' to enum
        enum: ['New', 'New Quote Request', 'Contacted', 'Qualified', 'Unqualified', 'Converted'],
        default: 'New',
    },
    leadSource: {
        type: String,
        // UPDATED: Added 'Website Quote Form' to enum
        enum: ['Website', 'Referral', 'Social Media', 'Cold Call', 'Other', 'Website Quote Form'],
        default: 'Other',
    },
    notes: {
        type: String,
        trim: true,
    },
    salesPersonName: {
        type: String,
        trim: true,
        default: ''
    },
    commissionType: {
        type: String,
        enum: ['Fixed Amount', 'Percentage', 'None'],
        default: 'None',
    },
    commissionValue: {
        type: Number,
        default: 0,
    },
    commissionEarned: {
        type: Number,
        default: 0
    },
    conversionDate: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    // NEW: Link to form submission if created from one
    formSubmission: {
        type: mongoose.Schema.ObjectId,
        ref: 'Submission',
        sparse: true, // Allow null values and partial indexes
    },
});

// Pre-save hook to ensure the first email/phone is master if no master exists and array is not empty
LeadSchema.pre('save', function (next) {
    if (this.email && this.email.length > 0 && this.email.filter(e => e.isMaster).length === 0) {
        this.email[0].isMaster = true;
    }
    if (this.phone && this.phone.length > 0 && this.phone.filter(p => p.isMaster).length === 0) {
        this.phone[0].isMaster = true;
    }
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Lead', LeadSchema);