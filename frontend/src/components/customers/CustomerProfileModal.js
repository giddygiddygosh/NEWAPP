// src/components/customers/CustomerProfileModal.jsx

import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../common/Modal';
import Loader from '../common/Loader';
import api from '../../utils/api';
import { format, isValid } from 'date-fns';
import { Link } from 'react-router-dom';
import {
    User, Mail, Phone, MapPin, Building, Calendar, DollarSign, FileText,
    Briefcase, ClipboardList, Package, MessageCircle, Link as LinkIcon,
    AlertCircle, CheckCircle, Clock, Send, CreditCard, Receipt, PlusCircle, Pencil, Trash2,
    PieChart, LineChart, BarChart3, TrendingUp, TrendingDown,
    ReceiptText, Megaphone
} from 'lucide-react';
import { toast } from 'react-toastify';

// Import your new chart components
import JobHistoryChart from './charts/JobHistoryChart'; // Adjust path as necessary
// import SpendingTrendsChart from './charts/SpendingTrendsChart'; // You'd create this too

const CustomerProfileModal = ({ isOpen, onClose, customerId, onCustomerUpdated }) => {
    const [customer, setCustomer] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [quotes, setQuotes] = useState([]);
    const [customerStats, setCustomerStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // REMOVE these DUMMY_DATA variables once you have real data for charts
    // const DUMMY_JOB_DATA_FOR_CHART = [ /* ... */ ];
    // const DUMMY_SPENDING_DATA_FOR_CHART = [ /* ... */ ];


    // Helper functions for formatting
    const formatCurrency = (amount) => `£${parseFloat(amount || 0).toFixed(2)}`;
    const formatDate = (dateString) => isValid(new Date(dateString)) ? format(new Date(dateString), 'dd/MM/yyyy') : 'N/A';
    const formatTime = (timeString) => timeString || 'N/A'; // Assuming time is HH:MM

    const getMasterContact = (contacts, type) => {
        if (!contacts || !Array.isArray(contacts)) return 'N/A';
        const master = contacts.find(c => c.isMaster);
        if (master) return type === 'email' ? master.email : master.number;
        const firstNonEmpty = contacts.find(c => (type === 'email' ? c.email : c.number)?.trim() !== '');
        return type === 'email' ? firstNonEmpty?.email : firstNonEmpty?.number;
    };

    // Fetch all customer-related data concurrently
    const fetchCustomerData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!customerId) {
                setError("No customer ID provided.");
                setIsLoading(false);
                return;
            }

            const [customerRes, jobsRes, invoicesRes, quotesRes, statsRes] = await Promise.all([
                api.get(`/customers/${customerId}`),
                api.get(`/jobs?customer=${customerId}&limit=50&sort=-date`),
                api.get(`/invoices?customer=${customerId}&limit=50&sort=-createdAt`),
                api.get(`/leads?customer=${customerId}&limit=50&sort=-createdAt`),
                api.get(`/customers/${customerId}/stats`),
            ]);

            setCustomer(customerRes.data);
            setJobs(jobsRes.data);
            setInvoices(invoicesRes.data);
            setQuotes(quotesRes.data);
            setCustomerStats(statsRes.data); // Set aggregated stats

        } catch (err) {
            console.error("Error fetching customer profile data:", err);
            setError(err.response?.data?.message || "Failed to load customer profile data. Ensure backend endpoints are correct.");
        } finally {
            setIsLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        if (isOpen && customerId) {
            fetchCustomerData();
        }
    }, [isOpen, customerId, fetchCustomerData]);

    const handleEditCustomer = () => {
        onClose();
        onCustomerUpdated(customer);
    };

    const handleCreateJobForCustomer = () => {
        window.location.href = `/jobs/new?customer=${customerId}`;
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Profile: ${customer?.contactPersonName || 'Loading...'}`} maxWidthClass="max-w-7xl">
            {isLoading ? (
                <div className="p-8 text-center min-h-[400px] flex items-center justify-center">
                    <Loader /><p className="mt-2 text-gray-700">Loading profile data...</p>
                </div>
            ) : error ? (
                <div className="p-8 text-center text-red-600 min-h-[400px] flex flex-col items-center justify-center">
                    <p>{error}</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                </div>
            ) : !customer ? (
                <div className="p-8 text-center text-gray-700 min-h-[400px] flex flex-col items-center justify-center">
                    <p>Customer data could not be loaded.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                </div>
            ) : (
                <div className="p-8 space-y-8 bg-gray-50 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {/* Header Section with Customer Name and Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-gray-200">
                        <div className="mb-4 sm:mb-0">
                            <h2 className="text-4xl font-extrabold text-gray-900 flex items-center">
                                <User size={38} className="mr-4 text-blue-600" />
                                {customer.contactPersonName}
                            </h2>
                            {customer.companyName && (
                                <p className="text-xl text-gray-600 mt-2 ml-12 flex items-center">
                                    <Building size={24} className="mr-2 text-gray-500" /> {customer.companyName}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                            <button
                                onClick={handleEditCustomer}
                                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center"
                            >
                                <Pencil size={18} className="mr-2" /> Edit Profile
                            </button>
                            <button
                                onClick={handleCreateJobForCustomer}
                                className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md flex items-center justify-center"
                            >
                                <PlusCircle size={18} className="mr-2" /> Create Job
                            </button>
                        </div>
                    </div>

                    {/* Stats at a Glance / Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white p-6 rounded-lg shadow-xl">
                        <div className="text-center">
                            <DollarSign size={36} className="text-green-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Total Spent</h3>
                            {/* Use customerStats.totalInvoicedAmount for total spent, assuming all invoiced amount is 'spent' */}
                            <p className="text-3xl font-bold text-green-800">{formatCurrency(customerStats?.totalInvoicedAmount || 0)}</p>
                        </div>
                        <div className="text-center">
                            <Briefcase size={36} className="text-blue-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Jobs Completed</h3>
                            {/* Use customerStats.totalJobs for jobs completed */}
                            <p className="text-3xl font-bold text-blue-800">{customerStats?.totalJobs || 0}</p>
                        </div>
                        <div className="text-center">
                            <TrendingUp size={36} className="text-purple-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Avg Job Value</h3>
                            {/* You'll need to calculate this from customerStats (totalInvoicedAmount / totalJobs) */}
                            <p className="text-3xl font-bold text-purple-800">
                                {formatCurrency(customerStats?.totalJobs > 0 ? (customerStats.totalInvoicedAmount / customerStats.totalJobs) : 0)}
                            </p>
                        </div>
                        <div className="text-center">
                            <AlertCircle size={36} className="text-orange-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Outstanding Invoices</h3>
                            {/* Use customerStats.totalOutstandingAmount for outstanding */}
                            <p className="text-3xl font-bold text-orange-800">{formatCurrency(customerStats?.totalOutstandingAmount || 0)}</p>
                        </div>
                    </div>

                    {/* Core Details and Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Contact and Address Details (Left Column) */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500 h-fit">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><User size={24} className="mr-2 text-blue-600" /> Contact Information</h3>
                            <p className="flex items-center text-gray-700 mb-2"><Mail size={18} className="mr-2 flex-shrink-0" /> {getMasterContact(customer.email, 'email')}</p>
                            <p className="flex items-center text-gray-700 mb-2"><Phone size={18} className="mr-2 flex-shrink-0" /> {getMasterContact(customer.phone, 'phone')}</p>
                            <p className="flex items-start text-gray-700"><MapPin size={18} className="mr-2 flex-shrink-0" />
                                {customer.address ? (
                                    <>
                                        {customer.address.street || ''}<br />
                                        {customer.address.city || ''}, {customer.address.county || ''}<br />
                                        {customer.address.postcode || ''}, {customer.address.country || ''}
                                    </>
                                ) : 'N/A Address'}
                            </p>
                            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-4 flex items-center"><ClipboardList size={24} className="mr-2 text-blue-600" /> Customer Details</h3>
                            <p className="mb-2 text-gray-700"><span className="font-medium">Type:</span> {customer.customerType || 'N/A'}</p>
                            <p className="mb-2 text-gray-700"><span className="font-medium">Industry:</span> {customer.industry || 'N/A'}</p>
                            <p className="mb-2 text-gray-700"><span className="font-medium">Sales Person:</span> {customer.salesPersonName || 'Unassigned'}</p>
                            <p className="mb-2 text-gray-700"><span className="font-medium">Commission Earned:</span> {formatCurrency(customer.commissionEarned)}</p>
                        </div>

                        {/* Job History Chart (REPLACE PLACEHOLDER WITH ACTUAL CHART) */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><BarChart3 size={24} className="mr-2 text-green-600" /> Job History (Last 6 Months)</h3>
                            {/* Replace this div with your JobHistoryChart component */}
                            <div className="h-[300px]"> {/* Give it a height so the chart can render */}
                                {/* You'll need to process 'jobs' data into the format your chart component expects */}
                                {/* For example, if JobHistoryChart expects an array of { month, completed, cancelled } */}
                                {/* You'd derive this from the 'jobs' state */}
                                <JobHistoryChart data={
                                    // This is an example of how you might process 'jobs' into chart-ready data
                                    // You'll need more sophisticated logic to group by month and count statuses
                                    // This assumes a simple structure for demonstration purposes
                                    // For a real chart, you'd iterate over `jobs` and aggregate by month.
                                    jobs.map(job => ({
                                        month: format(new Date(job.date), 'MMM'), // Assuming 'date' exists on job
                                        completed: job.status === 'Completed' ? 1 : 0,
                                        cancelled: job.status === 'Cancelled' ? 1 : 0,
                                        // ... other statuses
                                    }))
                                    // You would then need to aggregate this by month, e.g., using reduce
                                    // For a quick fix, you can temporarily use DUMMY_JOB_DATA_FOR_CHART here if you delete it from state
                                    // DUMMY_JOB_DATA_FOR_CHART
                                } />
                            </div>
                            <Link to={`/jobs?customer=${customerId}`} className="text-blue-600 hover:underline mt-4 inline-block text-sm">View All Jobs</Link>
                        </div>

                        {/* Spending Trends Chart (REPLACE PLACEHOLDER WITH ACTUAL CHART) */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md border-t-4 border-purple-500">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><LineChart size={24} className="mr-2 text-purple-600" /> Spending Trends</h3>
                            {/* Replace this div with your SpendingTrendsChart component */}
                            <div className="h-[300px]"> {/* Give it a height so the chart can render */}
                                {/* Pass processed invoice data to your SpendingTrendsChart */}
                                {/* DUMMY_SPENDING_DATA_FOR_CHART */}
                                {/* Example: <SpendingTrendsChart data={processedInvoiceDataForChart} /> */}
                            </div>
                            <Link to={`/invoices?customer=${customerId}`} className="text-blue-600 hover:underline mt-4 inline-block text-sm">View Invoices</Link>
                        </div>
                    </div>

                    {/* Recent Activity Sections (Jobs, Invoices, Quotes) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Recent Jobs List */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center"><Briefcase size={20} className="mr-2 text-blue-500" /> Latest Jobs</h3>
                            {jobs.length > 0 ? (
                                <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {jobs.slice(0, 5).map(job => (
                                        <li key={job._id} className="flex justify-between items-center text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-100">
                                            <div>
                                                <p className="font-medium">{job.serviceType}</p>
                                                <p className="text-xs text-gray-500">{formatDate(job.date)} at {formatTime(job.time)}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                job.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>{job.status}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 text-sm">No recent jobs found for this customer.</p>
                            )}
                            <Link to={`/jobs?customer=${customerId}`} className="text-blue-600 hover:underline mt-3 inline-block text-sm">View All Jobs</Link>
                        </div>

                        {/* Recent Invoices List */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center"><ReceiptText size={20} className="mr-2 text-green-500" /> Latest Invoices</h3>
                            {invoices.length > 0 ? (
                                <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {invoices.slice(0, 5).map(invoice => (
                                        <li key={invoice._id} className="flex justify-between items-center text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-100">
                                            <div>
                                                <p className="font-medium">Invoice #{invoice.invoiceNumber}</p>
                                                <p className="text-xs text-gray-500">Due: {formatDate(invoice.dueDate)}</p>
                                            </div>
                                            <span className="font-bold text-green-700">{formatCurrency(invoice.totalAmount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 text-sm">No recent invoices found for this customer.</p>
                            )}
                            <Link to={`/invoices?customer=${customerId}`} className="text-blue-600 hover:underline mt-3 inline-block text-sm">View All Invoices</Link>
                        </div>

                        {/* Recent Quotes/Leads List */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center"><Megaphone size={20} className="mr-2 text-orange-500" /> Recent Quotes/Leads</h3>
                            {quotes.length > 0 ? (
                                <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {quotes.slice(0, 5).map(quote => (
                                        <li key={quote._id} className="flex justify-between items-center text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-100">
                                            <div>
                                                <p className="font-medium">{quote.leadSource || 'N/A Source'}</p>
                                                <p className="text-xs text-gray-500">Status: {quote.leadStatus || 'N/A'}</p>
                                            </div>
                                            <Link to={`/leads?leadId=${quote._id}`} className="text-blue-600 hover:underline text-sm">View Lead</Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 text-sm">No recent quotes or leads found for this customer.</p>
                            )}
                            <Link to={`/leads?customer=${customerId}`} className="text-blue-600 hover:underline mt-3 inline-block text-sm">View All Leads/Quotes</Link>
                        </div>
                    </div>

                    {/* Close Button */}
                    <div className="p-4 border-t mt-6 flex justify-end">
                        <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default CustomerProfileModal;