// backend/utils/emailTriggerService.js

const EmailTemplate = require('../models/EmailTemplate');
const CompanySetting = require('../models/CompanySetting');
const sendEmail = require('./emailService'); // Your existing email sending utility

/**
 * Fetches an email template, populates placeholders, and sends the email.
 * @param {string} templateType - The ID of the template to use (e.g., 'welcome_email', 'invoice_email').
 * @param {Object} companyId - The Mongoose ObjectId of the company.
 * @param {string} recipientEmail - The email address to send to.
 * @param {Object} placeholderData - An object containing data for placeholders (e.g., { customerName: 'John Doe' }).
 * @param {string} [triggerSource] - Optional: A string indicating where the trigger came from (for logging).
 * @returns {Promise<boolean>} True if email was attempted to be sent, false otherwise.
 */
const sendTemplatedEmail = async (templateType, companyId, recipientEmail, placeholderData = {}, triggerSource = 'Manual') => {
    console.log(`[EmailTriggerService] Attempting to send "${templateType}" email for company ${companyId} to ${recipientEmail}. Trigger Source: ${triggerSource}`);

    try {
        if (!companyId || !recipientEmail || !templateType) {
            console.error(`[EmailService] Missing required data for sendTemplatedEmail (${templateType}): companyId, recipientEmail, or templateType.`);
            return false;
        }

        // --- MODIFIED LOGIC HERE: Determine if email is enabled ---
        let isEmailEnabled = true; // Assume true by default unless explicitly disabled by company settings for *global* types
        
        // Define customer-specific template types. These will rely on individual customer preferences.
        const customerSpecificTemplates = [
            'customer_welcome_email', // Maps to sendWelcomeEmail on Customer
            'invoice_email',          // Maps to sendInvoiceEmail on Customer
            'invoice_reminder',       // Maps to sendInvoiceReminderEmail on Customer
            'review_request',         // Maps to sendReviewRequestEmail on Customer
            'appointment_reminder',   // Maps to sendAppointmentReminderEmail on Customer
            'send_quote_email',       // Maps to sendQuoteEmail on Customer (assuming this template matches)
        ];

        // Only check global CompanySetting.emailAutomation if it's NOT a customer-specific template type,
        // or if you still want a global override for *all* emails including customer ones.
        // Based on your last comment, you *don't* want a global override for customer emails.
        if (!customerSpecificTemplates.includes(templateType)) {
            const settings = await CompanySetting.findOne({ company: companyId });
            if (settings?.emailAutomation && settings.emailAutomation[templateType]) {
                isEmailEnabled = settings.emailAutomation[templateType].enabled;
            } else if (settings?.emailAutomation && settings.emailAutomation[`${templateType}_enabled`] !== undefined) {
                // Fallback for older/different naming conventions if you have them
                isEmailEnabled = settings.emailAutomation[`${templateType}_enabled`];
            }
        }
        // --- END MODIFIED LOGIC ---

        console.log(`[EmailTriggerService] Resolved "isEmailEnabled" for ${templateType}: ${isEmailEnabled}`);

        if (!isEmailEnabled) {
            console.log(`[EmailTriggerService] ${templateType} email is disabled in company settings. Skipping.`);
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
            const defaultTemplates = [
                {
                    id: 'customer_welcome_email',
                    defaultName: 'Customer Welcome Email',
                    description: 'Default welcome email for new customers with login details.',
                    defaultSubject: 'Welcome to {{companyName}}! Your Customer Portal Login',
                    defaultBody: `
                        <p>Hello {{customerName}},</p>
                        <p>Welcome to {{companyName}}! We are excited to have you as a customer.</p>
                        <p>You can access your dedicated customer portal here: <a href="{{loginLink}}">{{loginLink}}</a></p>
                        <p>Your temporary password is: <strong>{{temporaryPassword}}</strong></p>
                        <p>We recommend changing your password after your first login.</p>
                        <p>If you have any questions, please do not hesitate to contact us.</p>
                        <p>Thanks,</p>
                        <p>The {{companyName}} Team</p>
                    `
                },
                { id: 'welcome_email', defaultName: 'Welcome Email', description: 'Generic welcome email (consider deprecating or renaming if "customer_welcome_email" is primary).', defaultSubject: 'Welcome!', defaultBody: 'Hello {{customerName}},\\n\\nWelcome!\\n\\nThanks,\\n{{companyName}}' },
                { id: 'appointment_reminder', defaultName: 'Appointment Reminder', description: '...', defaultSubject: 'Reminder: Upcoming Appointment with {{companyName}}', defaultBody: '<p>Hi {{customerName}},</p><p>Just a reminder about your upcoming appointment with {{companyName}} on {{appointmentDate}} at {{appointmentTime}}.</p>' },
                { id: 'job_completion', defaultName: 'Job Completion', description: '...', defaultSubject: 'Your Job with {{companyName}} is Complete!', defaultBody: '<p>Hi {{customerName}},</p><p>Your job ({{serviceType}}) has been completed by {{companyName}}.</p>' },
                { id: 'invoice_email', defaultName: 'Invoice Email', description: 'Invoice notification.', defaultSubject: 'Your Invoice from {{companyName}} - #{{invoiceNumber}}', defaultBody: '<p>Hello {{customerName}},</p><p>Please find your invoice #{{invoiceNumber}} for {{invoiceAmount}} attached/linked here: <a href="{{invoiceLink}}">{{invoiceLink}}</a>. It is due by {{dueDate}}.</p>' },
                { id: 'invoice_reminder', defaultName: 'Invoice Reminder', description: '...', defaultSubject: 'Reminder: Invoice #{{invoiceNumber}} is Due Soon', defaultBody: '<p>Hi {{customerName}},</p><p>This is a reminder that your invoice #{{invoiceNumber}} is due on {{dueDate}}.</p>' },
                { id: 'review_request', defaultName: 'Review Request', description: '...', defaultSubject: 'We value your feedback!', defaultBody: '<p>Hello {{customerName}},</p><p>We hope you enjoyed our service. Please consider leaving a review here: {{reviewLink}}</p>' },
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
                },
                { id: 'send_quote_email', defaultName: 'Send Quote Email', description: 'Email for sending a quote to a customer.', defaultSubject: 'Your Quote from {{companyName}}', defaultBody: '<p>Hello {{customerName}},</p><p>Please find your quote from {{companyName}} attached/linked here: {{quoteLink}}</p>' },
            ].find(t => t.id === templateType);

            if (defaultTemplates) {
                finalSubject = defaultTemplates.defaultSubject || `Default ${defaultTemplates.defaultName} Subject`;
                finalBody = defaultTemplates.defaultBody || `Hello {customerName},\\n\\nThis is a default ${defaultTemplates.defaultName} body.\\n\\nThanks,\\n{companyName}`;
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