// src/components/staffPortal/StaffDashboard.jsx

import React from 'react';
import { useAuth } from '../context/AuthContext'; // Assuming useAuth provides user data

const StaffDashboard = () => {
    const { user, logout } = useAuth(); // Destructure logout function

    if (!user) {
        return <div className="p-8 text-center text-gray-600">Please log in to access the staff portal.</div>;
    }

    // Access staff-specific data from user.staff (populated by authMiddleware)
    // Fallback to user.contactPersonName or user.email if staff object isn't fully populated
    const staffName = user.staff?.contactPersonName || user.contactPersonName || user.email;

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-3xl font-extrabold text-gray-800">Staff Dashboard</h1>
                <button
                    onClick={logout}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 shadow-md"
                >
                    Logout
                </button>
            </div>

            <p className="text-lg text-gray-600 mb-8">Welcome, {staffName}! Here's a summary of your day and tasks.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Feature Card: Assigned Jobs */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-blue-800 mb-2">Your Assigned Jobs</h3>
                    <p className="text-blue-700">View and manage your upcoming and ongoing job assignments.</p>
                    <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">View Jobs</button>
                </div>

                {/* Feature Card: View Schedule */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-green-800 mb-2">My Schedule</h3>
                    <p className="text-green-700">See your upcoming appointments and daily routes.</p>
                    <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">View Schedule</button>
                </div>

                {/* Feature Card: Request Holiday */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-yellow-800 mb-2">Holiday & Leave</h3>
                    <p className="text-yellow-700">Request time off or view your holiday allowance.</p>
                    <button className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">Request Holiday</button>
                </div>

                {/* Placeholder: View Pay */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-sm opacity-60 cursor-not-allowed">
                    <h3 className="text-xl font-semibold text-purple-800 mb-2">View Pay</h3>
                    <p className="text-purple-700">Access your payslips and payroll information. (Coming Soon)</p>
                    <button disabled className="mt-4 px-4 py-2 bg-purple-400 text-white rounded-md">View Payslips</button>
                </div>

                {/* Placeholder: Report Sick Day */}
                 <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm opacity-60 cursor-not-allowed">
                    <h3 className="text-xl font-semibold text-red-800 mb-2">Report Sick Day</h3>
                    <p className="text-red-700">Notify management of a sick day. (Coming Soon)</p>
                    <button disabled className="mt-4 px-4 py-2 bg-red-400 text-white rounded-md">Report Sick Day</button>
                </div>
            </div>
        </div>
    );
};

export default StaffDashboard;