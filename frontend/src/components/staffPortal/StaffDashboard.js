// src/components/staffPortal/StaffDashboard.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../../utils/api';
import Loader from '../common/Loader';
import { MapPin, Clock, CheckCircle2, XCircle, ChevronRight, Gps } from 'lucide-react'; // Keep icons, some still used directly

// NEW: Import the StaffJobCard component
import StaffJobCard from './StaffJobCard'; // Assuming StaffJobCard.js is in the same folder

const StaffDashboard = () => {
    const { user, logout } = useAuth();
    const [assignedJobs, setAssignedJobs] = useState([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    // actionLoading state moved inside StaffJobCard to manage its own loading per card
    // const [actionLoading, setActionLoading] = useState(null); 

    // Fetch jobs assigned to the logged-in staff member
    const fetchAssignedJobs = useCallback(async () => {
        setIsLoadingJobs(true);
        setFetchError(null);
        try {
            if (!user?.staff?._id) { 
                setFetchError("Staff profile not available. Cannot fetch assigned jobs.");
                setIsLoadingJobs(false); 
                return;
            }
            const today = new Date().toISOString().split('T')[0];
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            console.log("DEBUG: Fetching jobs for staffId:", user.staff._id, "from", today, "to", tomorrow.toISOString().split('T')[0]);

            const res = await api.get('/jobs', {
                params: {
                    staffId: user.staff._id,
                    startDate: today,
                    endDate: tomorrow.toISOString().split('T')[0],
                }
            });
            const filteredJobs = res.data.filter(job => job.status !== 'Completed' && job.status !== 'Cancelled')
                                         .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            setAssignedJobs(filteredJobs);
            console.log("DEBUG: Fetched Jobs Response Data:", res.data);
            console.log("DEBUG: Filtered and Assigned Jobs:", filteredJobs);

        } catch (err) {
            console.error("DEBUG ERROR: Error fetching assigned jobs for Staff Dashboard:", err);
            setFetchError(err.response?.data?.message || "Failed to load your assigned jobs.");
        } finally {
            setIsLoadingJobs(false); 
        }
    }, [user]);

    useEffect(() => {
        if (user?.staff?._id) {
            fetchAssignedJobs();
        }
    }, [user, fetchAssignedJobs]);

    const handleJobUpdatedInCard = useCallback((updatedJob) => {
        setAssignedJobs(prevJobs => prevJobs.map(job => 
            job._id === updatedJob._id ? updatedJob : job
        ));
        if (updatedJob.status === 'Completed' || updatedJob.status === 'Cancelled') {
            fetchAssignedJobs(); 
        }
    }, [fetchAssignedJobs]);

    const handleJobActionError = useCallback((errorMsg) => {
        setFetchError(errorMsg); 
    }, []);

    if (!user || user.loading || !user.staff) { 
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader className="animate-spin inline-block mr-2" />
                <p className="text-xl text-gray-700">Loading staff profile...</p>
            </div>
        );
    }

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

            {fetchError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {fetchError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm col-span-full">
                    <h3 className="text-xl font-semibold text-blue-800 mb-4 flex items-center gap-2">
                        <MapPin size={24} /> Your Assigned Jobs (Today/Tomorrow)
                    </h3>
                    {isLoadingJobs ? (
                        // FIX: Changed <p> to <div> to resolve DOM nesting warning
                        <div className="text-blue-700 text-center flex items-center justify-center">
                            <Loader className="animate-spin inline-block mr-2" />
                            <span>Loading your jobs...</span>
                        </div>
                    ) : assignedJobs.length === 0 ? (
                        <p className="text-blue-700 text-center">No jobs assigned for today or tomorrow.</p>
                    ) : (
                        <div className="space-y-4">
                            {assignedJobs.map(job => (
                                <StaffJobCard
                                    key={job._id}
                                    job={job}
                                    onJobUpdated={handleJobUpdatedInCard} 
                                    onActionError={handleJobActionError} 
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Other Feature Cards */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-green-800 mb-2">My Schedule</h3>
                    <p className="text-green-700">See your upcoming appointments and daily routes.</p>
                    <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">View Schedule</button>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-yellow-800 mb-2">Holiday & Leave</h3>
                    <p className="text-yellow-700">Request time off or view your holiday allowance.</p>
                    <button className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">Request Holiday</button>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-sm opacity-60 cursor-not-allowed">
                    <h3 className="text-xl font-semibold text-purple-800 mb-2">View Pay</h3>
                    <p className="text-purple-700">Access your payslips and payroll information. (Coming Soon)</p>
                    <button disabled className="mt-4 px-4 py-2 bg-purple-400 text-white rounded-md">View Payslips</button>
                </div>

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

