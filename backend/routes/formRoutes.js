const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware'); // Your auth middleware
const {
    createForm,
    getForms,
    getFormById,
    updateForm,
    deleteForm,
    activateForm,
    deactivateForm, // <-- Import the new deactivateForm function
} = require('../controllers/formController'); // Ensure this path points to the file above

router.route('/')
    .post(protect, authorize('admin'), createForm)
    .get(protect, authorize('admin', 'manager'), getForms);

// Route for activating a form
router.route('/:id/activate')
    .put(protect, authorize('admin'), activateForm);

// Route for deactivating a form (NEW)
router.route('/:id/deactivate')
    .put(protect, authorize('admin'), deactivateForm); // <-- NEW ROUTE DEFINITION

router.route('/:id')
    .get(protect, authorize('admin', 'manager'), getFormById)
    .put(protect, authorize('admin'), updateForm)
    .delete(protect, authorize('admin'), deleteForm);

module.exports = router;