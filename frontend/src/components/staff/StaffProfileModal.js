import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../common/Modal'; // Assuming correct path
import Loader from '../common/Loader'; // Assuming correct path
import api from '../../utils/api'; // Your API utility
import { format, isValid } from 'date-fns';
import { Link } from 'react-router-dom';
import {
    User, Mail, Phone, MapPin, Briefcase, ClipboardList, DollarSign,
    Clock, CalendarCheck, TrendingUp, AlertCircle, Calendar, BriefcaseMedical,
    PlusCircle, Pencil, FileText, ReceiptText, Megaphone, BarChart3, LineChart
} from 'lucide-react'; // Lucide icons

const StaffProfileModal = ({ isOpen, onClose, staffId, onStaffUpdated }) => {
    const [staffMember, setStaffMember] = useState(null);
    const [staffStats, setStaffStats] = useState(null); // New state for aggregated staff stats
    const [jobs, setJobs] = useState([]); // Staff's recent jobs
    const [absences, setAbsences] = useState([]); // Staff's absences
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Helper functions for formatting
    const formatCurrency = (amount) => `£${parseFloat(amount || 0).toFixed(2)}`;
    const formatDate = (dateString) => isValid(new Date(dateString)) ? format(new Date(dateString), 'dd/MM/yyyy') : 'N/A';
    const formatTime = (timeString) => timeString || 'N/A';

    const fetchStaffData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!staffId) {
                setError("No staff ID provided.");
                setIsLoading(false);
                return;
            }

            // Fetch staff details, stats, jobs, and absences concurrently
            const [staffRes, statsRes, jobsRes, absencesRes] = await Promise.all([
                api.get(`/staff/${staffId}`),
                api.get(`/staff/${staffId}/stats`), // New backend endpoint for staff stats
                api.get(`/jobs?assignedStaff=${staffId}&limit=50&sort=-date`), // Fetch jobs assigned to this staff
                api.get(`/staff/${staffId}/absences`), // Fetch staff's absence periods
            ]);

            setStaffMember(staffRes.data);
            setStaffStats(statsRes.data);
            setJobs(jobsRes.data);
            setAbsences(absencesRes.data);

        } catch (err) {
            console.error("Error fetching staff profile data:", err);
            setError(err.response?.data?.message || "Failed to load staff profile data. Ensure backend endpoints are correct.");
        } finally {
            setIsLoading(false);
        }
    }, [staffId]);

    useEffect(() => {
        if (isOpen && staffId) {
            fetchStaffData();
        }
    }, [isOpen, staffId, fetchStaffData]);

    const handleEditStaff = () => {
        onClose(); // Close this modal first
        onStaffUpdated(staffMember); // Pass the staff member object back to parent to trigger edit modal
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Profile: ${staffMember?.contactPersonName || 'Loading...'}`} maxWidthClass="max-w-7xl">
            {isLoading ? (
                <div className="p-8 text-center min-h-[400px] flex items-center justify-center">
                    <Loader /><p className="mt-2 text-gray-700">Loading profile data...</p>
                </div>
            ) : error ? (
                <div className="p-8 text-center text-red-600 min-h-[400px] flex flex-col items-center justify-center">
                    <p>{error}</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                </div>
            ) : !staffMember ? (
                <div className="p-8 text-center text-gray-700 min-h-[400px] flex flex-col items-center justify-center">
                    <p>Staff data could not be loaded.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                </div>
            ) : (
                <div className="p-8 space-y-8 bg-gray-50 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {/* Header Section with Staff Name and Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-gray-200">
                        <div className="mb-4 sm:mb-0">
                            <h2 className="text-4xl font-extrabold text-gray-900 flex items-center">
                                <User size={38} className="mr-4 text-blue-600" />
                                {staffMember.contactPersonName}
                            </h2>
                            <p className="text-xl text-gray-600 mt-2 ml-12 flex items-center">
                                <Briefcase size={24} className="mr-2 text-gray-500" /> {staffMember.role.toUpperCase()} | Employee ID: {staffMember.employeeId || 'N/A'}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                            <button
                                onClick={handleEditStaff}
                                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center"
                            >
                                <Pencil size={18} className="mr-2" /> Edit Profile
                            </button>
                        </div>
                    </div>

                    {/* Staff Stats / Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white p-6 rounded-lg shadow-xl">
                        <div className="text-center">
                            <CalendarCheck size={36} className="text-green-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Jobs Completed</h3>
                            <p className="text-3xl font-bold text-green-800">{staffStats?.totalJobsCompleted || 0}</p>
                        </div>
                        <div className="text-center">
                            <DollarSign size={36} className="text-blue-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Total Commission</h3>
                            <p className="text-3xl font-bold text-blue-800">{formatCurrency(staffStats?.totalCommissionEarned || 0)}</p>
                        </div>
                        <div className="text-center">
                            <Clock size={36} className="text-purple-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Total Hours Logged</h3>
                            <p className="text-3xl font-bold text-purple-800">{staffStats?.totalHoursLogged?.toFixed(1) || 0} hrs</p>
                        </div>
                        <div className="text-center">
                            <AlertCircle size={36} className="text-orange-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-gray-700">Pending Absences</h3>
                            <p className="text-3xl font-bold text-orange-800">{staffStats?.pendingAbsencesCount || 0}</p>
                        </div>
                    </div>

                    {/* Core Details and Activity/Absence Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Contact and Address Details (Left Column) */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500 h-fit">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><User size={24} className="mr-2 text-blue-600" /> Contact Information</h3>
                            <p className="flex items-center text-gray-700 mb-2"><Mail size={18} className="mr-2 flex-shrink-0" /> {staffMember.email || 'N/A'}</p>
                            <p className="flex items-center text-gray-700 mb-2"><Phone size={18} className="mr-2 flex-shrink-0" /> {staffMember.phone || 'N/A'}</p>
                            <p className="flex items-start text-gray-700"><MapPin size={18} className="mr-2 flex-shrink-0" />
                                {staffMember.address ? (
                                    <>
                                        {staffMember.address.street || ''}<br />
                                        {staffMember.address.city || ''}, {staffMember.address.county || ''}<br />
                                        {staffMember.address.postcode || ''}, {staffMember.address.country || ''}
                                    </>
                                ) : 'N/A Address'}
                            </p>
                        </div>

                        {/* Recent Jobs List */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Briefcase size={24} className="mr-2 text-green-600" /> Recent Jobs</h3>
                            {jobs.length > 0 ? (
                                <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                    {jobs.slice(0, 5).map(job => (
                                        <li key={job._id} className="flex justify-between items-center text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-100">
                                            <div>
                                                <p className="font-medium">{job.serviceType}</p>
                                                <p className="text-xs text-gray-500">
                                                    {job.customer?.contactPersonName ? `for ${job.customer.contactPersonName}` : 'N/A Customer'} | {formatDate(job.date)}
                                                </p>
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
                                <p className="text-gray-500 text-sm">No recent jobs found for this staff member.</p>
                            )}
                            <Link to={`/jobs?assignedStaff=${staffId}`} className="text-blue-600 hover:underline mt-4 inline-block text-sm">View All Assigned Jobs</Link>
                        </div>

                        {/* Recent Absences List */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md border-t-4 border-red-500">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Calendar size={24} className="mr-2 text-red-600" /> Recent Absences</h3>
                            {absences.length > 0 ? (
                                <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                    {absences.slice(0, 5).map(absence => (
                                        <li key={absence._id} className="flex justify-between items-center text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-100">
                                            <div>
                                                <p className="font-medium">{absence.type}</p>
                                                <p className="text-xs text-gray-500">{formatDate(absence.start)} to {formatDate(absence.end)}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                absence.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                absence.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>{absence.status}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 text-sm">No recent absence records.</p>
                            )}
                            <Link to={`/staff-absence?staffId=${staffId}`} className="text-blue-600 hover:underline mt-4 inline-block text-sm">View All Absences</Link>
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

export default StaffProfileModal;