// controllers/stripeController.js

const asyncHandler = require('express-async-handler');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Company = require('../models/Company'); // Make sure this path is correct

const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID;
const REDIRECT_URI = `${process.env.FRONTEND_URL}/settings`;

/**
 * @desc    Generate a Stripe Connect OAuth URL
 * @route   GET /api/stripe/connect/oauth-url
 * @access  Private
 */
const generateConnectUrl = asyncHandler(async (req, res) => {
    // ... this function is correct
    if (!STRIPE_CLIENT_ID || !process.env.FRONTEND_URL) {
        console.error('Backend: Stripe Client ID or FRONTEND_URL is not configured.');
        return res.status(500).json({ message: 'Stripe Connect is not configured.' });
    }
    const state = req.user.company._id.toString();
    const connectUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${STRIPE_CLIENT_ID}&scope=read_write&redirect_uri=${REDIRECT_URI}&state=${state}`;
    res.status(200).json({ connectUrl });
});

/**
 * @desc    Finalize the Stripe connection after redirect
 * @route   POST /api/stripe/connect/finalize
 * @access  Private
 */
const finalizeStripeConnection = asyncHandler(async (req, res) => {
    // ... this function is correct
    const { code, state } = req.body;
    const companyId = req.user.company._id.toString();

    if (!code) { return res.status(400).json({ message: 'Authorization code is missing.' }); }
    if (!state || state !== companyId) { return res.status(400).json({ message: 'Invalid state parameter.' }); }

    try {
        const companyLock = await Company.findOneAndUpdate(
            { _id: companyId, isConnectingStripe: false },
            { $set: { isConnectingStripe: true } },
            { new: true }
        );

        if (!companyLock) {
            return res.status(429).json({ message: 'Connection process already in progress. Please wait.' });
        }
        
        if (companyLock.stripeAccountId) {
            await Company.findByIdAndUpdate(companyId, { $set: { isConnectingStripe: false } });
            return res.status(200).json({ success: true, message: 'Stripe account already connected.' });
        }

        const response = await stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code,
        });

        const connectedAccountId = response.stripe_user_id;
        if (!connectedAccountId) {
            throw new Error('stripe_user_id not returned from Stripe.');
        }

        const account = await stripe.accounts.retrieve(connectedAccountId);

        await Company.findByIdAndUpdate(companyId, {
            stripeAccountId: connectedAccountId,
            stripeDetailsSubmitted: account.details_submitted,
        });

        res.status(200).json({ success: true, message: 'Stripe account connected successfully.' });

    } catch (error) {
        console.error('Stripe Connect Finalization Error:', error);
        res.status(500).json({ message: error.raw?.message || 'Failed to connect Stripe account.' });
    } finally {
        await Company.findByIdAndUpdate(req.user.company._id.toString(), { $set: { isConnectingStripe: false } });
    }
});


/**
 * @desc    Create a Payment Intent for a specific amount
 * @route   POST /api/stripe/create-payment-intent
 * @access  Private
 */
const createPaymentIntent = asyncHandler(async (req, res) => {
    const { amount, currency, description, metadata = {} } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Amount is required and must be a positive number.' });
    }

    // --- FIX: Correctly fetch the company and its stripeAccountId ---
    // We must use .select('+stripeAccountId') because it's hidden by default in your schema
    const company = await Company.findById(req.user.company._id).select('+stripeAccountId');
    
    if (!company) {
        return res.status(404).json({ message: 'Company not found for this user.' });
    }
    
    const stripeAccountId = company.stripeAccountId;
    if (!stripeAccountId) {
        return res.status(400).json({ message: 'Cannot process payment: This company has not connected their Stripe account.' });
    }

    try {
        // Create a Payment Intent on behalf of the connected account
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Amount in cents/pence
            currency: currency || 'gbp',
            description: description || 'Payment for service',
            // Example: 1% platform fee (amount in cents * 0.01)
            application_fee_amount: Math.round(amount * 100 * 0.01),
            transfer_data: {
                destination: stripeAccountId,
            },
            metadata: {
                companyId: req.user.company._id.toString(),
                userId: req.user.id.toString(),
                ...metadata
            },
        });

        res.status(201).json({
            clientSecret: paymentIntent.client_secret,
        });

    } catch (error) {
        console.error('Stripe Payment Intent Creation Error:', error);
        // Provide a clear error message back to the frontend
        res.status(500).json({ message: error.raw?.message || 'Failed to create payment intent.' });
    }
});


// --- EXPORT THE CORRECT FUNCTIONS ---
module.exports = {
    createPaymentIntent,
    generateConnectUrl,
    finalizeStripeConnection,
};