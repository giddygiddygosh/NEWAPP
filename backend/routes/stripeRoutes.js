const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Correctly import all 3 functions from the final controller
const {
    createPaymentIntent,
    generateConnectUrl,
    finalizeStripeConnection
} = require('../controllers/stripeController');


// 1. Route for creating a payment on an invoice
router.post('/create-payment-intent', protect, createPaymentIntent);

// 2. Route to get the Stripe Connect link for settings
router.get('/connect/oauth-url', protect, generateConnectUrl);

// 3. The CORRECT route for finalizing the connection
// This is a POST route that your frontend calls after the redirect.
router.post('/connect/finalize', protect, finalizeStripeConnection);


module.exports = router;