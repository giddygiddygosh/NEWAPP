import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import Loader from '../common/Loader';
import PaymentModal from '../common/PaymentModal';
import { CheckCircleIcon, PaperAirplaneIcon, CurrencyDollarIcon, XCircleIcon } from '@heroicons/react/24/outline';
// Note: We're not including i18n (useTranslation) for now as per your request.
// All strings are hardcoded in English.

const InvoiceDetails = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const { formatCurrency, currency } = useCurrency();
    const { user } = useAuth();
    
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [statusUpdateError, setStatusUpdateError] = useState(null);

    // State for the Payment Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState(null);

    const fetchInvoice = useCallback(async () => {
        setLoading(true);
        setError(null);
        setInvoice(null); // <--- RESET invoice to null at start of fetch, ensures spinner shows if re-fetching
        try {
            const res = await api.get(`/invoices/${invoiceId}`);
            setInvoice(res.data);
        } catch (err) {
            console.error("Error fetching invoice details:", err);
            setError(err.response?.data?.message || 'Failed to load invoice details.');
            setInvoice(null); // <--- Ensure invoice is null on error to show "Invoice not found" or error message
        } finally {
            setLoading(false);
        }
    }, [invoiceId]);

    useEffect(() => {
        if (invoiceId) {
            fetchInvoice();
        }
    }, [invoiceId, fetchInvoice]);

    const handleStatusChange = async (newStatus) => {
        setIsUpdatingStatus(true);
        setStatusUpdateError(null);
        try {
            const res = await api.put(`/invoices/${invoice._id}/status`, { status: newStatus });
            setInvoice(res.data); // Assuming backend returns the updated invoice directly
        } catch (err) {
            console.error(`Error updating invoice status to ${newStatus}:`, err);
            setStatusUpdateError(err.response?.data?.message || `Failed to update status.`);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleRecordPaymentClick = () => {
        // Ensure invoice is not null before proceeding
        if (!invoice || invoice.balanceDue === undefined || invoice.balanceDue <= 0.01) {
            alert('This invoice has no outstanding balance to record a payment for.');
            return;
        }

        setPaymentDetails({
            amount: invoice.balanceDue,
            currencyCode: invoice.currency?.code || currency.code,
            description: `Invoice ${invoice.invoiceNumber} payment for ${invoice.customer?.contactPersonName || 'N/A'}.`,
            metadata: {
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                paymentType: 'invoice_payment',
                totalInvoiceAmount: invoice.total?.toFixed(2),
                balanceBeforePayment: invoice.balanceDue?.toFixed(2),
            }
        });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSuccess = async (paymentIntent) => {
        console.log("InvoiceDetails: handlePaymentSuccess triggered."); // <--- DEBUG
        console.log("InvoiceDetails: PaymentIntent received:", paymentIntent); // <--- DEBUG

        // DO NOT close modal here, it's handled by PaymentModal itself
        // setIsPaymentModalOpen(false); // Remove or comment out if present, PaymentModal handles its own close now
        // setPaymentDetails(null); // Remove or comment out if present

        try {
            const paymentAmount = paymentIntent.amount / 100;
            console.log("InvoiceDetails: Amount to record in backend:", paymentAmount); // <--- DEBUG
            
            // --- CRITICAL DEBUG: Check response from backend payment recording ---
            const res = await api.post(`/invoices/${invoice._id}/payments`, {
                amount: paymentAmount,
                paymentIntentId: paymentIntent.id,
                method: 'card',
                notes: `Payment of ${formatCurrency(paymentAmount)} received via Stripe.`
            });
            
            console.log("InvoiceDetails: Backend recordPayment response data:", res.data); // <--- DEBUG
            
            setInvoice(res.data.invoice); // This line is the suspect
            console.log("InvoiceDetails: Invoice state updated."); // <--- DEBUG
            alert('Payment recorded successfully!'); // Keep alert for immediate feedback

        } catch (recordError) {
            console.error('InvoiceDetails: CRITICAL ERROR recording payment to invoice:', recordError.response?.data || recordError.message); // <--- DEBUG: Capture error details
            alert(`Failed to record payment on invoice. Error: ${recordError.response?.data?.message || recordError.message}`);
        }
    };

    const handlePaymentModalClose = () => {
        setIsPaymentModalOpen(false);
        setPaymentDetails(null);
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
        refunded: 'bg-purple-100 text-purple-800',
    };

    // Ensure invoice is not null before checking its properties for canChangeStatus and showRecordPaymentButton
    const canChangeStatus = invoice && (user?.role === 'admin' || user?.role === 'manager');
    const showRecordPaymentButton = invoice && canChangeStatus && invoice.balanceDue !== undefined && invoice.balanceDue > 0.01;


    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader />
            </div>
        );
    }

    if (error) { // Display a more prominent error if fetching failed
        return (
            <div className="p-8 text-center bg-red-50 border border-red-400 text-red-700 rounded-lg">
                <p className="text-lg font-semibold mb-2">Error Loading Invoice</p>
                <p>{error}</p>
                <button onClick={fetchInvoice} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Retry Loading</button>
            </div>
        );
    }

    if (!invoice) { // If not loading, and invoice is still null, it means not found
        return (
            <div className="p-8 text-center text-gray-600">
                Invoice not found. Please check the URL.
            </div>
        );
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
        ].filter(Boolean);
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
                    
                    {/* NEW: Display individual payments */}
                    {invoice.payments && invoice.payments.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="text-md font-semibold text-gray-700 mb-2">Payments Received</h3>
                            <ul className="space-y-1">
                                {invoice.payments.map((payment, index) => (
                                    <li key={payment._id || index} className="flex justify-between text-sm text-gray-600">
                                        <span>{new Date(payment.date).toLocaleDateString()}: {payment.method}</span>
                                        <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex justify-between py-2 text-lg font-bold border-t mt-2">
                        <span className="text-gray-900">Balance Due:</span>
                        <span className="text-gray-900">{formatCurrency(invoice.balanceDue)}</span> {/* Use invoice.balanceDue directly */}
                    </div>
                </div>
            </section>

            {invoice.notes && (
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes</h3>
                    <p className="text-gray-700 p-4 bg-gray-50 rounded-lg">{invoice.notes}</p>
                </section>
            )}

            {/* --- Invoice Actions --- */}
            <footer className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap justify-end gap-3">
                {statusUpdateError && <p className="text-red-500 w-full text-right mb-2">{statusUpdateError}</p>}
                
                {/* Record Payment Button */}
                {showRecordPaymentButton && (
                    <button
                        onClick={handleRecordPaymentClick}
                        className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center shadow-md disabled:opacity-50"
                        disabled={isUpdatingStatus}
                    >
                        <CurrencyDollarIcon className="h-5 w-5 mr-2" /> Record Payment ({formatCurrency(invoice.balanceDue)})
                    </button>
                )}

                {canChangeStatus && invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'refunded' && (
                    <>
                        {invoice.status === 'draft' && (
                            <button
                                onClick={() => handleStatusChange('sent')}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center shadow-md disabled:opacity-50"
                                disabled={isUpdatingStatus}
                            >
                                <PaperAirplaneIcon className="h-5 w-5 mr-2" /> Mark as Sent
                            </button>
                        )}
                        {(invoice.status === 'sent' || invoice.status === 'partially_paid' || invoice.status === 'overdue') && (
                            <button
                                onClick={() => handleStatusChange('paid')}
                                className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center shadow-md disabled:opacity-50"
                                disabled={isUpdatingStatus}
                            >
                                <CheckCircleIcon className="h-5 w-5 mr-2" /> Mark as Paid
                            </button>
                        )}
                        <button
                            onClick={() => handleStatusChange('void')}
                            className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center shadow-md disabled:opacity-50"
                            disabled={isUpdatingStatus}
                        >
                            <XCircleIcon className="h-5 w-5 mr-2" /> Void Invoice
                        </button>
                    </>
                )}
            </footer>

            {/* The Stripe Payment Modal */}
            {isPaymentModalOpen && paymentDetails && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={handlePaymentModalClose}
                    amount={paymentDetails.amount}
                    currencyCode={paymentDetails.currencyCode}
                    description={paymentDetails.description}
                    metadata={paymentDetails.metadata}
                    onPaymentSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

export default InvoiceDetails;