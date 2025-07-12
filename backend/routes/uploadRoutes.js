const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { createPaymentIntent } = require('../controllers/stripeController');
const asyncHandler = require('express-async-handler'); // <--- ADDED: Import asyncHandler here

/**
 * @route POST /api/stripe/create-payment-intent
 * @desc Create a Stripe Payment Intent (to prepare for a payment)
 * @access Private (Accessible by authenticated users who need to make payments)
 */
router.post(
    '/create-payment-intent',
    protect,
    authorize(['admin', 'manager', 'staff', 'customer']),
    asyncHandler(createPaymentIntent) // <--- WRAP createPaymentIntent IN asyncHandler HERE
);

module.exports = router;