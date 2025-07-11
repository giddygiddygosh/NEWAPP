// backend/routes/customerRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

const {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    bulkUploadCustomers, // Ensure this is imported if you use it
    getCustomerStats, // <--- IMPORTANT: Ensure this is imported
} = require('../controllers/customerController'); // Verify path is correct

// --- IMPORTANT: ORDER MATTERS FOR SPECIFICITY ---

// 1. More specific routes should come BEFORE more generic ones.
// This route for customer stats must be before the generic '/:id' route.
router.get('/:id/stats', protect, authorize(['admin', 'manager']), getCustomerStats); // <--- ADD/MOVE THIS LINE HERE

// 2. Standard customer CRUD routes
router.route('/')
    .post(protect, authorize('admin', 'manager', 'staff'), createCustomer)
    .get(protect, authorize('admin', 'manager', 'staff'), getCustomers);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getCustomerById)
    .put(protect, authorize('admin', 'manager', 'staff'), updateCustomer)
    .delete(protect, authorize('admin'), deleteCustomer);

// 3. Other specific routes, like bulk upload
router.post('/bulk-upload', protect, authorize('admin'), bulkUploadCustomers); // Example: Ensure bulkUploadCustomers is correctly imported and handled


module.exports = router;