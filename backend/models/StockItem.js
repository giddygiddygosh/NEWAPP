// backend/models/StockItem.js

const mongoose = require('mongoose');

const StockItemSchema = new mongoose.Schema({
    company: { // The company this stock item belongs to
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
    },
    name: {
        type: String,
        required: [true, 'Stock item name is required'],
        trim: true,
        unique: true, // Item name should be unique within a company
    },
    stockQuantity: { // Current quantity on hand
        type: Number,
        required: [true, 'Stock quantity is required'],
        min: 0,
        default: 0,
    },
    unit: { // Unit of measurement (e.g., pcs, kg, m, box)
        type: String,
        enum: ['pcs', 'kg', 'm', 'box', 'litre', 'item'],
        default: 'pcs',
    },
    purchasePrice: { // Cost to acquire one unit
        type: Number,
        required: [true, 'Purchase price is required'],
        min: 0,
        default: 0,
    },
    salePrice: { // Price to sell one unit to a customer (for invoicing)
        type: Number,
        required: [true, 'Sale price is required'],
        min: 0,
        default: 0,
    },
    reorderLevel: { // Quantity at which to reorder
        type: Number,
        min: 0,
        default: 0,
    },
    notes: {
        type: String,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound unique index for name + company to ensure unique names per company
StockItemSchema.index({ name: 1, company: 1 }, { unique: true });

StockItemSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('StockItem', StockItemSchema);