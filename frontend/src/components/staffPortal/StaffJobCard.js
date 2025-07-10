// src/components/staffPortal/StaffJobCard.jsx

import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Clock, CheckCircle2, XCircle, ChevronRight, Image, Box, ListChecks, Loader as LoaderIcon } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import JobDetailsModal from './JobDetailsModal';
import StockReturnModal from './StockReturnModal';

const StaffJobCard = ({ job, onJobUpdated, onActionError }) => {
    // --- DEBUG LOG ---
    // This will show us the exact job data the component is receiving.
    useEffect(() => {
        console.log(`[StaffJobCard] Received job data for service "${job.serviceType}":`, job);
    }, [job]);
    // --- END DEBUG LOG ---

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isStockReturnModalOpen, setIsStockReturnModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [statusToApply, setStatusToApply] = useState('');

    const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        try {
            const [hours, minutes] = timeString.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return format(date, 'hh:mm a');
        } catch (e) {
            console.error("Error formatting time:", timeString, e);
            return timeString;
        }
    };

    const handleClockIn = useCallback(async () => {
        setActionLoading('clockIn');
        try {
            const res = await api.put(`/jobs/${job._id}/clock-in`);
            onJobUpdated(res.data);
        } catch (err) {
            console.error("Error clocking in:", err);
            onActionError(err);
        } finally {
            setActionLoading(null);
        }
    }, [job._id, onJobUpdated, onActionError]);

    const handleClockOut = useCallback(async () => {
        setActionLoading('clockOut');
        try {
            const res = await api.put(`/jobs/${job._id}/clock-out`);
            onJobUpdated(res.data);
        } catch (err) {
            console.error("Error clocking out:", err);
            onActionError(err);
        } finally {
            setActionLoading(null);
        }
    }, [job._id, onJobUpdated, onActionError]);

    const handleReturnStockAndComplete = useCallback(async (jobToUpdate, returnedStockData, newStatus) => {
        setActionLoading('complete');
        setIsStockReturnModalOpen(false);

        try {
            const payload = {
                returnedStockItems: Object.entries(returnedStockData).map(([stockId, quantity]) => ({ stockId, quantity })),
                newStatus: newStatus,
            };
            const res = await api.post(`/jobs/${jobToUpdate._id}/return-stock`, payload);
            onJobUpdated(res.data.job);
        } catch (err) {
            console.error("Error completing job or returning stock:", err);
            onActionError(err);
        } finally {
            setActionLoading(null);
        }
    }, [onJobUpdated, onActionError]);

    const handleCompleteJobClick = useCallback(() => {
        const finalStatus = 'Completed';
        // This is the check that determines if the modal should open.
        if (job.usedStock && job.usedStock.length > 0) {
            setStatusToApply(finalStatus);
            setIsStockReturnModalOpen(true);
        } else {
            // If no stock is used, complete the job directly.
            handleReturnStockAndComplete(job, {}, finalStatus);
        }
    }, [job, handleReturnStockAndComplete]);

    const isClockedIn = !!job.clockInTime;
    const isClockedOut = !!job.clockOutTime;
    const isCompleted = job.status === 'Completed';

    return (
        <div className="bg-white p-5 rounded-lg shadow-md border border-gray-200">
            <h4 className="text-xl font-bold text-gray-900 mb-2">{job.serviceType}</h4>
            <p className="text-sm text-gray-600 mb-4">
                {format(new Date(job.date), 'dd/MM/yyyy')} @ {formatTime(job.time)} (Duration: {job.duration || 'N/A'} mins)
            </p>
            <div className="flex items-center text-gray-700 mb-2">
                <MapPin size={18} className="mr-2 text-blue-500" />
                <span>{job.address?.street}, {job.address?.city}</span>
            </div>
            <div className="flex items-center text-gray-700 mb-4">
                <ChevronRight size={18} className="mr-2 text-purple-500" />
                <span>Customer: {job.customer?.contactPersonName || 'N/A'}</span>
            </div>

            <span className={`px-3 py-1 rounded-full text-sm font-semibold mb-4 inline-block
                ${isCompleted ? 'bg-green-100 text-green-800' :
                job.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                job.status === 'Pending Completion' ? 'bg-orange-100 text-orange-800' :
                'bg-blue-100 text-blue-800'}`}>
                Status: {job.status}
            </span>

            {job.clockInTime && (
                <p className="text-sm text-gray-600 mt-2">
                    <Clock size={16} className="inline-block mr-1" /> Clocked In: {format(new Date(job.clockInTime), 'hh:mm a (dd/MM)')}
                </p>
            )}
            {job.clockOutTime && (
                <p className="text-sm text-gray-600">
                    <Clock size={16} className="inline-block mr-1" /> Clocked Out: {format(new Date(job.clockOutTime), 'hh:mm a (dd/MM)')}
                </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
                {!isClockedIn && !isCompleted && (
                    <button
                        onClick={handleClockIn}
                        disabled={actionLoading === 'clockIn'}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {actionLoading === 'clockIn' ? <LoaderIcon size={18} className="animate-spin mr-2" /> : <Clock size={18} className="mr-2" />}
                        Clock In
                    </button>
                )}

                {isClockedIn && !isClockedOut && !isCompleted && (
                    <button
                        onClick={handleClockOut}
                        disabled={actionLoading === 'clockOut'}
                        className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {actionLoading === 'clockOut' ? <LoaderIcon size={18} className="animate-spin mr-2" /> : <Clock size={18} className="mr-2" />}
                        Clock Out
                    </button>
                )}

                {!isCompleted && (
                    <button
                        onClick={() => setIsDetailsModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors shadow-md"
                    >
                        <ListChecks size={18} className="mr-2" /> Details
                    </button>
                )}
                
                {isClockedOut && !isCompleted && (
                    <button
                        onClick={handleCompleteJobClick}
                        disabled={actionLoading === 'complete'}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {actionLoading === 'complete' ? <LoaderIcon size={18} className="animate-spin mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
                        Complete Job
                    </button>
                )}
            </div>

            <JobDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                job={job}
                onJobUpdated={onJobUpdated}
                onActionError={onActionError}
            />

            <StockReturnModal
                isOpen={isStockReturnModalOpen}
                onClose={() => setIsStockReturnModalOpen(false)}
                job={job}
                onReturn={handleReturnStockAndComplete}
                newStatus={statusToApply}
            />
        </div>
    );
};

export default StaffJobCard;

