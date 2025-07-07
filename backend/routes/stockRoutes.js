const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createStockItem,
    getStockItems,
    getStockItemById,
    updateStockItem,
    deleteStockItem,
} = require('../controllers/stockController');

router.route('/')
    .post(protect, authorize('admin', 'manager'), createStockItem)
    .get(protect, authorize('admin', 'manager', 'staff'), getStockItems);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getStockItemById)
    .put(protect, authorize('admin', 'manager'), updateStockItem)
    .delete(protect, authorize('admin'), deleteStockItem);

module.exports = router;