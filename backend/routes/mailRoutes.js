const express = require('express');
const router = express.Router();
const { getRecipientForQuoteRequest } = require('../controllers/mailController');

// Route to get the email address for the customer quote form submissions
router.get('/for-customer-quote', getRecipientForQuoteRequest);

module.exports = router;