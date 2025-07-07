const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
} = require('../controllers/customerController');

router.route('/')
    .post(protect, authorize('admin', 'manager', 'staff'), createCustomer)
    .get(protect, authorize('admin', 'manager', 'staff'), getCustomers);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getCustomerById)
    .put(protect, authorize('admin', 'manager', 'staff'), updateCustomer)
    .delete(protect, authorize('admin'), deleteCustomer);

module.exports = router;