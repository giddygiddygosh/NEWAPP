// frontend/src/services/invoiceService.js

import api from '../utils/api'; // Import your configured Axios instance

/**
 * Fetches all invoices from the backend.
 */
export const getInvoices = async () => {
    try {
        const response = await api.get('/invoices');
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message || 'Failed to fetch invoices');
    }
};

/**
 * Fetches a single invoice by its ID from the backend.
 * @param {string} invoiceId - The ID of the invoice to fetch.
 */
export const getInvoiceById = async (invoiceId) => {
    try {
        const response = await api.get(`/invoices/${invoiceId}`); // Make GET request to /invoices/:id
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message || 'Failed to fetch invoice details');
    }
};

/**
 * Fetches all completed jobs that are ready to be invoiced.
 */
export const getInvoiceableJobs = async () => {
    try {
        const response = await api.get('/jobs/invoiceable');
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message || 'Failed to fetch invoiceable jobs');
    }
};

/**
 * Creates a new invoice from a specific job ID.
 * @param {string} jobId - The ID of the job to invoice.
 */
export const createInvoice = async (jobId) => {
    try {
        const response = await api.post('/invoices', { jobId }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message || 'Failed to create invoice');
    }
};

// --- NEW FUNCTION: updateInvoiceStatus ---
/**
 * Updates the status of a specific invoice.
 * @param {string} invoiceId - The ID of the invoice to update.
 * @param {string} newStatus - The new status to set for the invoice.
 * @param {number} [amountPaid] - Optional: Amount paid if status is 'paid' or 'partially_paid'.
 */
export const updateInvoiceStatus = async (invoiceId, newStatus, amountPaid = 0) => {
    try {
        const payload = { status: newStatus };
        if (newStatus === 'paid' || newStatus === 'partially_paid') {
            payload.amountPaid = amountPaid;
        }

        const response = await api.put(`/invoices/${invoiceId}/status`, payload);
        return response.data; // Return the updated invoice data
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message || `Failed to update invoice status to ${newStatus}`);
    }
};