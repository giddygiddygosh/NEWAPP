// frontend/src/components/invoices/InvoiceTable.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom'; // NEW: Import useNavigate
import { useCurrency } from '../context/CurrencyContext';

// A helper object to map status values to color styles
const statusStyles = {
    paid: 'bg-green-100 text-green-800',
    partially_paid: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    overdue: 'bg-red-100 text-red-800',
    draft: 'bg-gray-100 text-gray-800',
    void: 'bg-gray-500 text-white',
};

const InvoiceTable = ({ invoices }) => {
    const { formatCurrency } = useCurrency();
    const navigate = useNavigate(); // NEW: Initialize useNavigate hook

    if (!invoices || invoices.length === 0) {
        return <p className="text-center text-gray-500 py-8">No invoices found.</p>;
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    // NEW: Handler for when an invoice row is clicked
    const handleRowClick = (invoiceId) => {
        navigate(`/invoices/${invoiceId}`); // Navigate to the invoice details page
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                        <tr
                            key={invoice._id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleRowClick(invoice._id)} // NEW: Add onClick handler to the row
                        >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{invoice.invoiceNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.customer.contactPersonName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(invoice.issueDate)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(invoice.dueDate)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(invoice.total)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[invoice.status] || statusStyles.draft}`}>
                                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace('_', ' ')}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default InvoiceTable;