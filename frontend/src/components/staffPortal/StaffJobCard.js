import React, { useState, useCallback } from 'react';
import { MapPin, Clock, CheckCircle2, ChevronRight, Navigation, ListChecks, Loader as LoaderIcon } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import JobDetailsModal from './JobDetailsModal';
import StockReturnModal from './StockReturnModal';
import { toast } from 'react-toastify';
import { GoogleMap, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';

const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '0.5rem',
    marginTop: '1rem',
    position: 'relative',
};

const StaffJobCard = ({ job, onJobUpdated, onActionError }) => {
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isStockReturnModalOpen, setIsStockReturnModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [statusToApply, setStatusToApply] = useState('');
    const [showMap, setShowMap] = useState(false);
    const [directionsResponse, setDirectionsResponse] = useState(null);
    const [mapError, setMapError] = useState(null);

    const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        try {
            const [hours, minutes] = timeString.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return format(date, 'hh:mm a');
        } catch (e) {
            return timeString;
        }
    };

    const handleClockIn = useCallback(async () => {
        setActionLoading('clockIn');
        try {
            const res = await api.put(`/jobs/${job._id}/clock-in`);
            onJobUpdated(res.data);
        } catch (err) {
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
            onActionError(err);
        } finally {
            setActionLoading(null);
        }
    }, [onJobUpdated, onActionError]);

    const handleCompleteJobClick = useCallback(() => {
        const finalStatus = 'Completed';
        if (job.usedStock && job.usedStock.length > 0) {
            setStatusToApply(finalStatus);
            setIsStockReturnModalOpen(true);
        } else {
            handleReturnStockAndComplete(job, {}, finalStatus);
        }
    }, [job, handleReturnStockAndComplete]);

    const getDirections = () => {
        if (!job.address || !job.address.street) {
            toast.error("Job address is not available.");
            return;
        }
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.");
            return;
        }
        setActionLoading('navigate');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
                const destination = [job.address.street, job.address.city, job.address.postcode].filter(Boolean).join(', ');
                const directionsService = new window.google.maps.DirectionsService();
                directionsService.route(
                    {
                        origin: origin,
                        destination: destination,
                        travelMode: window.google.maps.TravelMode.DRIVING,
                    },
                    (result, status) => {
                        if (status === window.google.maps.DirectionsStatus.OK) {
                            setDirectionsResponse(result);
                            setMapError(null);
                        } else {
                            setMapError("Could not calculate directions.");
                        }
                        setActionLoading(null);
                    }
                );
            },
            () => {
                toast.error("Could not get your location. Please enable location services.");
                setActionLoading(null);
            }
        );
    };

    const handleToggleMap = () => {
        const newShowMapState = !showMap;
        setShowMap(newShowMapState);
        if (newShowMapState && !directionsResponse) {
            getDirections();
        }
    };
    
    const handleStartJourney = () => {
        if (!job.address || !job.address.street) {
            toast.error("Job address is not available.");
            return;
        }
        const destination = [
            job.address.street,
            job.address.city,
            job.address.postcode,
            job.address.country
        ].filter(Boolean).join(', ');

        const mapsUrl = `http://googleusercontent.com/maps.google.com/4{encodeURIComponent(destination)}`;
        
        window.open(mapsUrl, '_blank');
    };

    const isClockedIn = !!job.clockInTime;
    const isClockedOut = !!job.clockOutTime;
    const isCompleted = job.status === 'Completed';

    return (
        <div className="bg-white p-5 rounded-lg shadow-md border border-gray-200">
            <h4 className="text-xl font-bold text-gray-900 mb-2">{job.serviceType}</h4>
            <p className="text-sm text-gray-600 mb-4">{format(new Date(job.date), 'dd/MM/yyyy')} @ {formatTime(job.time)}</p>
            <div className="flex items-center text-gray-700 mb-2"><MapPin size={18} className="mr-2 text-blue-500" /><span>{job.address?.street}, {job.address?.city}</span></div>
            <div className="flex items-center text-gray-700 mb-4"><ChevronRight size={18} className="mr-2 text-purple-500" /><span>Customer: {job.customer?.contactPersonName || 'N/A'}</span></div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold mb-4 inline-block ${isCompleted ? 'bg-green-100 text-green-800' : job.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : job.status === 'Pending Completion' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>Status: {job.status}</span>
            {job.clockInTime && <p className="text-sm text-gray-600 mt-2"><Clock size={16} className="inline-block mr-1" /> Clocked In: {format(new Date(job.clockInTime), 'hh:mm a')}</p>}
            {job.clockOutTime && <p className="text-sm text-gray-600"><Clock size={16} className="inline-block mr-1" /> Clocked Out: {format(new Date(job.clockOutTime), 'hh:mm a')}</p>}

            {/* ================== THIS IS THE CORRECTED BUTTONS SECTION ================== */}
            <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={handleToggleMap} className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-md">
                    <Navigation size={18} className="mr-2" />
                    {showMap ? 'Hide Map' : 'Show Map'}
                </button>

                {!isClockedIn && !isCompleted && (
                    <button onClick={handleClockIn} disabled={actionLoading === 'clockIn'} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 shadow-md disabled:opacity-50">
                        {actionLoading === 'clockIn' ? <LoaderIcon size={18} className="animate-spin mr-2" /> : <Clock size={18} className="mr-2" />} Clock In
                    </button>
                )}

                {isClockedIn && !isClockedOut && !isCompleted && (
                    <button onClick={handleClockOut} disabled={actionLoading === 'clockOut'} className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 shadow-md disabled:opacity-50">
                        {actionLoading === 'clockOut' ? <LoaderIcon size={18} className="animate-spin mr-2" /> : <Clock size={18} className="mr-2" />} Clock Out
                    </button>
                )}

                {!isCompleted && (
                    <button onClick={() => setIsDetailsModalOpen(true)} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 shadow-md">
                        <ListChecks size={18} className="mr-2" /> Details
                    </button>
                )}
                
                {isClockedOut && !isCompleted && (
                    <button onClick={handleCompleteJobClick} disabled={actionLoading === 'complete'} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-md disabled:opacity-50">
                        {actionLoading === 'complete' ? <LoaderIcon size={18} className="animate-spin mr-2" /> : <CheckCircle2 size={18} className="mr-2" />} Complete Job
                    </button>
                )}
            </div>
            {/* ========================================================================= */}
            
            {showMap && (
                <div style={mapContainerStyle}>
                    {actionLoading === 'navigate' && <div className="h-full flex justify-center items-center"><LoaderIcon className="animate-spin" /></div>}
                    {mapError && <div className="h-full flex justify-center items-center text-red-500">{mapError}</div>}
                    
                    {window.google ? (
                        <GoogleMap mapContainerStyle={{width: '100%', height: '100%'}} zoom={12} center={{ lat: 51.5074, lng: -0.1278 }}>
                            {directionsResponse && (
                                <>
                                    <DirectionsRenderer options={{ directions: directionsResponse }} />
                                    <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
                                        <button 
                                            onClick={handleStartJourney}
                                            className="px-6 py-3 bg-green-500 text-white font-bold rounded-full shadow-lg hover:bg-green-600 transition-colors"
                                        >
                                            Start Journey
                                        </button>
                                    </div>
                                </>
                            )}
                        </GoogleMap>
                    ) : (
                        <div>Loading Google Maps...</div>
                    )}
                </div>
            )}
            
            <JobDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} job={job} onJobUpdated={onJobUpdated} onActionError={onActionError} />
            <StockReturnModal isOpen={isStockReturnModalOpen} onClose={() => setIsStockReturnModalOpen(false)} job={job} onReturn={handleReturnStockAndComplete} newStatus={statusToApply} />
        </div>
    );
};

export default StaffJobCard;