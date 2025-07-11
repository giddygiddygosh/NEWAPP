// src/components/customers/CustomerPage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react'; // Import useRef
import api from '../../utils/api';
import Loader from '../common/Loader';
import ConfirmationModal from '../common/ConfirmationModal';
import AddContactModal from '../common/AddContactModal';
import BulkUploader from '../common/BulkUploader';
import { useMapsApi } from '../../App';
import CustomerProfileModal from './CustomerProfileModal';

const CustomerPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerToDeleteId, setCustomerToDeleteId] = useState(null);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

    const [isCustomerProfileModalOpen, setIsCustomerProfileModalOpen] = useState(false);
    const [customerToViewId, setCustomerToViewId] = useState(null);

    const { isMapsLoaded, isMapsLoadError } = useMapsApi();

    const customerUploadFields = [
        { header: 'Contact Person Name', key: 'contactPersonName' },
        { header: 'Email Address', key: 'email' },
        { header: 'Phone Number', key: 'phone' },
        { header: 'Company Name', key: 'companyName' },
        { header: 'Street', key: 'address.street' },
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

    const handleViewCustomerProfileClick = (customerId) => {
        setCustomerToViewId(customerId);
        setIsCustomerProfileModalOpen(true);
    };

    const handleOpenEditFromProfileModal = (customerData) => {
        setIsCustomerProfileModalOpen(false); // Close profile modal
        handleEditCustomerClick(customerData); // Open edit modal with customer data
    };

    const handleDeleteCustomerClick = (customerId) => {
        setCustomerToDeleteId(customerId);
        setIsConfirmationModalOpen(true);
    };

    const confirmDeleteCustomer = async () => {
        if (customerToDeleteId) {
            setLoading(true);
            try {
                await api.delete(`/customers/${customerToDeleteId}`);
                fetchCustomers();
                setCustomerToDeleteId(null);
                setIsConfirmationModalOpen(false);
            } catch (err) {
                console.error('Error deleting customer:', err);
                setError(err.response?.data?.message || 'Failed to delete customer.');
            } finally {
                setLoading(false);
            }
        }
    };


    const handleBulkUploadSuccess = () => {
        fetchCustomers();
        setIsBulkUploadModalOpen(false);
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

    // NEW: ActionDropdown component (now with its own state and click-outside logic)
    const ActionDropdown = ({ customer }) => {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = useRef(null); // Ref for click-outside detection

        // Effect for handling clicks outside the dropdown
        useEffect(() => {
            function handleClickOutside(event) {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                    setIsOpen(false); // Close dropdown if click is outside
                }
            }
            // Attach the event listener when the dropdown is open
            if (isOpen) {
                document.addEventListener("mousedown", handleClickOutside);
            }
            return () => {
                // Clean up the event listener when the component unmounts or dropdown closes
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }, [isOpen]); // Re-run effect when isOpen changes

        const toggleDropdown = () => setIsOpen(!isOpen);

        // Define a wrapper for action clicks that also closes the dropdown
        const handleActionClick = (actionFn) => (e) => {
            e.stopPropagation(); // Stop event from bubbling up and potentially interfering
            actionFn(); // Execute the action function
            setIsOpen(false); // Close dropdown after action
        };

        return (
            <div className="relative inline-block text-left" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={toggleDropdown} // Toggle dropdown visibility
                    className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    id={`actions-menu-${customer._id}`} // Unique ID
                    aria-haspopup="true"
                    aria-expanded={isOpen} // Indicate expanded state for accessibility
                >
                    Actions
                    <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>

                {/* Conditionally render dropdown content */}
                {isOpen && (
                    <div
                        className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10" // Added z-10 to ensure it's on top
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby={`actions-menu-${customer._id}`}
                    >
                        <div className="py-1" role="none">
                            <button
                                onClick={handleActionClick(() => handleViewCustomerProfileClick(customer._id))}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                role="menuitem"
                            >
                                View Profile
                            </button>
                            <button
                                onClick={handleActionClick(() => handleEditCustomerClick(customer))}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                role="menuitem"
                            >
                                Edit
                            </button>
                            <button
                                onClick={handleActionClick(() => handleDeleteCustomerClick(customer._id))}
                                className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100 hover:text-red-900"
                                role="menuitem"
                            >
                                Delete
                            </button>
                            {/* Add more actions here if needed, e.g., Create Job, View Invoices */}
                            {/* Example for Create Job - assuming handleCreateJobForCustomer takes customerId */}
                            {/*
                            <button
                                onClick={handleActionClick(() => window.location.href = `/jobs/new?customer=${customer._id}`)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                role="menuitem"
                            >
                                Create Job
                            </button>
                            */}
                        </div>
                    </div>
                )}
            </div>
        );
    };


    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
                <h2 className="text-3xl font-extrabold text-gray-800">Customer Management</h2>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsBulkUploadModalOpen(true)}
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

            {/* Add/Edit Customer Modal */}
            <AddContactModal
                isOpen={isAddCustomerModalOpen}
                onClose={() => setIsAddCustomerModalOpen(false)}
                onContactAdded={handleCustomerSaved}
                initialData={selectedCustomer}
                isMapsLoaded={isMapsLoaded}
                isMapsLoadError={isMapsLoadError}
                type="customer"
            />

            {/* Bulk Uploader for Customers */}
            <BulkUploader
                isOpen={isBulkUploadModalOpen}
                onClose={() => setIsBulkUploadModalOpen(false)}
                endpoint="/customers/bulk-upload"
                fields={customerUploadFields}
                type="customers"
                onUploadSuccess={handleBulkUploadSuccess}
            />

            {/* Confirmation Modal for Delete */}
            <ConfirmationModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={confirmDeleteCustomer}
                title="Confirm Customer Deletion"
                message={`Are you sure you want to delete this customer? This will also delete their associated portal login if one exists.`}
            />

            {/* Customer Profile Modal */}
            {isCustomerProfileModalOpen && ( // Only render if open
                <CustomerProfileModal
                    isOpen={isCustomerProfileModalOpen}
                    onClose={() => setIsCustomerProfileModalOpen(false)}
                    customerId={customerToViewId}
                    onCustomerUpdated={handleOpenEditFromProfileModal}
                />
            )}


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
                                        <ActionDropdown customer={customer} />
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