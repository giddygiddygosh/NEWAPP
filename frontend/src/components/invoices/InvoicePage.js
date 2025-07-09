// frontend/src/components/invoices/InvoicePage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { getInvoices } from '../../services/invoiceService'; 
import InvoiceTable from './InvoiceTable';
import CreateInvoiceModal from './CreateInvoiceModal'; // --- NEW --- Import the modal component

const InvoicePage = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false); // --- NEW --- State to control the modal

    // --- UPDATED --- We wrap the fetch logic in useCallback so it doesn't change on every render
    const fetchInvoices = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getInvoices();
            setInvoices(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch invoices. Please try again later.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch when the component mounts
    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    // --- NEW --- This function is called by the modal after an invoice is created
    const handleInvoiceCreated = () => {
        // We simply re-fetch the list of invoices to show the new one
        fetchInvoices();
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
                <button
                    // --- UPDATED --- Added onClick to open the modal
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center bg-sky-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-sky-700 transition-colors duration-300"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Create Invoice
                </button>
            </header>

            <main>
                {loading && <p className="text-center text-gray-500">Loading invoices...</p>}
                {error && <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>}
                
                {!loading && !error && (
                    <div className="bg-white rounded-lg shadow-md">
                        <InvoiceTable invoices={invoices} />
                    </div>
                )}
            </main>

            {/* --- NEW --- Render the modal component */}
            <CreateInvoiceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onInvoiceCreated={handleInvoiceCreated}
            />
        </div>
    );
};

export default InvoicePage;