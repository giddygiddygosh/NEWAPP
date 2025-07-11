import React, { useState, useEffect } from 'react';
import api from '../../utils/api'; // Assuming your API utility is located here
import Loader from '../common/Loader'; // Assuming you have a Loader component
import { toast } from 'react-toastify'; // For displaying messages

const CustomerInvoicesPage = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCustomerInvoices = async () => {
            setLoading(true);
            setError(null);
            try {
                // Corrected API endpoint to match backend customer-portal route
                const res = await api.get('/customer-portal/invoices/recent'); 
                setInvoices(res.data);
            } catch (err) {
                console.error("Error fetching customer invoices:", err.response?.data || err.message);
                setError(err.response?.data?.message || "Failed to load invoices.");
                toast.error("Failed to load invoices. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchCustomerInvoices();
    }, []); // Empty dependency array means this runs once on component mount

    return (
        <div className="customer-invoices-page p-8 bg-white rounded-lg shadow-md min-h-[calc(100vh-80px)]">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6 pb-4 border-b border-gray-200">Your Invoices</h2>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader /> <p className="ml-2 text-gray-600">Loading your invoices...</p>
                </div>
            ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {error}
                </div>
            ) : invoices.length === 0 ? (
                <div className="text-center py-10 border rounded-lg bg-gray-50 text-gray-600">
                    You currently have no invoices.
                </div>
            ) : (
                <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Invoice #</th>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Due Date</th>
                                <th scope="col" className="px-6 py-3">Total Amount</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((invoice) => (
                                <tr key={invoice._id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{invoice.invoiceNumber || 'N/A'}</td>
                                    <td className="px-6 py-4">{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">£{invoice.totalAmount?.toFixed(2) || '0.00'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                            invoice.status === 'Due' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {invoice.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="font-medium text-blue-600 hover:text-blue-900 ml-2">View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CustomerInvoicesPage;