import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../../utils/api';
import Loader from '../common/Loader';
import { format } from 'date-fns';
import { CalendarDays, Briefcase, User, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom'; // Will need this for navigation back or to job details

const StaffSchedulePage = () => {
    const { user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const fetchStaffSchedule = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!user?.staff?._id) {
                setError("Staff profile not available. Cannot fetch schedule.");
                setIsLoading(false);
                return;
            }

            console.log(`Fetching full schedule for staffId: ${user.staff._id} from ${startDate} to ${endDate}`);
            const res = await api.get('/jobs', {
                params: {
                    staffId: user.staff._id,
                    startDate: startDate,
                    endDate: endDate,
                }
            });
            // Filter out completed/cancelled jobs if you only want active ones on the schedule
            const activeJobs = res.data.filter(job => job.status !== 'Completed' && job.status !== 'Cancelled');
            setJobs(activeJobs.sort((a, b) => new Date(a.date) - new Date(b.date) || (a.time || '').localeCompare(b.time || '')));
            console.log("Fetched Schedule Data:", res.data);
        } catch (err) {
            console.error("Error fetching staff schedule:", err);
            setError(err.response?.data?.message || err.message || "Failed to load schedule.");
        } finally {
            setIsLoading(false);
        }
    }, [user, startDate, endDate]);

    useEffect(() => {
        fetchStaffSchedule();
    }, [fetchStaffSchedule]);

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader />
                <p className="ml-2 text-xl text-gray-700">Loading schedule...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
                <h1 className="text-3xl font-extrabold text-gray-800 mb-6">Your Schedule</h1>
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-center">
                    {error}
                </div>
                <Link to="/staff-dashboard" className="text-blue-600 hover:underline">Back to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-3xl font-extrabold text-gray-800">Your Schedule</h1>
                <Link to="/staff-dashboard" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200 shadow-md">
                    Back to Dashboard
                </Link>
            </div>

            <div className="mb-6 flex flex-wrap gap-4 items-center">
                <label htmlFor="startDate" className="font-semibold text-gray-700">From:</label>
                <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={handleStartDateChange}
                    className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="endDate" className="font-semibold text-gray-700">To:</label>
                <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={handleEndDateChange}
                    className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Re-fetch button for convenience, though changing dates will re-trigger useEffect */}
                <button
                    onClick={fetchStaffSchedule}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
                >
                    <CalendarDays size={18} /> Apply Filter
                </button>
            </div>

            {jobs.length === 0 ? (
                <p className="text-gray-700 text-lg text-center mt-8">No jobs found for the selected date range.</p>
            ) : (
                <div className="space-y-6">
                    {jobs.map(job => (
                        <div key={job._id} className="bg-blue-50 border border-blue-200 p-5 rounded-lg shadow-sm">
                            <h3 className="text-xl font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <Briefcase size={20} /> {job.serviceType}
                            </h3>
                            <p className="text-sm text-gray-700 mb-2">
                                <CalendarDays size={16} className="inline-block mr-1 text-blue-600" />
                                Date: {format(new Date(job.date), 'dd/MM/yyyy')} @ {job.time}
                            </p>
                            <p className="text-sm text-gray-700 mb-2">
                                <User size={16} className="inline-block mr-1 text-purple-600" />
                                Customer: {job.customer?.contactPersonName || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-700 mb-2">
                                <MapPin size={16} className="inline-block mr-1 text-green-600" />
                                Address: {job.address?.street}, {job.address?.city}, {job.address?.postcode}
                            </p>
                            <p className="text-sm text-gray-700">
                                <Clock size={16} className="inline-block mr-1 text-yellow-600" />
                                Status: <span className={`font-semibold ${job.status === 'Completed' ? 'text-green-700' : job.status === 'In Progress' ? 'text-yellow-700' : 'text-blue-700'}`}>{job.status}</span>
                            </p>
                            {/* You could add a button here to view job details for each scheduled job */}
                            {/* <Link to={`/staff-job-details/${job._id}`} className="mt-3 inline-block px-3 py-1 bg-indigo-500 text-white rounded-md text-sm hover:bg-indigo-600">
                                View Details
                            </Link> */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StaffSchedulePage;