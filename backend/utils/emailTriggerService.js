// backend/utils/emailTriggerService.js

const EmailTemplate = require('../models/EmailTemplate');
const CompanySetting = require('../models/CompanySetting');
const sendEmail = require('./emailService'); // Your existing email sending utility

/**
 * Fetches an email template, populates placeholders, and sends the email.
 * @param {string} templateType - The ID of the template to use (e.g., 'welcome_email').
 * @param {Object} companyId - The Mongoose ObjectId of the company.
 * @param {string} recipientEmail - The email address to send to.
 * @param {Object} placeholderData - An object containing data for placeholders (e.g., { customerName: 'John Doe' }).
 * @param {string} [triggerSource] - Optional: A string indicating where the trigger came from (for logging).
 * @returns {Promise<boolean>} True if email was attempted to be sent, false otherwise.
 */
const sendTemplatedEmail = async (templateType, companyId, recipientEmail, placeholderData = {}, triggerSource = 'Manual') => {
    // ADDED LOG: Confirm function call
    console.log(`[EmailTriggerService] Attempting to send "${templateType}" email for company ${companyId} to ${recipientEmail}. Trigger Source: ${triggerSource}`);

    try {
        if (!companyId || !recipientEmail || !templateType) {
            console.error(`[EmailService] Missing required data for sendTemplatedEmail (${templateType}): companyId, recipientEmail, or templateType.`);
            return false;
        }

        // 1. Fetch Company Settings to check if this email type is enabled
        const settings = await CompanySetting.findOne({ company: companyId });
        let isEmailEnabled = true; // Default to true if no specific setting found or setting not configured
        let reminderDays = 0; // Default for reminder logic

        if (settings?.emailAutomation && settings.emailAutomation[templateType]) {
            isEmailEnabled = settings.emailAutomation[templateType].enabled;
            reminderDays = settings.emailAutomation[templateType].daysBefore || 0; // For reminder emails
        } else if (settings?.emailAutomation && settings.emailAutomation[`${templateType}_enabled`] !== undefined) {
            // Fallback for older/different naming conventions if you have them (e.g., 'welcome_email_enabled')
            isEmailEnabled = settings.emailAutomation[`${templateType}_enabled`];
        }

        // ADDED LOG: Show the resolved isEmailEnabled status
        console.log(`[EmailTriggerService] Resolved "isEmailEnabled" for ${templateType}: ${isEmailEnabled}`);


        if (!isEmailEnabled) {
            console.log(`[EmailTriggerService] ${templateType} email is disabled in settings for company ${companyId}. Skipping.`);
            return false;
        }

        // 2. Fetch the Email Template from DB
        const template = await EmailTemplate.findOne({ company: companyId, templateType });

        let finalSubject = `[No Subject for ${templateType}]`;
        let finalBody = `Template not found or empty for ${templateType}.`;
        let headerImageUrl = '';

        if (template) {
            finalSubject = template.subject;
            finalBody = template.body;
            headerImageUrl = template.headerImageUrl;
        } else {
            // Use a default fallback if template not in DB (as defined in frontend)
            const defaultTemplate = [
                { id: 'welcome_email', defaultName: 'Welcome Email', description: 'Default welcome email for customers.' },
                { id: 'appointment_reminder', defaultName: 'Appointment Reminder', description: '...' },
                { id: 'job_completion', defaultName: 'Job Completion', description: '...' },
                { id: 'invoice_email', defaultName: 'Invoice Email', description: '...' }, // Add Invoice Email default here
                { id: 'invoice_reminder', defaultName: 'Invoice Reminder', description: '...' },
                { id: 'review_request', defaultName: 'Review Request', description: '...' },
                // --- NEW: Default template for staff welcome email ---
                {
                    id: 'staff_welcome_email',
                    defaultName: 'Staff Welcome Email',
                    description: 'Welcome email for new staff members with login details.',
                    defaultSubject: 'Welcome to {{companyName}}! Your Login Details',
                    defaultBody: `
                        <p>Hello {{userName}},</p>
                        <p>Welcome to {{companyName}}!</p>
                        <p>Your temporary password is: <strong>{{temporaryPassword}}</strong></p>
                        <p>Please log in here: <a href="{{loginLink}}">{{loginLink}}</a></p>
                        <p>We recommend changing your password after your first login.</p>
                        <p>Thanks,</p>
                        <p>The {{companyName}} Team</p>
                    `
                }
            ].find(t => t.id === templateType);

            if (defaultTemplate) {
                finalSubject = defaultTemplate.defaultSubject || `Default ${defaultTemplate.defaultName} Subject`;
                finalBody = defaultTemplate.defaultBody || `Hello {customerName},\n\nThis is a default ${defaultTemplate.defaultName} body.\n\nThanks,\n{companyName}`;
            } else {
                console.warn(`[EmailTriggerService] Unknown template type '${templateType}' and no default found for company ${companyId}.`);
                return false;
            }
        }

        // 3. Populate Placeholders
        for (const key in placeholderData) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            finalSubject = finalSubject.replace(placeholder, placeholderData[key]);
            finalBody = finalBody.replace(placeholder, placeholderData[key]);
        }

        // Add header image to body if present
        if (headerImageUrl) {
            finalBody = `<img src="${process.env.BACKEND_URL}/uploads/${headerImageUrl.split('/').pop()}" alt="Header Image" style="max-width: 100%; height: auto;"><br>` + finalBody;
        }

        // ADDED LOGS: Show the final email content before sending
        console.log(`--- DEBUG: Final Email Content for ${templateType} to ${recipientEmail} ---`);
        console.log('Subject:', finalSubject);
        console.log('Body (HTML/Text) Snippet (first 500 chars):', finalBody.substring(0, 500) + (finalBody.length > 500 ? '...' : ''));
        if (headerImageUrl) {
            console.log('Header Image URL (processed):', `${process.env.BACKEND_URL}/uploads/${headerImageUrl.split('/').pop()}`);
        }
        console.log('------------------------------------------------------------------');


        // 4. Send Email
        await sendEmail(recipientEmail, finalSubject, finalBody.replace(/<[^>]*>?/gm, ''), finalBody); // Assuming sendEmail handles HTML for both text/html

        console.log(`[EmailTriggerService] Sent ${templateType} email to ${recipientEmail} from ${triggerSource} for company ${companyId}.`);
        return true;

    } catch (error) {
        console.error(`[EmailTriggerService] Failed to send ${templateType} email to ${recipientEmail} from ${triggerSource} for company ${companyId}:`, error);
        return false;
    }
};

module.exports = sendTemplatedEmail;