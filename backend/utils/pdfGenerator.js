// backend/utils/pdfGenerator.js

// Make sure you have installed puppeteer: npm install puppeteer
const puppeteer = require('puppeteer');
const path = require('path');
// const fs = require('fs/promises'); // Not strictly needed for returning a buffer, but useful if you save to disk

/**
 * Generates an invoice PDF from invoice data.
 * @param {Object} invoiceData - The full invoice object, including nested customer and job data.
 * Expected structure:
 * {
 * invoiceNumber: string,
 * issueDate: Date,
 * dueDate: Date,
 * companyName: string, // Passed from controller
 * customer: {
 * contactPersonName: string,
 * companyName: string (optional),
 * address: { street: string, city: string, postCode: string, country: string }
 * },
 * lineItems: [{ description: string, quantity: number, unitPrice: number, totalPrice: number }],
 * subtotal: number,
 * taxAmount: number,
 * total: number,
 * currency: { code: string, symbol: string }
 * }
 * @returns {Promise<Buffer>} A Promise that resolves with the PDF file as a Buffer.
 */
const generateInvoicePdfBuffer = async (invoiceData) => {
    let browser; // Declare browser outside try-catch to ensure it's accessible in finally
    try {
        // Launch a headless browser instance
        // 'headless: "new"' is the modern way to specify headless mode
        // args are important for running in production environments (e.g., Docker, Heroku)
        browser = await puppeteer.launch({
            headless: "new", // Use the new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Construct the HTML content for the invoice
        // This is a basic example. For a real application, you'd likely use a dedicated
        // HTML templating engine (like EJS, Pug, Handlebars) to render complex layouts.
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice #${invoiceData.invoiceNumber}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; margin: 40px; color: #333; }
                    .container { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.05); border-radius: 8px;}
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;}
                    .header h1 { color: #0056b3; margin: 0; font-size: 2.5em; }
                    .header h2 { color: #555; margin-top: 5px; font-size: 1.5em; }
                    .header p { margin: 2px 0; font-size: 0.9em; }
                    .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .invoice-details div { width: 48%; }
                    .invoice-details strong { display: block; margin-bottom: 5px; color: #0056b3; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; border-radius: 8px; overflow: hidden;}
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #f2f2f2; color: #333; font-weight: bold; }
                    .total-section { text-align: right; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; }
                    .total-section p { margin: 5px 0; font-size: 1.1em; }
                    .total-section .grand-total { font-size: 1.4em; font-weight: bold; color: #0056b3; }
                    .footer { text-align: center; margin-top: 50px; font-size: 0.8em; color: #777; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Invoice</h1>
                        <h2>${invoiceData.companyName || 'Your Company Name'}</h2>
                        <p>Invoice No: <strong>${invoiceData.invoiceNumber}</strong></p>
                        <p>Issue Date: ${new Date(invoiceData.issueDate).toLocaleDateString('en-GB')}</p>
                        <p>Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString('en-GB')}</p>
                    </div>

                    <div class="invoice-details">
                        <div>
                            <strong>Bill To:</strong><br>
                            ${invoiceData.customer.contactPersonName}<br>
                            ${invoiceData.customer.companyName ? `${invoiceData.customer.companyName}<br>` : ''}
                            ${invoiceData.customer.address.street || ''}<br>
                            ${invoiceData.customer.address.city || ''}, ${invoiceData.customer.address.postCode || ''}<br>
                            ${invoiceData.customer.address.country || ''}
                        </div>
                        <div>
                            <strong>Invoice For:</strong><br>
                            ${invoiceData.job?.serviceType || 'Service Rendered'}
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Total Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoiceData.lineItems.map(item => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.unitPrice.toFixed(2)} ${invoiceData.currency.symbol}</td>
                                    <td>${item.totalPrice.toFixed(2)} ${invoiceData.currency.symbol}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="total-section">
                        <p>Subtotal: ${invoiceData.subtotal.toFixed(2)} ${invoiceData.currency.symbol}</p>
                        <p>Tax (${(invoiceData.taxAmount / invoiceData.subtotal * 100).toFixed(2) || 0}%): ${invoiceData.taxAmount.toFixed(2)} ${invoiceData.currency.symbol}</p>
                        <p class="grand-total">Total: ${invoiceData.total.toFixed(2)} ${invoiceData.currency.symbol}</p>
                    </div>

                    <div class="footer">
                        <p>Thank you for your business!</p>
                        <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Set the content of the page and wait for network to be idle
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Generate the PDF as a Buffer
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Crucial for printing background colors/images
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        return pdfBuffer;
    } catch (error) {
        console.error('[PDF Generator] Error generating PDF:', error);
        throw error; // Re-throw to be caught by the calling function
    } finally {
        if (browser) {
            await browser.close(); // Ensure the browser is closed even if an error occurs
        }
    }
};

module.exports = { generateInvoicePdfBuffer };