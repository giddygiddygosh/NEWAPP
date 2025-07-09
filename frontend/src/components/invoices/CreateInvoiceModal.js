// frontend/src/components/invoices/CreateInvoiceModal.jsx

import React, { useState, useEffect } from 'react';
import { getInvoiceableJobs, createInvoice } from '../../services/invoiceService';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCurrency } from '../context/CurrencyContext';

const CreateInvoiceModal = ({ isOpen, onClose, onInvoiceCreated }) => {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    const { formatCurrency } = useCurrency();

    useEffect(() => {
        if (isOpen) {
            const fetchJobs = async () => {
                setLoading(true);
                setError('');
                try {
                    const data = await getInvoiceableJobs();
                    setJobs(data);
                } catch (err) {
                    setError('Failed to load completed jobs. Please try again.');
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };
            fetchJobs();
        } else {
            setJobs([]);
            setSelectedJobId('');
            setError('');
        }
    }, [isOpen]);

    const handleGenerateInvoice = async () => {
        if (!selectedJobId) {
            setError('Please select a job to invoice.');
            return;
        }
        setIsCreating(true);
        setError('');
        try {
            const newInvoice = await createInvoice(selectedJobId);
            // This function (passed from the parent) will refresh the invoice list
            onInvoiceCreated(newInvoice); 
            // This function (passed from the parent) closes the modal
            onClose(); 
        } catch (err) {
            setError(err.message || 'Failed to create invoice.');
            console.error(err);
        } finally {
            // This ensures the button returns to its normal state even if an error occurs
            setIsCreating(false); 
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <header className="flex justify-between items-center pb-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Create New Invoice</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
                        <XMarkIcon className="h-6 w-6 text-gray-600" />
                    </button>
                </header>
                
                <main className="py-6 max-h-[60vh] overflow-y-auto">
                    {loading && <p className="text-center">Loading completed jobs...</p>}
                    {error && <p className="text-red-500 bg-red-50 p-3 rounded-md text-center">{error}</p>}
                    
                    {!loading && !error && (
                        jobs.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Select a completed job to generate an invoice:</p>
                                {jobs.map(job => (
                                    <label key={job._id} className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${selectedJobId === job._id ? 'bg-sky-50 border-sky-500 shadow-sm' : 'border-gray-300 hover:border-sky-400'}`}>
                                        <input
                                            type="radio"
                                            name="jobSelection"
                                            value={job._id}
                                            checked={selectedJobId === job._id}
                                            onChange={() => setSelectedJobId(job._id)}
                                            className="h-4 w-4 text-sky-600 border-gray-300 focus:ring-sky-500"
                                        />
                                        <div className="ml-4 flex-grow">
                                            <p className="font-semibold text-gray-800">{job.serviceType}</p>
                                            <p className="text-sm text-gray-500">For: {job.customer.contactPersonName}</p>
                                        </div>
                                        <p className="text-sm font-medium text-gray-700">{formatCurrency(job.price)}</p>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">No invoiceable jobs found.</p>
                        )
                    )}
                </main>
                
                <footer className="flex justify-end pt-4 border-t space-x-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                        disabled={isCreating}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerateInvoice}
                        className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-sky-300"
                        disabled={isCreating || !selectedJobId}
                    >
                        {isCreating ? 'Generating...' : 'Generate Invoice'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CreateInvoiceModal;