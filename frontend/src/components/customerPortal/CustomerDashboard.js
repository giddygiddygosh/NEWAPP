import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext'; // Corrected import path
import api from '../../utils/api';
import Loader from '../common/Loader';

const CustomerDashboard = () => {
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [upcomingAppointments, setUpcomingAppointments] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(true);
    const [loadingAppointments, setLoadingAppointments] = useState(true);
    const [invoiceError, setInvoiceError] = useState(null);
    const [appointmentError, setAppointmentError] = useState(null);

    // Get the logout function from your auth context and set up navigation
    const { logout } = useAuth();
    const navigate = useNavigate();

    // This function handles the entire logout process
    const handleLogout = () => {
        logout(); // Clears the user's session
        toast.info("You have been logged out.");
        navigate('/login'); // Redirects the user to the login page
    };

    // Effect to fetch recent invoices
    useEffect(() => {
        const fetchRecentInvoices = async () => {
            setLoadingInvoices(true);
            setInvoiceError(null);
            try {
                const res = await api.get('/customer-portal/invoices/recent');
                setRecentInvoices(res.data);
            } catch (err) {
                console.error("Error fetching recent invoices for dashboard:", err.response?.data || err.message);
                setInvoiceError("Failed to load recent invoices.");
            } finally {
                setLoadingInvoices(false);
            }
        };

        fetchRecentInvoices();
    }, []);

    // Effect to fetch upcoming appointments (jobs)
    useEffect(() => {
        const fetchUpcomingAppointments = async () => {
            setLoadingAppointments(true);
            setAppointmentError(null);
            try {
                const res = await api.get('/customer-portal/jobs/upcoming');
                setUpcomingAppointments(res.data);
            } catch (err) {
                console.error("Error fetching upcoming appointments for dashboard:", err.response?.data || err.message);
                setAppointmentError("Failed to load upcoming appointments.");
            } finally {
                setLoadingAppointments(false);
            }
        };

        fetchUpcomingAppointments();
    }, []);

    return (
        <div className="customer-dashboard p-8 bg-gray-50 min-h-screen">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-6 flex items-center justify-between">
                Welcome to Your Customer Portal, Yip Yap!
                {/* The onClick handler is now connected to the logout logic */}
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md"
                >
                    Logout
                </button>
            </h1>
            <p className="text-lg text-gray-700 mb-8">This is your personalized dashboard where you can manage your services, requests, and account information.</p>

            {/* Dashboard Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* View Invoices Card */}
                <div className="bg-blue-100 p-6 rounded-lg shadow-md border-t-4 border-blue-500">
                    <h3 className="text-xl font-semibold text-blue-800 mb-2">View Invoices</h3>
                    <p className="text-blue-700 text-sm mb-4">Access and review all your past and current invoices.</p>
                    <Link to="/customer-portal/invoices" className="inline-block px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors">
                        Go to Invoices
                    </Link>
                </div>

                {/* Request a Quote Card */}
                <div className="bg-green-100 p-6 rounded-lg shadow-md border-t-4 border-green-500">
                    <h3 className="text-xl font-semibold text-green-800 mb-2">Request a Quote</h3>
                    <p className="text-green-700 text-sm mb-4">Need a new service? Request a personalized quote from our team.</p>
                    <Link to="/quote-request" className="inline-block px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors">
                        Request Quote
                    </Link>
                </div>

                {/* Manage Appointments Card */}
                <div className="bg-yellow-100 p-6 rounded-lg shadow-md border-t-4 border-yellow-500">
                    <h3 className="text-xl font-semibold text-yellow-800 mb-2">Manage Appointments</h3>
                    <p className="text-yellow-700 text-sm mb-4">View your upcoming appointments or request to reschedule.</p>
                    <Link to="/customer-portal/appointments" className="inline-block px-6 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-colors">
                        View Appointments
                    </Link>
                </div>

                {/* Emergency Service Card */}
                <div className="bg-red-100 p-6 rounded-lg shadow-md border-t-4 border-red-500">
                    <h3 className="text-xl font-semibold text-red-800 mb-2">Emergency Service</h3>
                    <p className="text-red-700 text-sm mb-4">For urgent issues, book an emergency appointment quickly.</p>
                    <Link to="/customer-portal/emergency" className="inline-block px-6 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">
                        Book Emergency
                    </Link>
                </div>
            </div>

            {/* Your Recent Invoices Section */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Your Recent Invoices</h3>
                {loadingInvoices ? (
                    <div className="flex items-center text-gray-600">
                        <Loader size={20} className="mr-2" /> Loading invoices...
                    </div>
                ) : invoiceError ? (
                    <div className="text-red-500 text-sm">{invoiceError}</div>
                ) : recentInvoices.length > 0 ? (
                    <ul>
                        {recentInvoices.map(invoice => (
                            <li key={invoice._id} className="mb-2 text-gray-700">
                                Invoice **{invoice.invoiceNumber || 'N/A'}**: £{invoice.totalAmount?.toFixed(2) || '0.00'} - Due {new Date(invoice.dueDate).toLocaleDateString()}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-600">No recent invoices found.</p>
                )}
                <Link to="/customer-portal/invoices" className="text-blue-600 hover:underline mt-4 inline-block">
                    View All Invoices
                </Link>
            </div>

            {/* Your Upcoming Appointments Section */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Your Upcoming Appointments</h3>
                {loadingAppointments ? (
                    <div className="flex items-center text-gray-600">
                        <Loader size={20} className="mr-2" /> Loading appointments...
                    </div>
                ) : appointmentError ? (
                    <div className="text-red-500 text-sm">{appointmentError}</div>
                ) : upcomingAppointments.length > 0 ? (
                    <ul>
                        {upcomingAppointments.map(job => (
                            <li key={job._id} className="mb-2 text-gray-700">
                                Job: **{job.jobTitle || 'N/A'}** on {new Date(job.jobDate).toLocaleDateString()} at {job.startTime || 'N/A'}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-600">No upcoming appointments found.</p>
                )}
                <Link to="/customer-portal/appointments" className="text-blue-600 hover:underline mt-4 inline-block">
                    Go to Appointments Page
                </Link>
            </div>
        </div>
    );
};

export default CustomerDashboard;