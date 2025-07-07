// src/components/customerPortal/CustomerDashboard.jsx

import React from 'react';
import { useAuth } from '../context/AuthContext'; // Assuming useAuth provides user data

const CustomerDashboard = () => {
    const { user, logout } = useAuth(); // Destructure logout from useAuth()

    if (!user) {
        return <div className="p-8 text-center text-gray-600">Please log in to access the customer portal.</div>;
    }

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-3xl font-extrabold text-gray-800">Welcome to Your Customer Portal, {user.contactPersonName || user.email}!</h1>
                <button
                    onClick={logout} // Call the logout function from useAuth
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 shadow-md"
                >
                    Logout
                </button>
            </div>

            <p className="text-lg text-gray-600 mb-8">This is your personalized dashboard where you can manage your services, requests, and account information.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Placeholder Cards for Future Features */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-blue-800 mb-2">View Invoices</h3>
                    <p className="text-blue-700">Access and review all your past and current invoices.</p>
                    <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Go to Invoices</button>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-green-800 mb-2">Request a Quote</h3>
                    <p className="text-green-700">Need a new service? Request a personalized quote from our team.</p>
                    <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Request Quote</button>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-yellow-800 mb-2">Manage Appointments</h3>
                    <p className="text-yellow-700">View your upcoming appointments or request to reschedule.</p>
                    <button className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">View Appointments</button>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-red-800 mb-2">Emergency Service</h3>
                    <p className="text-red-700">For urgent issues, book an emergency appointment quickly.</p>
                    <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Book Emergency</button>
                </div>
            </div>
        </div>
    );
};

export default CustomerDashboard;