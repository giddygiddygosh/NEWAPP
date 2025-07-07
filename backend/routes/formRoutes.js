const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createForm,
    getForms,
    getFormById,
    updateForm,
    deleteForm,
} = require('../controllers/formController');

router.route('/')
    .post(protect, authorize('admin'), createForm)
    .get(protect, authorize('admin', 'manager'), getForms);

router.route('/:id')
    .get(protect, authorize('admin', 'manager'), getFormById)
    .put(protect, authorize('admin'), updateForm)
    .delete(protect, authorize('admin'), deleteForm);

module.exports = router;