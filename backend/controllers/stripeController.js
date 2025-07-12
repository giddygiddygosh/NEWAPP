const asyncHandler = require('express-async-handler'); // Keep this import
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * @desc Create a Payment Intent for a specific amount
 * @route POST /api/stripe/create-payment-intent
 * @access Private
 */
const createPaymentIntent = async (req, res) => { // <--- REMOVED asyncHandler WRAP HERE TEMPORARILY
    console.log('Backend: createPaymentIntent called.');
    const { amount, currency, description, metadata = {} } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
        console.log('Backend: Validation failed - Invalid amount.');
        return res.status(400).json({ message: 'Amount is required, must be a number, and greater than zero.' }); // <--- Added return
    }
    if (!currency) {
        console.log('Backend: Validation failed - Missing currency.');
        return res.status(400).json({ message: 'Currency is required (e.g., "gbp", "usd").' }); // <--- Added return
    }

    try {
        const stripeAmount = Math.round(amount * 100);
        console.log(`Backend: Attempting to create PaymentIntent for ${stripeAmount} ${currency}`);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: currency.toLowerCase(),
            description: description || 'Payment for ServiceOS service',
            metadata: {
                companyId: req.user.company ? req.user.company.toString() : 'N/A',
                userId: req.user.id ? req.user.id.toString() : 'N/A',
                ...metadata
            },
        });

        console.log('Backend: PaymentIntent created successfully. Client Secret:', paymentIntent.client_secret ? 'EXISTS' : 'MISSING');
        return res.status(201).json({ // <--- Added return here
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status
        });
        console.log('Backend: Response sent with clientSecret.'); // This log will now be unreachable, which is fine.

    } catch (error) {
        console.error('Backend: Caught Stripe Payment Intent Creation Error:', error);
        return res.status(500).json({ message: error.raw ? error.raw.message : 'Failed to create payment intent. Please try again.' }); // <--- Added return
        console.log('Backend: Error response sent.'); // This log will now be unreachable.
    }
};

module.exports = {
    // We will manually wrap createPaymentIntent in asyncHandler in routes if this fix works
    createPaymentIntent,
};