import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Loader from '../common/Loader';
import api from '../../utils/api';

const CustomerDashboard = () => {
    const { user, logout, loading: authLoading } = useAuth();

    const [recentInvoices, setRecentInvoices] = useState([]);
    const [upcomingJobs, setUpcomingJobs] = useState([]);
    const [isLoadingContent, setIsLoadingContent] = useState(true);
    const [contentError, setContentError] = useState(null);

    const fetchCustomerDashboardData = useCallback(async () => {
        if (!user || !user.customer) return;

        setIsLoadingContent(true);
        setContentError(null);
        try {
            // ================== THIS IS THE FIX ==================
            // The API paths now correctly start with /api/
            const invoicesRes = await api.get(`/api/customer-portal/invoices/recent`);
            setRecentInvoices(invoicesRes.data);

            const jobsRes = await api.get(`/api/customer-portal/jobs/upcoming`);
            setUpcomingJobs(jobsRes.data);
            // ======================================================

        } catch (err) {
            console.error("Failed to fetch customer dashboard data:", err);
            setContentError("Failed to load your dashboard data.");
        } finally {
            setIsLoadingContent(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && user.customer && !authLoading) {
            fetchCustomerDashboardData();
        }
    }, [user, authLoading, fetchCustomerDashboardData]);


    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><Loader /></div>;
    }

    if (!user) {
        return <div className="p-8 text-center text-gray-600">Please log in to access the customer portal.</div>;
    }

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-3xl font-extrabold text-gray-800">Welcome to Your Customer Portal, {user.contactPersonName || user.email}!</h1>
                <button
                    onClick={logout}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 shadow-md"
                >
                    Logout
                </button>
            </div>

            <p className="text-lg text-gray-600 mb-8">This is your personalized dashboard where you can manage your services, requests, and account information.</p>

            {isLoadingContent ? (
                <div className="text-center py-10"><Loader /> <p className="text-gray-600 mt-2">Loading your data...</p></div>
            ) : contentError ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {contentError}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-blue-800 mb-2">View Invoices</h3>
                        <p className="text-blue-700">Access and review all your past and current invoices.</p>
                        <Link to="/customer-portal/invoices" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Go to Invoices</Link>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-green-800 mb-2">Request a Quote</h3>
                        <p className="text-green-700">Need a new service? Request a personalized quote from our team.</p>
                        <Link to="/quote-request" className="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Request Quote</Link>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-yellow-800 mb-2">Manage Appointments</h3>
                        <p className="text-yellow-700">View your upcoming appointments or request to reschedule.</p>
                        <Link to="/customer-portal/appointments" className="mt-4 inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">View Appointments</Link>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-red-800 mb-2">Emergency Service</h3>
                        <p className="text-red-700">For urgent issues, book an emergency appointment quickly.</p>
                        <Link to="/customer-portal/emergency" className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Book Emergency</Link>
                    </div>

                    {recentInvoices.length > 0 ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm col-span-full">
                            <h3 className="text-xl font-semibold text-blue-800 mb-2">Your Recent Invoices</h3>
                            <ul className="space-y-2">
                                {recentInvoices.map(invoice => (
                                    <li key={invoice._id} className="text-blue-700">
                                        Invoice {invoice.invoiceNumber}: £{invoice.total.toFixed(2)} - {invoice.status} (Due {new Date(invoice.dueDate).toLocaleDateString()})
                                    </li>
                                ))}
                            </ul>
                            <Link to="/customer-portal/invoices" className="mt-4 inline-block text-blue-600 hover:underline">View All Invoices</Link>
                        </div>
                    ) : (
                         <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm col-span-full">
                            <h3 className="text-xl font-semibold text-blue-800 mb-2">Your Recent Invoices</h3>
                            <p className="text-blue-700">No recent invoices found.</p>
                            <Link to="/customer-portal/invoices" className="mt-4 inline-block text-blue-600 hover:underline">Go to Invoices Page</Link>
                        </div>
                    )}

                    {upcomingJobs.length > 0 ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm col-span-full">
                            <h3 className="text-xl font-semibold text-yellow-800 mb-2">Your Upcoming Appointments</h3>
                            <ul className="space-y-2">
                                {upcomingJobs.map(job => (
                                    <li key={job._id} className="text-yellow-700">
                                        {job.serviceType} on {new Date(job.date).toLocaleDateString()} at {job.time} - {job.status}
                                    </li>
                                ))}
                            </ul>
                            <Link to="/customer-portal/appointments" className="mt-4 inline-block text-yellow-600 hover:underline">View All Appointments</Link>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm col-span-full">
                            <h3 className="text-xl font-semibold text-yellow-800 mb-2">Your Upcoming Appointments</h3>
                            <p className="text-yellow-700">No upcoming appointments found.</p>
                            <Link to="/customer-portal/appointments" className="mt-4 inline-block text-yellow-600 hover:underline">Go to Appointments Page</Link>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};

export default CustomerDashboard;