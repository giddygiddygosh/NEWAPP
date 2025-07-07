import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const { user } = useAuth();

    return (
        // The outermost div with p-8, bg-gradient-to-br, and min-h-screen
        // sets the background and minimum height for the entire content area.
        <div className="p-8 bg-gradient-to-br from-blue-50 to-purple-50 min-h-screen">
            {/* THIS IS THE CRUCIAL CHANGE TO FIX THE RIGHT-HAND GAP */}
            {/* Removed 'max-w-7xl' and 'mx-auto' to allow full width expansion. */}
            {/* 'w-full' makes this div take up 100% of its parent's width. */}
            {/* The 'p-8' on the outer div already provides sufficient padding around the whole content. */}
            <div className="w-full">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-8 tracking-tight">
                    Welcome to your Dashboard, <span className="text-blue-600">{user?.email}!</span>
                </h1>

                {/* Role-based Alert Messages */}
                {user?.role === 'admin' && (
                    <div className="flex items-center bg-blue-50 border-blue-400 text-blue-800 p-4 rounded-lg shadow-sm mb-6">
                        <svg className="h-6 w-6 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <div>
                            <p className="font-semibold text-lg">Admin Privileges</p>
                            <p className="text-sm">You have full access to manage customers, leads, staff, and more.</p>
                        </div>
                    </div>
                )}
                {user?.role === 'staff' && (
                    <div className="flex items-center bg-green-50 border-green-400 text-green-800 p-4 rounded-lg shadow-sm mb-6">
                        <svg className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                        <div>
                            <p className="font-semibold text-lg">Staff Portal</p>
                            <p className="text-sm">View your assigned jobs and manage your availability.</p>
                        </div>
                    </div>
                )}
                {user?.role === 'customer' && (
                    <div className="flex items-center bg-purple-50 border-purple-400 text-purple-800 p-4 rounded-lg shadow-sm mb-6">
                        <svg className="h-6 w-6 text-purple-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm12 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm12 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                        <div>
                            <p className="font-semibold text-lg">Customer Portal</p>
                            <p className="text-sm">View your bookings, invoices, and request new quotes.</p>
                        </div>
                    </div>
                )}

                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {/* Metric Card Example */}
                    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1 text-center">
                        <div className="bg-purple-100 p-3 rounded-full mx-auto w-16 h-16 flex items-center justify-center mb-4">
                            <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                        </div>
                        <h3 className="text-md font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Customers</h3>
                        <p className="text-4xl font-bold text-gray-900">42</p>
                    </div>

                    {/* Upcoming Jobs Card */}
                    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center mb-4">
                            <div className="bg-indigo-100 p-3 rounded-full mr-4">
                                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800">Upcoming Jobs</h3>
                        </div>
                        <p className="text-gray-600 mb-4">You have <span className="font-bold text-lg">3</span> jobs scheduled next week.</p>
                        <Link to="/jobs" className="text-blue-600 hover:text-blue-800 font-medium flex items-center">
                            View Schedule
                            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        </Link>
                    </div>

                    {/* Recent Invoices Card */}
                    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center mb-4">
                            <div className="bg-green-100 p-3 rounded-full mr-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800">Recent Invoices</h3>
                        </div>
                        <p className="text-gray-600 mb-4">Last invoice: <span className="font-bold text-lg text-green-700">#INV-2025-0012</span> for £450.00</p>
                        <Link to="/invoices" className="text-blue-600 hover:text-blue-800 font-medium flex items-center">
                            View All Invoices
                            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        </Link>
                    </div>

                    {/* Quick Actions Card */}
                    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center mb-4">
                            <div className="bg-yellow-100 p-3 rounded-full mr-4">
                                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800">Quick Actions</h3>
                        </div>
                        <ul className="space-y-2">
                            {user?.role === 'admin' && (
                                <>
                                    <li><Link to="/customers" className="text-blue-600 hover:text-blue-800 flex items-center"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h2a2 2 0 002-2V9.828a2 2 0 00-.586-1.414l-4.899-4.899A2 2 0 0012.172 3H5a2 2 0 00-2 2v10a2 2 0 002 2h2m4 2h6a2 2 0 002-2v-6H7v6a2 2 0 002 2z"></path></svg> Manage Customers</Link></li>
                                    <li><Link to="/leads" className="text-blue-600 hover:text-blue-800 flex items-center"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> Manage Leads</Link></li>
                                    <li><Link to="/staff" className="text-blue-600 hover:text-blue-800 flex items-center"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0H9m-9 0h-1m0 0H9m7 0h-5m-1 0H9"></path></svg> Manage Staff</Link></li>
                                </>
                            )}
                            {user?.role === 'staff' && (
                                <li><Link to="/staff-absence" className="text-blue-600 hover:text-blue-800 flex items-center"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> Report Absence</Link></li>
                            )}
                            {user?.role === 'customer' && (
                                <li><Link to="/customer-portal/request-quote" className="text-blue-600 hover:text-blue-800 flex items-center"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg> Request a Quote</Link></li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;