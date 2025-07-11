// src/components/dashboard/Dashboard.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../../utils/api';
import Loader from '../common/Loader';
import { Link } from 'react-router-dom';
import {
    Users, Briefcase, DollarSign, FileText, TrendingUp, CalendarCheck, Clock,
    ClipboardList, AlertCircle, UserCheck, UserMinus, Plus,
    BarChart, CheckCircle, UserPlus, Mail, Phone, Building, MapPin,
    Package, ReceiptText, LineChart,
    CalendarDays, Hourglass, XCircle, ChevronRight,
    History // Added History icon
} from 'lucide-react'; // Import necessary Lucide icons

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalCustomers: 0,
        totalLeads: 0,
        upcomingJobsCount: 0,
        recentInvoiceAmount: 0,
        totalRevenue: 0,
        totalCompletedJobs: 0,
        lowStockItemsCount: 0,
        jobsTodayCount: 0,
    });
    const [jobDetailsToday, setJobDetailsToday] = useState([]);
    const [jobsByStatus, setJobsByStatus] = useState({});
    const [staffAvailability, setStaffAvailability] = useState({});
    const [recentActivity, setRecentActivity] = useState({
        jobs: [],
        invoices: [],
        leads: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Helper functions
    const formatCurrency = (amount) => {
        const num = parseFloat(amount);
        return isNaN(num) ? '£0.00' : `£${num.toFixed(2)}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatTime = (timeString) => {
        // Assuming timeString is like "HH:MM"
        return timeString || 'N/A';
    };


    const fetchDashboardData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Define today's date for relevant queries
            const today = new Date().toISOString().split('T')[0];

            // Use Promise.all to fetch all data concurrently for efficiency
            const [
                summaryRes, // e.g., /api/dashboard/summary-stats
                jobsOverviewRes, // e.g., /api/dashboard/jobs-overview?date=today
                jobsByStatusRes, // e.g., /api/dashboard/jobs-by-status
                staffAvailabilityRes, // e.g., /api/dashboard/staff-availability
                recentActivityRes // e.g., /api/dashboard/recent-activity
            ] = await Promise.all([
                // CORRECTED API CALLS: Removed the leading '/api/'
                api.get('/dashboard/summary-stats'),
                api.get(`/dashboard/jobs-overview?date=${today}`),
                api.get('/dashboard/jobs-by-status'),
                api.get('/dashboard/staff-availability'),
                api.get('/dashboard/recent-activity')
            ]);

            setStats({
                totalCustomers: summaryRes.data.totalCustomers || 0,
                totalLeads: summaryRes.data.totalLeads || 0,
                totalRevenue: summaryRes.data.totalRevenue || 0,
                totalCompletedJobs: summaryRes.data.totalCompletedJobs || 0,
                lowStockItemsCount: summaryRes.data.lowStockItemsCount || 0,
                upcomingJobsCount: jobsOverviewRes.data.upcomingJobsCount || 0,
                jobsTodayCount: jobsOverviewRes.data.totalJobsToday || 0,
            });
            setJobDetailsToday(jobsOverviewRes.data.jobsToday || []);
            setJobsByStatus(jobsByStatusRes.data || {});
            setStaffAvailability(staffAvailabilityRes.data || {});
            setRecentActivity(recentActivityRes.data || { jobs: [], invoices: [], leads: [] });

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            setError("Failed to load dashboard data. Please ensure all required backend endpoints are correctly implemented and accessible (e.g., /api/dashboard/summary-stats, /api/dashboard/jobs-overview, etc.).");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
        // Set up a refresh interval if you want live updates (e.g., every 5 minutes)
        // const refreshInterval = setInterval(fetchDashboardData, 5 * 60 * 1000);
        // return () => clearInterval(refreshInterval);
    }, [fetchDashboardData]);


    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen bg-gray-50">
                <Loader className="animate-spin inline-block mr-2" />
                <p className="text-xl text-gray-700">Loading your dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 bg-gray-50 min-h-screen flex flex-col items-center justify-center">
                <h1 className="text-3xl font-bold text-red-600 mb-4">Dashboard Error 💔</h1>
                <p className="text-red-500 bg-red-100 p-4 rounded-md text-center max-w-lg">
                    {error}
                </p>
                <button
                    onClick={fetchDashboardData}
                    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                >
                    Retry Loading Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="p-8 bg-gray-50 min-h-screen"> {/* Outer padding for the page content */}
            <h1 className="text-4xl font-extrabold text-gray-900 mb-6">
                Welcome to your Dashboard, <span className="text-blue-600">{user?.contactPersonName || user?.email || 'Admin'}</span>!
            </h1>
            <p className="text-lg text-gray-700 mb-8 flex items-center">
                <AlertCircle size={20} className="inline-block mr-2 text-blue-600" />
                <span className="font-semibold">Admin Privileges:</span> You have full access to manage customers, leads, staff, and more.
            </p>

            {/* Main KPI Cards - Larger and more prominent */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Customers */}
                <div className="bg-white p-6 rounded-lg shadow-xl border-b-4 border-blue-600 transform hover:scale-105 transition-transform duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-700">Total Customers</h3>
                        <Users size={32} className="text-blue-500 opacity-70" />
                    </div>
                    <p className="text-5xl font-bold text-blue-800">{stats.totalCustomers}</p>
                </div>
                {/* Total Revenue */}
                <div className="bg-white p-6 rounded-lg shadow-xl border-b-4 border-green-600 transform hover:scale-105 transition-transform duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-700">Total Revenue</h3>
                        <DollarSign size={32} className="text-green-500 opacity-70" />
                    </div>
                    <p className="text-5xl font-bold text-green-800">{formatCurrency(stats.totalRevenue)}</p>
                </div>
                {/* Jobs Completed */}
                <div className="bg-white p-6 rounded-lg shadow-xl border-b-4 border-purple-600 transform hover:scale-105 transition-transform duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-700">Jobs Completed</h3>
                        <CalendarCheck size={32} className="text-purple-500 opacity-70" />
                    </div>
                    <p className="text-5xl font-bold text-purple-800">{stats.totalCompletedJobs}</p>
                </div>
                {/* New Leads */}
                <div className="bg-white p-6 rounded-lg shadow-xl border-b-4 border-orange-600 transform hover:scale-105 transition-transform duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-700">Total Leads</h3>
                        <UserPlus size={32} className="text-orange-500 opacity-70" />
                    </div>
                    <p className="text-5xl font-bold text-orange-800">{stats.totalLeads}</p>
                </div>
            </div>

            {/* Today's Bookings and Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {/* Today's Bookings / Jobs Today */}
                <div className="lg:col-span-1 xl:col-span-2 bg-white p-6 rounded-lg shadow-xl border-t-4 border-indigo-500">
                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                        <Clock size={28} className="mr-3 text-indigo-600" /> Today's Bookings ({stats.jobsTodayCount})
                        <Link to="/scheduler" className="ml-auto text-blue-600 hover:underline text-base font-normal flex items-center">
                            View Full Schedule <ChevronRight size={16} className="ml-1" />
                        </Link>
                    </h3>
                    {jobDetailsToday.length > 0 ? (
                        <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
                            {jobDetailsToday.map(job => (
                                <div key={job.id} className="border border-gray-200 rounded-md p-3 bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center">
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900">{job.customerName}</p>
                                        <p className="text-sm text-gray-600 flex items-center"><MapPin size={16} className="mr-1" />{job.address?.street || 'N/A'}, {job.address?.city || 'N/A'}</p>
                                        <p className="text-sm text-gray-600 flex items-center"><Clock size={16} className="mr-1" />{formatTime(job.time)}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                        job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                        job.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {job.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-10">No bookings scheduled for today.</p>
                    )}
                </div>

                {/* Recent Activity Feed */}
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-xl border-t-4 border-pink-500">
                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                        <History size={28} className="mr-3 text-pink-600" /> Recent Activity
                    </h3>
                    <div className="space-y-4">
                        {recentActivity.jobs.length > 0 && (
                            <div>
                                <h4 className="font-bold text-gray-700 mb-2 flex items-center"><Briefcase size={18} className="mr-2" /> Latest Jobs</h4>
                                <ul className="text-sm space-y-1">
                                    {recentActivity.jobs.map(job => (
                                        <li key={job.id} className="flex justify-between items-center text-gray-700">
                                            <span>Job: {job.type} for {job.customer}</span>
                                            <span className="text-gray-500">{formatDate(job.date)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {recentActivity.invoices.length > 0 && (
                            <div>
                                <h4 className="font-bold text-gray-700 mb-2 flex items-center mt-4"><FileText size={18} className="mr-2" /> Latest Invoices</h4>
                                <ul className="text-sm space-y-1">
                                    {recentActivity.invoices.map(invoice => (
                                        <li key={invoice.id} className="flex justify-between items-center text-gray-700">
                                            <span>Inv #{invoice.number} ({formatCurrency(invoice.amount)})</span>
                                            <span className="text-gray-500">for {invoice.customer}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {recentActivity.leads.length > 0 && (
                            <div>
                                <h4 className="font-bold text-gray-700 mb-2 flex items-center mt-4"><UserPlus size={18} className="mr-2" /> New Leads</h4>
                                <ul className="text-sm space-y-1">
                                    {recentActivity.leads.map(lead => (
                                        <li key={lead.id} className="flex justify-between items-center text-gray-700">
                                            <span>{lead.name}</span>
                                            <span className="text-gray-500">({lead.source})</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {recentActivity.jobs.length === 0 && recentActivity.invoices.length === 0 && recentActivity.leads.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No recent activity to display.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Other Important Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Jobs by Status Chart/List */}
                <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-indigo-500">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <BarChart size={24} className="mr-2 text-indigo-600" /> Jobs by Status
                    </h3>
                    {Object.keys(jobsByStatus).length > 0 ? (
                        <ul className="space-y-2">
                            {Object.entries(jobsByStatus).map(([status, count]) => (
                                <li key={status} className="flex justify-between items-center text-gray-700">
                                    <span className="font-medium">{status}:</span>
                                    <span className="font-bold">{count}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">No job status data available.</p>
                    )}
                    <Link to="/jobs" className="text-indigo-600 hover:underline mt-4 inline-block">Manage All Jobs</Link>
                </div>

                {/* Staff Availability Summary */}
                <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-teal-500">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <UserCheck size={24} className="mr-2 text-teal-600" /> Staff Availability
                    </h3>
                    {Object.keys(staffAvailability).length > 0 ? (
                        <ul className="space-y-2">
                            {Object.entries(staffAvailability).map(([status, count]) => (
                                <li key={status} className="flex justify-between items-center text-gray-700">
                                    <span className="font-medium">{status}:</span>
                                    <span className="font-bold">{count}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">No staff availability data available.</p>
                    )}
                    <Link to="/staff" className="text-teal-600 hover:underline mt-4 inline-block">Manage Staff</Link>
                </div>

                {/* Low Stock Alert */}
                <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-red-500">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <AlertCircle size={24} className="mr-2 text-red-600" /> Low Stock Alert
                    </h3>
                    {stats.lowStockItemsCount > 0 ? (
                        <p className="text-red-700 font-bold text-lg">
                            You have {stats.lowStockItemsCount} items below re-order level!
                        </p>
                    ) : (
                        <p className="text-green-700 font-semibold text-lg">
                            All stock levels are healthy.
                        </p>
                    )}
                    <Link to="/stock" className="text-red-600 hover:underline mt-4 inline-block">View Stock</Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;