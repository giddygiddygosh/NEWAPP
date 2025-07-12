// backend/routes/publicRoutes.js

const express = require('express');
const router = express.Router();
const { submitPublicForm, getPublicFormById, getPublicFormByPurpose } = require('../controllers/publicFormController');

console.log('DEBUG: publicRoutes.js loaded and defining routes.'); // ADDED DEBUG LOG

// @route   GET /api/public/forms/purpose/:purpose
// @desc    Get a form by purpose for public viewing (e.g., get the 'customer_quote' form)
// IMPORTANT: This more specific route MUST come before /api/public/forms/:id
router.get('/forms/purpose/:purpose', getPublicFormByPurpose);

// @route   GET /api/public/forms/:id
// @desc    Get a form by ID for public viewing (e.g., for direct links or embed)
router.get('/forms/:id', getPublicFormById);

// @route   POST /api/public/forms/:id/submit
// @desc    Submit data to a public form
router.post('/forms/:id/submit', submitPublicForm);

module.exports = router;
