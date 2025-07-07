// ServiceOS/backend/routes/leadRoutes.js

const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');

const {
    createLead,
    getLeads,
    getLeadById,
    updateLead,
    deleteLead,
    bulkDeleteLeads,
    markLeadAsConverted,
    bulkUploadLeads,
} = require('../controllers/leadController');

// ✅ FIXED: Added 'admin' to all relevant authorize() calls

router.route('/')
    .post(protect, authorize('admin', 'manager', 'staff'), createLead)
    .get(protect, authorize('admin', 'manager', 'staff'), getLeads);

router.post('/bulk-delete', protect, authorize('admin', 'manager'), bulkDeleteLeads);
router.post('/bulk-upload', protect, authorize('admin', 'manager'), bulkUploadLeads);

router.route('/:id')
    .get(protect, authorize('admin', 'manager', 'staff'), getLeadById)
    .put(protect, authorize('admin', 'manager', 'staff'), updateLead)
    .delete(protect, authorize('admin'), deleteLead);

router.post('/:id/mark-converted', protect, authorize('admin', 'manager', 'staff'), markLeadAsConverted);

module.exports = router;