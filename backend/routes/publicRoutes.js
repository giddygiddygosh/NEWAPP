// backend/routes/publicRoutes.js

const express = require('express');
const router = express.Router();
const { submitPublicForm, getPublicFormById } = require('../controllers/publicFormController'); // Corrected import

// @route   GET /api/public/forms/:id
// @desc    Get a form by ID for public viewing
router.get('/:id', getPublicFormById);

// @route   POST /api/public/forms/:id/submit
// @desc    Submit data to a public form
router.post('/:id/submit', submitPublicForm);

module.exports = router;