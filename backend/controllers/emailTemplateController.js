// backend/controllers/emailTemplateController.js

const EmailTemplate = require('../models/EmailTemplate');
// NOTE: You may need a file utility for uploads. If you don't have one,
// the image upload part of the 'update' function will need to be adjusted.
// const { uploadFile, deleteFile } = require('../utils/fileUpload'); 

const TEMPLATE_TYPES = [
    { id: 'welcome_email', defaultName: 'Welcome Email', description: 'Sent to new customers upon signup.' },
    { id: 'appointment_reminder', defaultName: 'Appointment Reminder', description: 'Reminds customers about upcoming jobs.' },
    { id: 'job_completion', defaultName: 'Job Completion', description: 'Notifies customer that a job is complete.' },
    { id: 'invoice_email', defaultName: 'Invoice Email', description: 'Sends the invoice link or PDF.' },
    { id: 'invoice_reminder', defaultName: 'Invoice Reminder', description: 'Reminds customers about outstanding invoices.' },
    { id: 'review_request', defaultName: 'Review Request', description: 'Asks customers to leave a review after a job.' },
];

const getEmailTemplates = async (req, res) => {
    try {
        const companyId = req.user.company;
        const templatesInDb = await EmailTemplate.find({ company: companyId });

        const finalTemplates = TEMPLATE_TYPES.map(defaultType => {
            const dbTemplate = templatesInDb.find(t => t.templateType === defaultType.id);
            if (dbTemplate) {
                return { ...dbTemplate.toObject(), description: defaultType.description };
            } else {
                return {
                    id: defaultType.id,
                    templateType: defaultType.id,
                    name: defaultType.defaultName,
                    subject: `Default ${defaultType.defaultName} Subject`,
                    body: `Hello {customerName},\n\nThis is a default ${defaultType.defaultName} body.\n\nThanks,\n{companyName}`,
                    headerImageUrl: '',
                    description: defaultType.description,
                };
            }
        });

        res.status(200).json(finalTemplates);
    } catch (error) {
        console.error('Error fetching email templates:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

const getEmailTemplateByType = async (req, res) => {
    try {
        const companyId = req.user.company;
        const { typeId } = req.params;
        const defaultTypeInfo = TEMPLATE_TYPES.find(t => t.id === typeId);
        
        if (!defaultTypeInfo) {
            return res.status(404).json({ message: 'Template type not found.' });
        }

        let template = await EmailTemplate.findOne({ company: companyId, templateType: typeId });

        if (!template) {
            template = {
                id: defaultTypeInfo.id,
                templateType: defaultTypeInfo.id,
                name: defaultTypeInfo.defaultName,
                subject: `Default ${defaultTypeInfo.defaultName} Subject`,
                body: `Hello {customerName},\n\nThis is a default ${defaultTypeInfo.defaultName} body.\n\nThanks,\n{companyName}`,
                headerImageUrl: '',
                description: defaultTypeInfo.description,
            };
        }

        res.status(200).json(template);
    } catch (error) {
        console.error('Error fetching email template by type:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

const updateEmailTemplate = async (req, res) => {
    try {
        const companyId = req.user.company;
        const { typeId } = req.params;
        const { name, subject, body } = req.body;

        // Basic validation
        if (!name || !subject || !body) {
            return res.status(400).json({ message: 'Name, subject, and body are required.' });
        }
        
        // This is a placeholder for image handling logic.
        // For now, it doesn't handle uploads, just the text fields.
        let headerImageUrl = (await EmailTemplate.findOne({ company: companyId, templateType: typeId }))?.headerImageUrl || '';

        const template = await EmailTemplate.findOneAndUpdate(
            { company: companyId, templateType: typeId },
            { name, subject, body, headerImageUrl },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({ message: 'Template saved successfully', template });
    } catch (error) {
        console.error('Error updating email template:', error);
        res.status(500).json({ message: 'Failed to save template' });
    }
};

const deleteEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params; // This is the Mongoose _id
        const template = await EmailTemplate.findOne({ _id: id, company: req.user.company });

        if (!template) {
            return res.status(404).json({ message: 'Template not found.' });
        }

        // Add logic here to delete image from storage if it exists
        // if (template.headerImageUrl) { await deleteFile(template.headerImageUrl); }

        await EmailTemplate.deleteOne({ _id: id });

        res.status(200).json({ message: 'Template has been reset to default.' });
    } catch (error) {
        console.error('Error deleting email template:', error);
        res.status(500).json({ message: 'Failed to delete template.' });
    }
};

// Standardized export block
module.exports = {
    getEmailTemplates,
    getEmailTemplateByType,
    updateEmailTemplate,
    deleteEmailTemplate
};