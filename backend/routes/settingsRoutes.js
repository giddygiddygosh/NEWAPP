// backend/routes/settingsRoutes.js

const express = require('express');
const router = express.Router();
const { getCompanySettings, updateCompanySettings } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
    // --- THIS IS THE LINE TO CHANGE ---
    // Allow 'admin', 'manager', 'staff', AND 'customer' roles to GET (read) company settings
    .get(protect, authorize(['admin', 'manager', 'staff', 'customer']), getCompanySettings)
    // --- END OF CHANGE ---
    
    // Keep PUT (update) restricted to 'admin' and 'manager'
    .put(protect, authorize(['admin', 'manager']), updateCompanySettings);

module.exports = router;

