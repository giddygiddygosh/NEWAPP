// backend/cron/emailScheduler.js

const cron = require('node-cron');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');
const CompanySetting = require('../models/CompanySetting');
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
                        // Note: Bi-Weekly and 4-Weekly require more complex date logic,
                        // often by checking days since a 'patternStartDate' on the customer model.
                        
                        if (shouldSendToday) {
                            // Find all 'draft' invoices for this customer that are ready to be sent.
                            const draftInvoices = await Invoice.find({
                                customer: customer._id,
                                status: 'draft' // Only send invoices that haven't been sent yet.
                            });

                            if (draftInvoices.length > 0) {
                                console.log(`[Scheduler] Found ${draftInvoices.length} draft invoices for ${customer.contactPersonName}. Sending now.`);
                                for (const invoice of draftInvoices) {
                                    await sendInvoiceEmail(invoice._id, companyId, companyName);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`[Scheduler] Error processing patterned invoices for ${companyName}:`, error);
                }

                // ... (your existing reminder and review request logic remains here) ...
            }
        } catch (error) {
            console.error('[Scheduler] Fatal error during daily automation:', error);
        }
    });

    console.log('[Scheduler] Email automation scheduler started.');
};

module.exports = startEmailScheduler;
