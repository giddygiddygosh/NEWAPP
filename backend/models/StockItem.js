// backend/models/StockItem.js

const mongoose = require('mongoose');

const StockItemSchema = new mongoose.Schema({
    company: { 
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    name: {
        type: String,
        required: [true, 'Stock item name is required'],
        trim: true,
        // unique: true, // <-- REMOVE THIS LINE
    },
    stockQuantity: {
        type: Number,
        required: [true, 'Stock quantity is required'],
        min: 0,
        default: 0,
    },
    unit: {
        type: String,
        enum: ['pcs', 'kg', 'm', 'box', 'litre', 'item'],
        default: 'pcs',
    },
    purchasePrice: {
        type: Number,
        required: [true, 'Purchase price is required'],
        min: 0,
        default: 0,
    },
    salePrice: {
        type: Number,
        required: [true, 'Sale price is required'],
        min: 0,
        default: 0,
    },
    reorderLevel: {
        type: Number,
        min: 0,
        default: 0,
    },
    notes: {
        type: String,
        trim: true,
    },
}, { timestamps: true }); // Mongoose handles createdAt and updatedAt with this option

// This is now the ONLY unique rule and it's correct.
StockItemSchema.index({ name: 1, company: 1 }, { unique: true });

// You can remove the pre-save hook for 'updatedAt' if you use the timestamps option.
// StockItemSchema.pre('save', function(next) {
//     this.updatedAt = Date.now();
//     next();
// });

module.exports = mongoose.model('StockItem', StockItemSchema);