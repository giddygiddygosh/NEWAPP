const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const {
    getEmailTemplates,
    getEmailTemplateByType,
    updateEmailTemplate,
    deleteEmailTemplate
} = require('../controllers/emailTemplateController');

router.get('/', protect, authorize('admin', 'manager'), getEmailTemplates);
router.get('/:typeId', protect, authorize('admin', 'manager'), getEmailTemplateByType);
router.put('/:typeId', protect, authorize('admin'), upload.single('headerImage'), updateEmailTemplate);
router.delete('/:id', protect, authorize('admin'), deleteEmailTemplate);

module.exports = router;