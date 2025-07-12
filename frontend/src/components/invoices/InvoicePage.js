import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import InvoiceTable from './InvoiceTable';
import Loader from '../common/Loader';
// Removed CreateInvoiceModal import as it will no longer be opened from here
// import CreateInvoiceModal from './CreateInvoiceModal';
import { toast } from 'react-toastify';

const InvoicePage = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Removed isCreateModalOpen state as modal is no longer opened from here
    // const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    // Removed invoiceableJobs and stockItems states as they are not needed here anymore
    // const [invoiceableJobs, setInvoiceableJobs] = useState([]);
    // const [stockItems, setStockItems] = useState([]);

    const fetchInvoices = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/invoices');
            setInvoices(res.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch invoices. Please try again later.');
            console.error(err);
            toast.error("Failed to fetch invoices.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Removed handleOpenCreateModal as button is gone
    // const handleOpenCreateModal = useCallback(async () => { /* ... */ }, []);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    // handleInvoiceCreated is now irrelevant here as this page doesn't create invoices directly
    // const handleInvoiceCreated = (newInvoice) => { /* ... */ };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
                {/* The "Create Invoice" button is now REMOVED */}
                {/* <button onClick={handleOpenCreateModal} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md">
                    Create Invoice
                </button> */}
            </header>

            <main>
                {loading && <div className="text-center py-10"><Loader /></div>}
                {error && <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>}

                {!loading && !error && (
                    <div className="bg-white rounded-lg shadow-md">
                        <InvoiceTable invoices={invoices} />
                    </div>
                )}
            </main>

            {/* The Create Invoice Modal is no longer rendered here */}
            {/* {isCreateModalOpen && (
                <CreateInvoiceModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onInvoiceCreated={handleInvoiceCreated}
                    invoiceableJobs={invoiceableJobs}
                    stockItems={stockItems}
                />
            )} */}
        </div>
    );
};

export default InvoicePage;