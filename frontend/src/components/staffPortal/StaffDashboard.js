// src/components/staffPortal/StaffDashboard.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../../utils/api';
import Loader from '../common/Loader';
import { MapPin, Clock, CheckCircle2, XCircle, ChevronRight, Gps, CalendarDays, BriefcaseMedical, LogIn, LogOut, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isValid } from 'date-fns';
import { toast } from 'react-toastify';

import StaffJobCard from './StaffJobCard';
import StaffAbsenceRequestModal from './StaffAbsenceRequestModal';

const StaffDashboard = () => {
    const { user, logout } = useAuth();
    const [assignedJobs, setAssignedJobs] = useState([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    // State for absence request modal
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [absenceRequestType, setAbsenceRequestType] = useState('Holiday');

    // State for staff's own absence requests
    const [myAbsenceRequests, setMyAbsenceRequests] = useState([]);
    const [isLoadingMyAbsences, setIsLoadingMyAbsences] = useState(true);
    const [myAbsencesError, setMyAbsencesError] = useState(null);

    // NEW STATES FOR DAILY CLOCK-IN/OUT
    const [dailyStatus, setDailyStatus] = useState({
        isClockedIn: false,
        clockInTime: null,
        clockOutTime: null,
        totalMinutes: 0,
        recordId: null,
    });
    const [isLoadingDailyStatus, setIsLoadingDailyStatus] = useState(true);
    const [dailyActionLoading, setDailyActionLoading] = useState(null); // 'clockIn', 'clockOut'

    // NEW STATES FOR PAYSLIPS
    const [recentPayslips, setRecentPayslips] = useState([]);
    const [isLoadingPayslips, setIsLoadingPayslips] = useState(true);
    const [payslipsError, setPayslipsError] = useState(null);


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

            const res = await api.get('/jobs', {
                params: {
                    staffId: user.staff._id,
                    startDate: today,
                    endDate: tomorrow.toISOString().split('T')[0],
                }
            });

            const initialFilteredJobs = res.data
                .filter(job => job != null && job._id && job.status !== 'Completed' && job.status !== 'Cancelled')
                .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            setAssignedJobs(initialFilteredJobs);
        } catch (err) {
            console.error("DEBUG ERROR: Error fetching assigned jobs for Staff Dashboard:", err);
            setFetchError(err.response?.data?.message || err.message || "Failed to load your assigned jobs. Check network.");
        } finally {
            setIsLoadingJobs(false);
        }
    }, [user]);

    const fetchMyAbsenceRequests = useCallback(async () => {
        setIsLoadingMyAbsences(true);
        setMyAbsencesError(null);
        try {
            if (!user?.staff?._id) {
                setMyAbsencesError("Staff profile not available. Cannot fetch absence requests.");
                setIsLoadingMyAbsences(false);
                return;
            }
            const res = await api.get(`/staff/${user.staff._id}/absences`);
            setMyAbsenceRequests(res.data);
        } catch (err) {
            setMyAbsencesError(err.response?.data?.message || err.message || "Failed to load your absence requests.");
            console.error("Error fetching my absence requests:", err);
        } finally {
            setIsLoadingMyAbsences(false);
        }
    }, [user]);

    // Fetch current daily clock-in/out status
    const fetchDailyStatus = useCallback(async () => {
        setIsLoadingDailyStatus(true);
        try {
            if (!user?.staff?._id) {
                setDailyStatus({ isClockedIn: false, clockInTime: null, clockOutTime: null, totalMinutes: 0, recordId: null });
                setIsLoadingDailyStatus(false);
                return;
            }
            const res = await api.get(`/daily-time/status/${user.staff._id}`);
            setDailyStatus(res.data);
            console.log("Daily Status Fetched:", res.data);
        } catch (err) {
            console.error("Error fetching daily status:", err);
            toast.error("Failed to load daily clock status.");
            setDailyStatus({ isClockedIn: false, clockInTime: null, clockOutTime: null, totalMinutes: 0, recordId: null }); // Reset on error
        } finally {
            setIsLoadingDailyStatus(false);
        }
    }, [user]);

    // Fetch recent payslips for the staff member
    const fetchRecentPayslips = useCallback(async () => {
        setIsLoadingPayslips(true);
        setPayslipsError(null);
        try {
            if (!user?.staff?._id) {
                setPayslipsError("Staff profile not available. Cannot fetch payslips.");
                setIsLoadingPayslips(false);
                return;
            }
            // Ensure this endpoint is correctly implemented in your backend payroll routes
            const res = await api.get(`/payroll/payslips/staff/${user.staff._id}`);
            setRecentPayslips(res.data);
        } catch (err) {
            console.error("Error fetching recent payslips:", err);
            setPayslipsError(err.response?.data?.message || err.message || "Failed to load recent payslips.");
        } finally {
            setIsLoadingPayslips(false);
        }
    }, [user]);


    useEffect(() => {
        if (user?.staff?._id) {
            fetchAssignedJobs();
            fetchMyAbsenceRequests();
            fetchDailyStatus();
            fetchRecentPayslips(); // Call new payslip fetch function
        }
    }, [user, fetchAssignedJobs, fetchMyAbsenceRequests, fetchDailyStatus, fetchRecentPayslips]);


    const handleJobUpdatedInCard = useCallback((updatedJob) => {
        setAssignedJobs(prevJobs => {
            if (!updatedJob || !updatedJob._id) {
                console.warn("handleJobUpdatedInCard received an invalid updatedJob:", updatedJob);
                return prevJobs;
            }

            const cleanedPrevJobs = prevJobs.filter(job => job != null && job._id);

            const updatedList = cleanedPrevJobs.map(job => {
                if (job._id === updatedJob._id) {
                    return updatedJob;
                }
                return job;
            });

            const finalFilteredList = updatedList.filter(job =>
                job.status !== 'Completed' && job.status !== 'Cancelled'
            );

            return finalFilteredList;
        });
        setFetchError(null);
    }, []);

    const handleJobActionError = useCallback((err) => {
        console.error("Action error from StaffJobCard:", err);
        let errorMessage = 'An unknown error occurred during job action.';
        if (err) {
            errorMessage = err.response?.data?.message || err.message || errorMessage;
        }
        setFetchError(errorMessage);
        setTimeout(() => setFetchError(null), 5000);
    }, []);

    const openAbsenceModal = useCallback((type) => {
        setAbsenceRequestType(type);
        setIsAbsenceModalOpen(true);
    }, []);

    const closeAbsenceModal = useCallback(() => {
        setIsAbsenceModalOpen(false);
        setAbsenceRequestType('Holiday');
    }, []);

    const handleSaveAbsenceRequest = useCallback(async (formData) => {
        try {
            const res = await api.post(`/staff/${formData.staff}/absences`, formData);
            toast.success("Absence request submitted successfully!");
            fetchMyAbsenceRequests(); // Refresh staff's own absence list after submission
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Failed to submit absence request.";
            toast.error(`Error: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }, [fetchMyAbsenceRequests]);

    // Clock In/Out Daily Handlers
    const handleClockInDaily = useCallback(async () => {
        setDailyActionLoading('clockIn');
        try {
            const res = await api.post('/daily-time/clock-in', { staffId: user.staff._id });
            toast.success(res.data.message);
            fetchDailyStatus(); // Refresh status after action
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Failed to clock in.";
            toast.error(`Error: ${errorMessage}`);
            console.error("Error clocking in daily:", err);
        } finally {
            setDailyActionLoading(null);
        }
    }, [user, fetchDailyStatus]);

    const handleClockOutDaily = useCallback(async () => {
        setDailyActionLoading('clockOut');
        try {
            const res = await api.post('/daily-time/clock-out', { staffId: user.staff._id });
            toast.success(res.data.message);
            fetchDailyStatus(); // Refresh status after action
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Failed to clock out.";
            toast.error(`Error: ${errorMessage}`);
            console.error("Error clocking out daily:", err);
        } finally {
            setDailyActionLoading(null);
        }
    }, [user, fetchDailyStatus]);


    // Helper for status classes (copied from StaffAbsenceView for consistency)
    const getStatusClasses = (status) => {
        switch (status) {
            case 'Pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Approved':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'Rejected':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'Cancelled':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        const date = new Date(timeString);
        return isValid(date) ? format(date, 'hh:mm a') : 'Invalid Date';
    };

    // Helper functions for Payslip display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
    };
    const formatAmount = (amount) => {
        const num = parseFloat(amount);
        return isNaN(num) ? '0.00' : num.toFixed(2);
    };


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
                {/* Daily Clock-in/out Section */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-sm col-span-full">
                    <h3 className="text-xl font-semibold text-purple-800 mb-4 flex items-center gap-2">
                        <Clock size={24} /> Daily Clock-in / Clock-out
                    </h3>
                    {isLoadingDailyStatus ? (
                        <div className="text-purple-700 text-center flex items-center justify-center">
                            <Loader className="animate-spin inline-block mr-2" />
                            <span>Loading daily status...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-between">
                            <div className="text-lg text-gray-700 mb-3 sm:mb-0">
                                <p className="font-medium">Status:
                                    <span className={`ml-2 font-semibold ${dailyStatus.isClockedIn ? 'text-green-600' : 'text-red-600'}`}>
                                        {dailyStatus.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                                    </span>
                                </p>
                                {dailyStatus.clockInTime && (
                                    <p className="text-sm">Clock In: {formatTime(dailyStatus.clockInTime)}</p>
                                )}
                                {dailyStatus.clockOutTime && (
                                    <p className="text-sm">Clock Out: {formatTime(dailyStatus.clockOutTime)}</p>
                                )}
                                {dailyStatus.totalMinutes > 0 && (
                                    <p className="text-sm">Total Today: {dailyStatus.totalMinutes} mins</p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                {!dailyStatus.isClockedIn && (
                                    <button
                                        onClick={handleClockInDaily}
                                        disabled={dailyActionLoading === 'clockIn'}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                    >
                                        {dailyActionLoading === 'clockIn' ? <Loader className="animate-spin mr-2" size={18} /> : <LogIn size={18} className="mr-2" />}
                                        Clock In
                                    </button>
                                )}
                                {dailyStatus.isClockedIn && (
                                    <button
                                        onClick={handleClockOutDaily}
                                        disabled={dailyActionLoading === 'clockOut'}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                    >
                                        {dailyActionLoading === 'clockOut' ? <Loader className="animate-spin mr-2" size={18} /> : <LogOut size={18} className="mr-2" />}
                                        Clock Out
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Your Assigned Jobs (Today/Tomorrow) Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm col-span-full">
                    <h3 className="text-xl font-semibold text-blue-800 mb-4 flex items-center gap-2">
                        <MapPin size={24} /> Your Assigned Jobs (Today/Tomorrow)
                    </h3>
                    {isLoadingJobs ? (
                        <div className="text-blue-700 text-center flex items-center justify-center">
                            <Loader className="animate-spin inline-block mr-2" />
                            <span>Loading your jobs...</span>
                        </div>
                    ) : assignedJobs.length === 0 ? (
                        <p className="text-blue-700 text-center">No jobs assigned for today or tomorrow.</p>
                    ) : (
                        <div className="space-y-4">
                            {assignedJobs.map(job => (
                                job && job._id ? (
                                    <StaffJobCard
                                        key={job._id}
                                        job={job}
                                        onJobUpdated={handleJobUpdatedInCard}
                                        onActionError={handleJobActionError}
                                    />
                                ) : (
                                    <p key={`invalid-${Math.random()}`} className="text-red-500">
                                        Error: Corrupted job data encountered for a card.
                                    </p>
                                )
                            ))}
                        </div>
                    )}
                </div>

                {/* My Schedule Card */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-green-800 mb-2">My Schedule</h3>
                    <p className="text-green-700">See your upcoming appointments and daily routes.</p>
                    <Link
                        to="/staff-schedule"
                        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-md block text-center"
                    >
                        View Schedule
                    </Link>
                </div>

                {/* Holiday & Leave Card */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-yellow-800 mb-2">Holiday & Leave</h3>
                    <p className="text-yellow-700">Request time off or view your holiday allowance.</p>
                    <button
                        onClick={() => openAbsenceModal('Holiday')}
                        className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors shadow-md"
                    >
                        Request Holiday
                    </button>
                </div>

                {/* NEW/UPDATED: View Pay Section (Payroll Display) */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-purple-800 mb-2 flex items-center gap-2">
                        <DollarSign size={24} /> Your Recent Pay
                    </h3>
                    {isLoadingPayslips ? (
                        <div className="text-purple-700 text-center flex items-center justify-center">
                            <Loader className="animate-spin inline-block mr-2" />
                            <span>Loading payslip history...</span>
                        </div>
                    ) : payslipsError ? (
                        <p className="text-red-600 text-sm">{payslipsError}</p>
                    ) : recentPayslips.length === 0 ? (
                        <p className="text-gray-500 text-sm">No recent payslips available yet.</p>
                    ) : (
                        <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                            {recentPayslips.map(payslip => (
                                <div key={payslip._id} className="border border-purple-100 rounded-md p-2 bg-white">
                                    <p className="text-sm font-semibold text-gray-700">
                                        Pay Period: {formatDate(payslip.payPeriodStart)} - {formatDate(payslip.payPeriodEnd)}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        Frequency: {payslip.payFrequency || 'N/A'}
                                    </p>
                                    <p className="text-lg text-green-700 font-extrabold mt-1">
                                        Net Pay: £{formatAmount(payslip.netPay)}
                                    </p>
                                    <Link
                                        to={`/my-payslips?payslipId=${payslip._id}`} // Updated link for staff's own payslips
                                        className="text-blue-600 hover:underline text-xs inline-block mt-1"
                                        title="View full payslip details"
                                    >
                                        View Details <ChevronRight size={12} className="inline-block ml-0.5" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                    <Link
                        to="/my-payslips" // Updated link to the new dedicated staff payslips page
                        className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-md block text-center text-sm font-medium"
                    >
                        Go to My Payslips
                    </Link>
                </div>

                {/* Report Sick Day Card */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-red-800 mb-2">Report Sick Day</h3>
                    <p className="text-red-700">Notify management of a sick day.</p>
                    <button
                        onClick={() => openAbsenceModal('Sick')}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-md"
                    >
                        Report Sick Day
                    </button>
                </div>
            </div>

            <div className="mt-10 bg-white rounded-lg shadow-xl p-6 border-t border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <BriefcaseMedical size={24} /> Your Absence Requests
                </h3>
                {isLoadingMyAbsences ? (
                    <div className="text-gray-700 text-center flex items-center justify-center">
                        <Loader className="animate-spin inline-block mr-2" />
                        <span>Loading your absence requests...</span>
                    </div>
                ) : myAbsencesError ? (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                        {myAbsencesError}
                    </div>
                ) : myAbsenceRequests.length === 0 ? (
                    <p className="text-gray-700 text-center">You have no absence requests submitted.</p>
                ) : (
                    <div className="space-y-4">
                        {myAbsenceRequests.map(request => (
                            <div key={request._id} className={`p-4 rounded-md border ${getStatusClasses(request.status).replace('bg-', 'bg-opacity-5 bg-')}`}>
                                <p className="font-semibold text-lg">{request.type}</p>
                                <p className="text-sm text-gray-600">
                                    {format(new Date(request.start), 'dd/MM/yyyy')} to {format(new Date(request.end), 'dd/MM/yyyy')}
                                </p>
                                {request.reason && <p className="text-sm text-gray-600 italic">Request Reason: {request.reason}</p>}
                                <p className={`text-sm font-semibold mt-1 ${getStatusClasses(request.status).replace('bg-', 'text-')}`}>
                                    Status: {request.status}
                                </p>
                                {request.resolutionReason && (
                                    <p className="text-sm text-gray-700 mt-1">Admin Note: {request.resolutionReason}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isAbsenceModalOpen && user?.staff?._id && (
                <StaffAbsenceRequestModal
                    isOpen={isAbsenceModalOpen}
                    onClose={closeAbsenceModal}
                    onSave={handleSaveAbsenceRequest}
                    initialType={absenceRequestType}
                    staffId={user.staff._id}
                />
            )}
        </div>
    );
};

export default StaffDashboard;