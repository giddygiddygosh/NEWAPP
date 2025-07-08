// backend/routes/settingsRoutes.js

const express = require('express');
const router = express.Router();
// FIX: Changed 'settingController' to 'settingsController' to match your actual filename
const { getCompanySettings, updateCompanySettings } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware'); // Your auth middleware

router.route('/')
    // Allow 'admin', 'manager', AND 'staff' roles to GET (read) company settings
    .get(protect, authorize(['admin', 'manager', 'staff']), getCompanySettings)
    // Keep PUT (update) restricted to 'admin' and 'manager'
    .put(protect, authorize(['admin', 'manager']), updateCompanySettings);

module.exports = router;


