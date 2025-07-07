const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getCompanySettings,
    updateCompanySettings,
} = require('../controllers/settingsController');

router.route('/')
    .get(protect, authorize('admin', 'manager'), getCompanySettings)
    .put(protect, authorize('admin'), updateCompanySettings);

module.exports = router;