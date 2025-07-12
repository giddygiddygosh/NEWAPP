const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware'); // Assuming your auth middleware is here
const { createPaymentIntent } = require('../controllers/stripeController'); // Import the controller function

/**
 * @route POST /api/stripe/create-payment-intent
 * @desc Endpoint for the frontend to request creation of a Stripe Payment Intent.
 * This is the first step in a Stripe payment flow.
 * @access Private (Accessible by all roles who are authorized to make payments)
 */
router.post('/create-payment-intent', protect, authorize(['admin', 'manager', 'staff', 'customer']), createPaymentIntent);

// Additional Stripe-related routes (e.g., for processing webhooks, managing subscriptions, etc.)
// would be added here as your application's payment features expand.

module.exports = router;