const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// @desc    Get the designated recipient email for a form purpose
// @route   GET /api/mail/for-customer-quote
// @access  Public
const getRecipientForQuoteRequest = asyncHandler(async (req, res) => {
    // For now, we'll find the first user with the role 'admin'.
    // In a more complex setup, you might have a specific setting for this.
    const adminUser = await User.findOne({ role: 'admin' }).select('email');

    if (!adminUser) {
        // 404 is appropriate if no admin user is configured to receive emails.
        return res.status(404).json({ message: 'No recipient configured for quote requests.' });
    }

    res.status(200).json({ recipientEmail: adminUser.email });
});

module.exports = {
    getRecipientForQuoteRequest,
};