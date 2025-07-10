// frontend/src/components/invoices/InvoicePage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api'; // Use api directly
import InvoiceTable from './InvoiceTable';
import Loader from '../common/Loader'; // Assuming you have a Loader component

const InvoicePage = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchInvoices = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/invoices'); // Fetch invoices using the api utility
            setInvoices(res.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch invoices. Please try again later.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
                {/* The "Create Invoice" button is now removed from this page */}
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
        </div>
    );
};

export default InvoicePage;
