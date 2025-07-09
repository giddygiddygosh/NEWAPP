// frontend/src/components/invoices/InvoiceDetails.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoiceById, updateInvoiceStatus } from '../../services/invoiceService'; // NEW: Import updateInvoiceStatus
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext'; // NEW: Import useAuth
import Loader from '../common/Loader';
import { CheckCircleIcon, PaperAirplaneIcon, CurrencyDollarIcon, XCircleIcon } from '@heroicons/react/24/outline'; // NEW: Icons

const InvoiceDetails = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const { formatCurrency } = useCurrency();
    const { user } = useAuth(); // NEW: Get user from AuthContext
    
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // NEW: State for status update loading
    const [statusUpdateError, setStatusUpdateError] = useState(null); // NEW: State for status update errors

    useEffect(() => {
        const fetchInvoice = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getInvoiceById(invoiceId);
                setInvoice(data);
            } catch (err) {
                console.error("Error fetching invoice details:", err);
                setError(err.message || 'Failed to load invoice details.');
            } finally {
                setLoading(false);
            }
        };

        if (invoiceId) {
            fetchInvoice();
        }
    }, [invoiceId]);

    // NEW: Handle status change
    const handleStatusChange = async (newStatus) => {
        setIsUpdatingStatus(true);
        setStatusUpdateError(null);
        try {
            const updatedInvoice = await updateInvoiceStatus(invoice._id, newStatus); // Call service function
            setInvoice(updatedInvoice); // Update local state with the new invoice data
            // Optionally, set a success message here that fades away
        } catch (err) {
            console.error(`Error updating invoice status to ${newStatus}:`, err);
            setStatusUpdateError(err.message || `Failed to update status to ${newStatus}.`);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    const statusStyles = {
        paid: 'bg-green-100 text-green-800',
        partially_paid: 'bg-yellow-100 text-yellow-800',
        sent: 'bg-blue-100 text-blue-800',
        overdue: 'bg-red-100 text-red-800',
        draft: 'bg-gray-100 text-gray-800',
        void: 'bg-gray-500 text-white',
    };

    // Determine if the current user has permission to change status
    const canChangeStatus = user?.role === 'admin' || user?.role === 'manager';

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
                <Loader />
                <p className="ml-2 text-gray-600">Loading invoice...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
                <p className="text-red-500 text-center">{error}</p>
                <button onClick={() => navigate('/invoices')} className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                    Back to Invoices
                </button>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="p-8 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
                <p className="text-gray-500 text-center">Invoice not found.</p>
                <button onClick={() => navigate('/invoices')} className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                    Back to Invoices
                </button>
            </div>
        );
    }

    return (
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-4xl mx-auto my-8">
            <header className="flex justify-between items-center border-b pb-4 mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Invoice #{invoice.invoiceNumber}</h1>
                <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusStyles[invoice.status] || statusStyles.draft}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace('_', ' ')}
                    </span>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        Back
                    </button>

                    {/* NEW: Invoice Status Action Buttons */}
                    {canChangeStatus && !isUpdatingStatus && (
                        <>
                            {statusUpdateError && (
                                <p className="text-red-500 text-sm">{statusUpdateError}</p>
                            )}
                            {invoice.status === 'draft' && (
                                <button
                                    onClick={() => handleStatusChange('sent')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                                >
                                    <PaperAirplaneIcon className="h-4 w-4" /> <span>Mark as Sent</span>
                                </button>
                            )}
                            {invoice.status === 'sent' && (
                                <button
                                    onClick={() => handleStatusChange('paid')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                                >
                                    <CheckCircleIcon className="h-4 w-4" /> <span>Mark as Paid</span>
                                </button>
                            )}
                            {/* Add more transitions like 'mark as overdue', 'record partial payment', 'void' */}
                            {(invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'partially_paid') && (
                                <button
                                    onClick={() => handleStatusChange('void')}
                                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center space-x-2"
                                >
                                    <XCircleIcon className="h-4 w-4" /> <span>Void Invoice</span>
                                </button>
                            )}
                        </>
                    )}
                    {isUpdatingStatus && (
                        <span className="text-gray-500 flex items-center space-x-2">
                            <Loader /> <span>Updating...</span>
                        </span>
                    )}
                </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Invoice Details</h3>
                    <p><strong>Issue Date:</strong> {formatDate(invoice.issueDate)}</p>
                    <p><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</p>
                    <p><strong>Total Amount:</strong> {formatCurrency(invoice.total)}</p>
                    <p><strong>Amount Paid:</strong> {formatCurrency(invoice.amountPaid)}</p>
                    {invoice.taxAmount > 0 && <p><strong>Tax Amount:</strong> {formatCurrency(invoice.taxAmount)}</p>}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Customer</h3>
                    <p><strong>Name:</strong> {invoice.customer?.contactPersonName || 'N/A'}</p>
                    {/* You might want to display customer address, email, phone here if populated */}
                    {invoice.job?.customer?.address && (
                        <>
                            <p className="text-sm text-gray-600">{invoice.job.customer.address.street}</p>
                            <p className="text-sm text-gray-600">{invoice.job.customer.address.city}, {invoice.job.customer.address.postcode}</p>
                        </>
                    )}
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Line Items</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {invoice.lineItems.map((item, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.unitPrice)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.totalPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {invoice.notes && (
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes</h3>
                    <p className="text-gray-700">{invoice.notes}</p>
                </section>
            )}
        </div>
    );
};

export default InvoiceDetails;