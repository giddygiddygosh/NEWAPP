// backend/cron/emailScheduler.js

const cron = require('node-cron');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');
const CompanySetting = require('../models/CompanySetting');
// Import the reusable email sending function from our service
const { sendInvoiceEmail } = require('../services/invoiceService');

const startEmailScheduler = () => {
    // Runs daily at 3:00 AM server time.
    cron.schedule('0 3 * * *', async () => {
        console.log('[Scheduler] Running daily email automation tasks...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const companies = await CompanySetting.find({}).populate('company');

            for (const companySetting of companies) {
                if (!companySetting.company?._id) continue;
                
                const companyId = companySetting.company._id;
                const companyName = companySetting.company.name;
                console.log(`[Scheduler] Processing emails for company: ${companyName}`);

                // --- 1. Process Patterned Invoices (NEW LOGIC) ---
                try {
                    const customersWithPatternedInvoices = await Customer.find({
                        company: companyId,
                        sendInvoiceEmail: true,
                        invoiceEmailTrigger: { $in: ['Weekly', 'Bi-Weekly', '4-Weekly', 'Monthly'] },
                    });

                    for (const customer of customersWithPatternedInvoices) {
                        let shouldSendToday = false;
                        const trigger = customer.invoiceEmailTrigger;
                        
                        // Simple logic: send weekly on Friday, monthly on the 1st.
                        if (trigger === 'Weekly' && today.getDay() === 5) { // 5 = Friday
                            shouldSendToday = true;
                        } else if (trigger === 'Monthly' && today.getDate() === 1) {
                            shouldSendToday = true;
                        }
                        // Note: Bi-Weekly and 4-Weekly require more complex date logic.
                        
                        if (shouldSendToday) {
                            // Find all 'draft' invoices for this customer.
                            const draftInvoices = await Invoice.find({
                                customer: customer._id,
                                status: 'draft'
                            });

                            if (draftInvoices.length > 0) {
                                console.log(`[Scheduler] Found ${draftInvoices.length} draft invoices for ${customer.contactPersonName}. Sending now.`);
                                for (const invoice of draftInvoices) {
                                    // Use the centralized service to send the email.
                                    await sendInvoiceEmail(invoice._id, companyId, companyName);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`[Scheduler] Error processing patterned invoices for ${companyName}:`, error);
                }

                // --- 2. Process Invoice Reminders (Your existing logic) ---
                // This will continue to work as expected for any invoice that is 'sent' or 'overdue'.
                // ... your existing reminder logic here ...

                // --- 3. Process Review Requests (Your existing logic) ---
                // ... your existing review request logic here ...
            }
        } catch (error) {
            console.error('[Scheduler] Fatal error during daily automation:', error);
        }
    });

    console.log('[Scheduler] Email automation scheduler started.');
};

module.exports = startEmailScheduler;
