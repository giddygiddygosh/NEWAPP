// ServiceOS/frontend/src/components/staffPortal/StaffJobCard.js

import React, { useState } from 'react';
import { MapPin, Clock as ClockIcon, CheckCircle2, XCircle, ChevronRight, Gps, Loader as LucideLoader } from 'lucide-react';
import { getCurrentPosition } from '../../utils/helpers'; // Assuming this helper exists for geolocation
import api from '../../utils/api'; // Your API utility

const StaffJobCard = ({ job, onJobUpdated, onActionError }) => {
    const [actionLoading, setActionLoading] = useState(null); // To track loading for specific actions on this card

    // Helper to determine if the job is assigned to the current user (if needed for more complex roles)
    // const isAssignedToMe = user.staff?._id && job.assignedStaff.includes(user.staff._id);

    // --- Job Action Handlers (Clock In/Out, Complete) ---
    const handleClockIn = async () => {
        setActionLoading('clockIn');
        onActionError(null); // Clear any previous errors from parent

        try {
            const location = await getCurrentPosition(); // Get current geolocation
            const res = await api.put(`/jobs/${job._id}`, {
                clockIn: new Date(), // Send current timestamp
                clockInLocation: { latitude: location.latitude, longitude: location.longitude },
                status: 'In Progress' // Automatically set status to In Progress
            });
            alert('Clocked in successfully!'); // Consider a toast notification
            onJobUpdated(res.data.job); // Notify parent to update this specific job
        } catch (err) {
            console.error("Error clocking in:", err);
            onActionError(err.message || "Failed to clock in."); // Pass error to parent
        } finally {
            setActionLoading(null);
        }
    };

    const handleClockOut = async () => {
        setActionLoading('clockOut');
        onActionError(null);
        try {
            const location = await getCurrentPosition(); // Get current geolocation
            const res = await api.put(`/jobs/${job._id}`, {
                clockOut: new Date(), // Send current timestamp
                clockOutLocation: { latitude: location.latitude, longitude: location.longitude },
                // Status not changed automatically on clock-out here; depends on workflow
                // Could remain 'In Progress' until explicitly marked 'Completed'
            });
            alert('Clocked out successfully!');
            onJobUpdated(res.data.job);
        } catch (err) {
            console.error("Error clocking out:", err);
            onActionError(err.message || "Failed to clock out.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleCompleteJob = async () => {
        setActionLoading('complete');
        onActionError(null);
        try {
            const res = await api.put(`/jobs/${job._id}`, { status: 'Completed' }); // Update status to Completed
            alert('Job marked as completed!');
            onJobUpdated(res.data.job);
        } catch (err) {
            console.error("Error completing job:", err);
            onActionError(err.response?.data?.message || "Failed to mark job as complete.");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div key={job._id} className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
            <p className="font-semibold text-lg text-gray-900">{job.serviceType}</p>
            <p className="text-sm text-gray-700"><ClockIcon size={14} className="inline mr-1" />
                {new Date(job.date).toLocaleDateString()} @ {job.time} (Duration: {job.duration} mins)
            </p>
            <p className="text-sm text-gray-700 flex items-center">
                <MapPin size={14} className="inline mr-1" />
                {job.address?.street}, {job.address?.city}, {job.address?.postcode}
            </p>
            <p className="text-sm text-gray-600 mb-2">Customer: {job.customer?.contactPersonName}</p>
            <p className={`text-sm font-medium ${job.status === 'Completed' ? 'text-green-600' : job.status === 'In Progress' ? 'text-yellow-600' : 'text-blue-600'}`}>
                Status: {job.status}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
                {/* Clock In button */}
                {!job.clockIn && job.status === 'Booked' && (
                    <button
                        onClick={handleClockIn}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-1"
                        disabled={actionLoading === 'clockIn'}
                    >
                        {actionLoading === 'clockIn' ? <LucideLoader size={16} className="animate-spin" /> : <ClockIcon size={16} />} Clock In
                    </button>
                )}
                {/* Clock Out button */}
                {job.clockIn && !job.clockOut && job.status === 'In Progress' && (
                    <button
                        onClick={handleClockOut}
                        className="px-3 py-1 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 flex items-center gap-1"
                        disabled={actionLoading === 'clockOut'}
                    >
                        {actionLoading === 'clockOut' ? <LucideLoader size={16} className="animate-spin" /> : <ClockIcon size={16} />} Clock Out
                    </button>
                )}
                {/* Mark Complete button */}
                {job.status === 'In Progress' && ( // Can complete if clocked in or not, as long as In Progress
                    <button
                        onClick={handleCompleteJob}
                        className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center gap-1"
                        disabled={actionLoading === 'complete'}
                    >
                        {actionLoading === 'complete' ? <LucideLoader size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Mark Complete
                    </button>
                )}
                {/* Optional: Job Details Button */}
                <button
                    // onClick={() => handleViewJobDetails(job._id)} // You would create this handler
                    className="px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center gap-1"
                >
                    <ChevronRight size={16} /> Details
                </button>
            </div>
        </div>
    );
};

export default StaffJobCard;