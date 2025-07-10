// frontend/src/components/invoices/InvoiceDetails.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api'; // Use api directly
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import Loader from '../common/Loader';
import { CheckCircleIcon, PaperAirplaneIcon, CurrencyDollarIcon, XCircleIcon } from '@heroicons/react/24/outline';

const InvoiceDetails = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const { formatCurrency } = useCurrency();
    const { user } = useAuth();
    
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [statusUpdateError, setStatusUpdateError] = useState(null);

    useEffect(() => {
        const fetchInvoice = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get(`/invoices/${invoiceId}`);
                setInvoice(res.data);
            } catch (err) {
                console.error("Error fetching invoice details:", err);
                setError(err.response?.data?.message || 'Failed to load invoice details.');
            } finally {
                setLoading(false);
            }
        };

        if (invoiceId) {
            fetchInvoice();
        }
    }, [invoiceId]);

    const handleStatusChange = async (newStatus) => {
        setIsUpdatingStatus(true);
        setStatusUpdateError(null);
        try {
            const payload = { status: newStatus };
            if (newStatus === 'paid') {
                payload.amountPaid = invoice.total;
            }
            const updatedInvoice = await api.put(`/invoices/${invoice._id}/status`, payload);
            setInvoice(updatedInvoice.data);
        } catch (err) {
            console.error(`Error updating invoice status to ${newStatus}:`, err);
            setStatusUpdateError(err.response?.data?.message || `Failed to update status.`);
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

    const canChangeStatus = user?.role === 'admin' || user?.role === 'manager';

    if (loading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><Loader /></div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">{error}</div>;
    }

    if (!invoice) {
        return <div className="p-8 text-center text-gray-500">Invoice not found.</div>;
    }
    
    // Helper to format an address object into an array of lines
    const getAddressLines = (addr) => {
        if (!addr) return [];
        return [
            addr.street,
            addr.city,
            addr.county,
            addr.postcode,
            addr.country
        ].filter(Boolean); // Filter out any empty or null parts
    };

    return (
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-4xl mx-auto my-8">
            <header className="flex justify-between items-center border-b pb-4 mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Invoice #{invoice.invoiceNumber}</h1>
                <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusStyles[invoice.status] || statusStyles.draft}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace('_', ' ')}
                    </span>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Back</button>
                </div>
            </header>

            {/* --- UPDATED: Company, Customer, and Invoice Details Section --- */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Left Column */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">From</h3>
                    <p className="font-bold text-lg text-gray-800">{invoice.company?.name || 'Your Company'}</p>
                    {getAddressLines(invoice.company?.address).map((line, index) => (
                        <p key={index} className="text-gray-600">{line}</p>
                    ))}
                    {invoice.company?.vatNumber && <p className="text-gray-600 mt-1">VAT #: {invoice.company.vatNumber}</p>}
                    
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mt-6 mb-2">Invoice Details</h3>
                    <p className="text-sm text-gray-800"><strong>Issue Date:</strong> {formatDate(invoice.issueDate)}</p>
                    <p className="text-sm text-gray-800"><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</p>
                </div>
                
                {/* Right Column */}
                <div className="text-left md:text-right">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Billed To</h3>
                    <p className="font-bold text-lg text-gray-800">{invoice.customer?.contactPersonName || 'N/A'}</p>
                    {getAddressLines(invoice.job?.address || invoice.customer?.address).map((line, index) => (
                        <p key={index} className="text-gray-600">{line}</p>
                    ))}

                    {invoice.job?.staff && invoice.job.staff.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase mt-6 mb-2">Serviced By</h3>
                            <p className="font-bold text-gray-800">{invoice.job.staff.map(s => s.contactPersonName).join(', ')}</p>
                        </>
                    )}
                </div>
            </section>
            
            <section className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Line Items</h3>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {invoice.lineItems.map((item, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(item.unitPrice)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(item.totalPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            
            <section className="flex justify-end mb-8">
                <div className="w-full md:w-2/5">
                    <div className="flex justify-between py-2 border-b">
                        <span className="font-semibold text-gray-600">Subtotal:</span>
                        <span className="text-gray-800">{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    {invoice.taxAmount > 0 && (
                        <div className="flex justify-between py-2 border-b">
                            <span className="font-semibold text-gray-600">Tax (VAT):</span>
                            <span className="text-gray-800">{formatCurrency(invoice.taxAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between py-2 text-xl font-bold border-b">
                        <span className="text-gray-900">Total Amount:</span>
                        <span className="text-gray-900">{formatCurrency(invoice.total)}</span>
                    </div>
                     <div className="flex justify-between py-2 mt-2">
                        <span className="font-semibold text-green-600">Amount Paid:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(invoice.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-lg font-bold border-t mt-2">
                        <span className="text-gray-900">Balance Due:</span>
                        <span className="text-gray-900">{formatCurrency(invoice.total - invoice.amountPaid)}</span>
                    </div>
                </div>
            </section>

            {invoice.notes && (
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes</h3>
                    <p className="text-gray-700 p-4 bg-gray-50 rounded-lg">{invoice.notes}</p>
                </section>
            )}
        </div>
    );
};

export default InvoiceDetails;


