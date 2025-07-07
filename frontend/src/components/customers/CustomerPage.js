// src/components/customers/CustomerPage.jsx

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import ConfirmationModal from '../common/ConfirmationModal';
import AddContactModal from '../common/AddContactModal';
import BulkUploader from '../common/BulkUploader'; // NEW: Import BulkUploader
import { useMapsApi } from '../../App';

const CustomerPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false); // NEW: State for bulk upload modal

    const { isMapsLoaded, isMapsLoadError } = useMapsApi();

    // NEW: Define fields for Customer Bulk Upload (for instructions and internal mapping)
    const customerUploadFields = [
        { header: 'Contact Person Name', key: 'contactPersonName' },
        { header: 'Email Address', key: 'email' },
        { header: 'Phone Number', key: 'phone' },
        { header: 'Company Name', key: 'companyName' },
        { header: 'Street', key: 'address.street' }, // Detailed address fields
        { header: 'City', key: 'address.city' },
        { header: 'County', key: 'address.county' },
        { header: 'Postcode', key: 'address.postcode' },
        { header: 'Country', key: 'address.country' },
        { header: 'Customer Type', key: 'customerType' },
        { header: 'Industry', key: 'industry' },
    ];


    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/customers');
            setCustomers(res.data);
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError(err.response?.data?.message || 'Failed to fetch customers.');
        } finally {
            setLoading(false);
        }
    };

    const handleCustomerSaved = () => {
        fetchCustomers();
        setIsAddCustomerModalOpen(false);
    };

    const handleAddCustomerClick = () => {
        setSelectedCustomer(null);
        setIsAddCustomerModalOpen(true);
    };

    const handleEditCustomerClick = (customer) => {
        setSelectedCustomer(customer);
        setIsAddCustomerModalOpen(true);
    };

    const handleDeleteCustomerClick = async (customerId) => {
        if (window.confirm('Are you sure you want to delete this customer? This will also delete their associated portal login if one exists.')) {
            setLoading(true);
            try {
                await api.delete(`/customers/${customerId}`);
                fetchCustomers();
            } catch (err) {
                console.error('Error deleting customer:', err);
                setError(err.response?.data?.message || 'Failed to delete customer.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleBulkUploadSuccess = () => { // NEW: Handler for successful bulk upload
        fetchCustomers(); // Refresh the customer list
        setIsBulkUploadModalOpen(false); // Close the bulk upload modal
    };

    const getMasterContact = (contacts, type) => {
        if (!contacts) return 'N/A';
        if (Array.isArray(contacts)) {
            const master = contacts.find(c => c.isMaster);
            if (master) return type === 'email' ? master.email : master.number;
            const firstNonEmpty = contacts.find(c => (type === 'email' ? c.email : c.number)?.trim() !== '');
            return type === 'email' ? firstNonEmpty?.email : firstNonEmpty?.number;
        }
        return 'N/A';
    };

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
                <h2 className="text-3xl font-extrabold text-gray-800">Customer Management</h2>
                <div className="flex space-x-3"> {/* NEW: Container for multiple buttons */}
                    <button
                        onClick={() => setIsBulkUploadModalOpen(true)} // NEW: Open bulk upload modal
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md"
                    >
                        Bulk Upload
                    </button>
                    <button
                        onClick={handleAddCustomerClick}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md"
                    >
                        Add New Customer
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            <AddContactModal
                isOpen={isAddCustomerModalOpen}
                onClose={() => setIsAddCustomerModalOpen(false)}
                onContactAdded={handleCustomerSaved}
                initialData={selectedCustomer}
                isMapsLoaded={isMapsLoaded}
                isMapsLoadError={isMapsLoadError}
                type="customer"
            />

            {/* NEW: Bulk Uploader for Customers */}
            <BulkUploader
                isOpen={isBulkUploadModalOpen}
                onClose={() => setIsBulkUploadModalOpen(false)}
                endpoint="/customers/bulk-upload" // Specific API endpoint
                fields={customerUploadFields} // Fields definition for instructions and mapping
                type="customers" // Type string for instructions
                onUploadSuccess={handleBulkUploadSuccess} // Callback on success
            />

            <ConfirmationModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={handleDeleteCustomerClick} // Call handler directly, it manages staffToDelete internally
                title="Confirm Customer Deletion"
                message={`Are you sure you want to delete this customer? This will also delete their associated portal login if one exists.`}
            />

            {loading && customers.length === 0 ? (
                <Loader />
            ) : customers.length === 0 ? (
                <p className="text-gray-600 text-center py-10">No customers found. Add your first customer!</p>
            ) : (
                <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Contact Person</th>
                                <th scope="col" className="px-6 py-3">Company Name</th>
                                <th scope="col" className="px-6 py-3">Email</th>
                                <th scope="col" className="px-6 py-3">Phone</th>
                                <th scope="col" className="px-6 py-3">Address</th>
                                <th scope="col" className="px-6 py-3">Customer Type</th>
                                <th scope="col" className="px-6 py-3">Industry</th>
                                <th scope="col" className="px-6 py-3">Sales Person</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(customer => (
                                <tr key={customer._id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        {customer.contactPersonName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {customer.companyName || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getMasterContact(customer.email, 'email') || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getMasterContact(customer.phone, 'phone') || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {customer.address ? `${customer.address.street || ''}, ${customer.address.city || ''}` : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {customer.customerType || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {customer.industry || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {customer.salesPersonName || 'Unassigned'}
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end space-x-3">
                                            <button
                                                onClick={() => handleEditCustomerClick(customer)}
                                                className="font-medium text-indigo-600 hover:text-indigo-900"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCustomerClick(customer._id)}
                                                className="font-medium text-red-600 hover:text-red-900"
                                            >
                                                Delete
                                            </button>
                                        </div>
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

export default CustomerPage;