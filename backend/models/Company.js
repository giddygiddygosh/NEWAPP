// Located at: ServiceOS/backend/models/Company.js

const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Company name is required.'],
        trim: true,
    },
    appId: {
        type: String,
        required: [true, 'appId is required.'],
        trim: true,
        lowercase: true,
    },
    settings: {
        logoUrl: { type: String, trim: true, default: '' },
        address: {
            street: { type: String, trim: true, default: '' },
            city: { type: String, trim: true, default: '' },
            county: { type: String, trim: true, default: '' },
            postcode: { type: String, trim: true, default: '' },
            country: { type: String, trim: true, default: '' },
        },
        phone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, lowercase: true, default: '' },
        website: { type: String, trim: true, default: '' },
        taxId: { type: String, trim:true, default: '' },
        currency: {
            code: { type: String, default: 'GBP' },
            symbol: { type: String, default: '£' },
            decimalPlaces: { type: Number, default: 2 },
            thousandSeparator: { type: String, default: ',' },
            decimalSeparator: { type: String, default: '.' },
            formatTemplate: { type: String, default: '{symbol}{amount}' },
        },
    },
}, {
    timestamps: true, // This is the correct place for timestamps
});

const Company = mongoose.model('Company', companySchema);

module.exports = Company;
