// backend/controllers/stockController.js

const StockItem = require('../models/StockItem');
const mongoose = require('mongoose');

/**
 * @desc Create a new stock item
 * @route POST /api/stock
 * @access Private (Admin, Manager)
 */
exports.createStockItem = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { name, stockQuantity, purchasePrice, salePrice, reorderLevel, unit, notes } = req.body;
        const companyId = req.user.company; // This is the company ID from the authenticated user

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] createStockItem called by user from companyId: ${companyId}`);
        console.log(`[STOCK_DEBUG] Received data for new stock item:`, { name, stockQuantity, purchasePrice, salePrice, reorderLevel, unit, notes });
        // --- END DEBUG LOGS ---

        if (!name || stockQuantity === undefined || purchasePrice === undefined || salePrice === undefined) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Name, quantity, purchase price, and sale price are required.' });
        }
        if (isNaN(stockQuantity) || stockQuantity < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Stock quantity must be a non-negative number.' });
        }
        if (isNaN(purchasePrice) || purchasePrice < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Purchase price must be a non-negative number.' });
        }
        if (isNaN(salePrice) || salePrice <= 0) { // Sale price must be positive
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Sale price must be a positive number.' });
        }

        const newStockItem = new StockItem({
            company: companyId, // Assign the companyId from the authenticated user
            name,
            stockQuantity,
            purchasePrice,
            salePrice,
            reorderLevel: reorderLevel || 0,
            unit: unit || 'pcs',
            notes,
        });

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] Attempting to save new stock item:`, newStockItem);
        // --- END DEBUG LOGS ---

        await newStockItem.save({ session });
        await session.commitTransaction();
        session.endSession();

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] Successfully created stock item with ID: ${newStockItem._id} for company: ${newStockItem.company}`);
        // --- END DEBUG LOGS ---

        res.status(201).json({ message: 'Stock item created successfully', item: newStockItem });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating stock item:', error);
        if (error.code === 11000) {
            // This is the duplicate key error, likely from `name_1` index
            return res.status(400).json({ message: 'A stock item with this name already exists (globally or for your company).' });
        }
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to create stock item.', error: error.message });
    }
};

/**
 * @desc Get all stock items for a company
 * @route GET /api/stock
 * @access Private (Admin, Manager, Staff)
 */
exports.getStockItems = async (req, res) => {
    try {
        const companyId = req.user.company;
        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] getStockItems called for company ID: ${companyId}`);
        // --- END DEBUG LOGS ---

        if (!companyId) { // Add explicit check for missing companyId
            console.error('[getStockItems] Missing company ID in user token.');
            return res.status(400).json({ message: 'User company ID is missing from authentication token. Please re-login.' });
        }

        const stockItems = await StockItem.find({ company: companyId }).sort({ name: 1 });
        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] Found ${stockItems.length} stock items for company ${companyId}.`);
        // --- END DEBUG LOGS ---
        res.status(200).json(stockItems);
    } catch (error) {
        console.error('Error fetching stock items:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Get a single stock item by ID
 * @route GET /api/stock/:id
 * @access Private (Admin, Manager, Staff)
 */
exports.getStockItemById = async (req, res) => {
    try {
        const itemId = req.params.id;
        const companyId = req.user.company;

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] getStockItemById called for item ID: ${itemId}, company ID: ${companyId}`);
        // --- END DEBUG LOGS ---

        const stockItem = await StockItem.findOne({ _id: itemId, company: companyId });

        if (!stockItem) {
            console.warn(`[STOCK_DEBUG] Stock item ${itemId} not found or not authorized for company ${companyId}.`);
            return res.status(404).json({ message: 'Stock item not found.' });
        }
        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] Found stock item: ${stockItem.name}`);
        // --- END DEBUG LOGS ---
        res.status(200).json(stockItem);
    } catch (error) {
        console.error('Error fetching stock item:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Update a stock item by ID
 * @route PUT /api/stock/:id
 * @access Private (Admin, Manager)
 */
exports.updateStockItem = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const itemId = req.params.id;
        const companyId = req.user.company;
        const updates = req.body;

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] updateStockItem called for item ID: ${itemId}, company ID: ${companyId}`);
        console.log(`[STOCK_DEBUG] Updates received:`, updates);
        // --- END DEBUG LOGS ---

        const stockItem = await StockItem.findOne({ _id: itemId, company: companyId }).session(session);

        if (!stockItem) {
            await session.abortTransaction();
            session.endSession();
            console.warn(`[STOCK_DEBUG] Stock item ${itemId} not found or not authorized for company ${companyId} during update.`);
            return res.status(404).json({ message: 'Stock item not found or not authorized.' });
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
            if (key === 'stockQuantity' || key === 'purchasePrice' || key === 'salePrice' || key === 'reorderLevel') {
                stockItem[key] = parseFloat(updates[key]) || 0;
            } else {
                stockItem[key] = updates[key];
            }
        });
        stockItem.updatedAt = Date.now();

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] Attempting to save updated stock item:`, stockItem);
        // --- END DEBUG LOGS ---

        await stockItem.save({ session });
        await session.commitTransaction();
        session.endSession();

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] Successfully updated stock item with ID: ${stockItem._id}`);
        // --- END DEBUG LOGS ---

        res.status(200).json({ message: 'Stock item updated successfully', item: stockItem });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error updating stock item:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A stock item with this name already exists for your company.' });
        }
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to update stock item.', error: error.message });
    }
};

/**
 * @desc Delete a stock item by ID
 * @route DELETE /api/stock/:id
 * @access Private (Admin)
 */
exports.deleteStockItem = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const itemId = req.params.id;
        const companyId = req.user.company;

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] deleteStockItem called for item ID: ${itemId}, company ID: ${companyId}`);
        // --- END DEBUG LOGS ---

        const deletedItem = await StockItem.findOneAndDelete({ _id: itemId, company: companyId }).session(session);

        if (!deletedItem) {
            await session.abortTransaction();
            session.endSession();
            console.warn(`[STOCK_DEBUG] Stock item ${itemId} not found or not authorized for company ${companyId} during deletion.`);
            return res.status(404).json({ message: 'Stock item not found or not authorized.' });
        }

        await session.commitTransaction();
        session.endSession();

        // --- DEBUG LOGS ---
        console.log(`[STOCK_DEBUG] Successfully deleted stock item with ID: ${itemId}`);
        // --- END DEBUG LOGS ---

        res.status(200).json({ message: 'Stock item deleted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting stock item:', error);
        res.status(500).json({ message: 'Failed to delete stock item.', error: error.message });
    }
};

module.exports = {
    createStockItem: exports.createStockItem,
    getStockItems: exports.getStockItems,
    getStockItemById: exports.getStockItemById,
    updateStockItem: exports.updateStockItem,
    deleteStockItem: exports.deleteStockItem,
};