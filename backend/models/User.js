// backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: [true, 'Firebase UID is required'],
        unique: true,
        trim: true,
        select: false
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: function() {
            return !this.firebaseUid && (this.isNew || this.isModified('email'));
        },
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'staff', 'customer', 'manager'],
        default: 'customer',
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    contactPersonName: {
        type: String,
        required: [true, 'Contact person name is required'],
        trim: true,
        default: ''
    },
    customer: { // Link to customer profile (optional)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: false,
        sparse: true
    },
    staff: { // Link to staff profile (optional)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff', // Correctly references the Staff model
        required: false,
        sparse: true
    },
}, {
    timestamps: true
});

UserSchema.pre('save', async function (next) {
    if (this.password && this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

UserSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    if (!userPassword) return false;
    return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model('User', UserSchema);