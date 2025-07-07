import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Map, User, CalendarDays, Route, Loader as LucideLoader, MapPin, ListChecks, CheckSquare, Square, Send } from 'lucide-react';
import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api';

import GooglePlaceAutocomplete from '../common/GooglePlaceAutocomplete';
import api from '../../utils/api';
import { useMapsApi } from '../../App';
import ModernInput from '../common/ModernInput'; // Assuming this is your styled input

// Helper function to create a displayable address string from an object
const formatFullAddress = (addressObj) => {
    if (!addressObj) return '';
    return [addressObj.street, addressObj.city, addressObj.postcode].filter(Boolean).join(', ');
};

const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours > 0 ? `${hours} hr ` : ''}${minutes} min`;
};

const RoutePlannerView = () => {
    // State Management
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedStaffId, setSelectedStaffId] = useState('all');
    const [startAddress, setStartAddress] = useState('');
    const [routeJobs, setRouteJobs] = useState([]);
    const [routeResponse, setRouteResponse] = useState(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [routeError, setRouteError] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const { isMapsLoaded, isMapsLoadError } = useMapsApi();

    // State for sending route to staff
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(null);
    const [sendError, setSendError] = useState(null);

    // Data Fetching
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const [jobsRes, customersRes, staffRes] = await Promise.all([
                    api.get('/jobs'), api.get('/customers'), api.get('/staff')
                ]);
                setJobs(jobsRes.data || []);
                setCustomers(customersRes.data || []);
                setStaff(staffRes.data || []);
            } catch (err) {
                setFetchError("Failed to load necessary data.");
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    // Memoized Job Filtering with the FIX
    const jobsForDay = useMemo(() => {
        if (!jobs.length || !customers.length) return [];
        return jobs.filter(job => {
            const jobDate = job.date ? format(new Date(job.date), 'yyyy-MM-dd') : null;
            const customer = customers.find(c => c._id === (job.customer?._id || job.customer));
            return jobDate === selectedDate &&
                   (selectedStaffId === 'all' || job.assignedStaff?.some(s => (s._id || s) === selectedStaffId)) && // <-- THE FIX IS HERE
                   customer && formatFullAddress(customer.address).trim() !== '';
        }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }, [jobs, customers, selectedDate, selectedStaffId]);

    // Handlers
    const handleSelectAll = useCallback(() => setRouteJobs(jobsForDay), [jobsForDay]);
    const handleDeselectAll = useCallback(() => setRouteJobs([]), []);

    const handleJobToggle = useCallback((jobId) => {
        setRouteJobs(prev => {
            const job = jobsForDay.find(j => j._id === jobId);
            if (prev.some(j => j._id === jobId)) {
                return prev.filter(j => j._id !== jobId);
            }
            return job ? [...prev, job] : prev;
        });
    }, [jobsForDay]);

    const generateRoute = useCallback(() => {
        if (!startAddress.trim()) {
            setRouteError("Please enter a starting address.");
            return;
        }
        if (routeJobs.length === 0) {
            setRouteError("Please select at least one job.");
            return;
        }

        setIsLoadingRoute(true);
        setRouteError(null);

        const waypoints = routeJobs.map(job => {
            const customer = customers.find(c => c._id === (job.customer?._id || job.customer));
            return customer ? { location: formatFullAddress(customer.address), stopover: true } : null;
        }).filter(Boolean);

        const request = {
            origin: startAddress,
            destination: startAddress,
            waypoints,
            travelMode: 'DRIVING',
            optimizeWaypoints: true,
        };

        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                setRouteResponse(result);
                setSendSuccess(null); // Clear previous send status on new route
                setSendError(null);
            } else {
                setRouteError(`Route calculation failed: ${status}`);
            }
            setIsLoadingRoute(false);
        });
    }, [startAddress, routeJobs, customers]);

    const handleSendToStaff = useCallback(async () => {
        if (!routeResponse || selectedStaffId === 'all') {
            setSendError("Please select a specific staff member to send the route to.");
            return;
        }

        setIsSending(true);
        setSendSuccess(null);
        setSendError(null);

        try {
            const orderedJobIds = routeResponse.routes[0].waypoint_order.map(index => routeJobs[index]._id);
            const payload = {
                staffId: selectedStaffId,
                date: selectedDate,
                jobIds: orderedJobIds,
            };
            await api.post('/staff/send-route', payload);
            setSendSuccess(`Route successfully sent to ${staff.find(s => s._id === selectedStaffId)?.contactPersonName || 'the staff member'}.`);
        } catch (err) {
            setSendError("Failed to send route. Please try again.");
            console.error("Error sending route:", err);
        } finally {
            setIsSending(false);
        }
    }, [routeResponse, routeJobs, selectedStaffId, selectedDate, staff]);


    // Render Logic
    if (isLoadingData) return <div className="p-8 text-center"><LucideLoader className="animate-spin" /> Loading...</div>;
    if (fetchError) return <div className="p-8 text-center text-red-500">{fetchError}</div>;
    if (isMapsLoadError) return <div className="p-8 text-center text-red-500">Error loading map services.</div>;

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Left Panel */}
            <div className="w-1/3 h-screen flex flex-col p-4 space-y-4 overflow-y-auto">
                <h1 className="text-2xl font-bold text-gray-800">Route Planner</h1>
                
                {/* Filters */}
                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-center gap-2 border border-gray-300 rounded-md p-2">
                            <CalendarDays className="h-5 w-5 text-gray-500" />
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full focus:outline-none bg-transparent" />
                        </div>
                        <div className="flex items-center gap-2 border border-gray-300 rounded-md p-2">
                            <User className="h-5 w-5 text-gray-500" />
                            <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)} className="w-full focus:outline-none bg-transparent">
                                <option value="all">All Staff</option>
                                {staff.map(s => <option key={s._id} value={s._id}>{s.contactPersonName}</option>)}
                            </select>
                        </div>
                        {isMapsLoaded ? (
                            <GooglePlaceAutocomplete
                                label="Starting Address"
                                placeholder="Enter Starting Address"
                                onAddressSelect={setStartAddress}
                            />
                        ) : (
                            <ModernInput label="Starting Address" value="Loading..." disabled />
                        )}
                    </div>
                </div>

                {/* Job Selection List */}
                <div className="bg-white p-4 rounded-lg shadow-sm flex-grow flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="font-semibold flex items-center gap-2"><ListChecks /> Available Jobs ({jobsForDay.length})</h2>
                        <div>
                            <button onClick={handleSelectAll} className="text-xs text-blue-600 hover:underline mr-2">Select All</button>
                            <button onClick={handleDeselectAll} className="text-xs text-red-600 hover:underline">Deselect All</button>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-grow">
                        {jobsForDay.length === 0 ? (
                            <p className="text-center text-gray-500 text-sm py-4">No jobs found for this date/staff member.</p>
                        ) : (
                            jobsForDay.map(job => {
                                const isSelected = routeJobs.some(rj => rj._id === job._id);
                                const customer = customers.find(c => c._id === (job.customer?._id || job.customer));
                                return (
                                    <div key={job._id} onClick={() => handleJobToggle(job._id)} className={`p-2 mb-2 rounded-md cursor-pointer flex items-center gap-3 ${isSelected ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-200'}`}>
                                        {isSelected ? <CheckSquare className="text-blue-600" /> : <Square className="text-gray-400" />}
                                        <div>
                                            <p className="font-bold text-sm">{job.serviceType}</p>
                                            <p className="text-xs text-gray-600">{customer?.contactPersonName} @ {job.time}</p>
                                            <p className="text-xs text-gray-500"><MapPin size={12} className="inline mr-1" />{formatFullAddress(customer?.address)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Itinerary Panel */}
                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <button onClick={generateRoute} disabled={isLoadingRoute || routeJobs.length === 0} className="btn-primary w-full flex items-center justify-center">
                        {isLoadingRoute ? <LucideLoader className="animate-spin mr-2" /> : <Route className="mr-2" />}
                        Generate Route ({routeJobs.length} stops)
                    </button>
                    {routeError && <p className="text-red-500 text-xs mt-2">{routeError}</p>}
                    {routeResponse && (
                        <div className="mt-4">
                            <h3 className="font-semibold mb-2">Optimized Itinerary</h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm">
                                <li><span className="font-bold">Start:</span> {routeResponse.routes[0].legs[0].start_address}</li>
                                {routeResponse.routes[0].legs.map((leg, index) => {
                                    const legJobIndex = routeResponse.routes[0].waypoint_order[index];
                                    const jobForLeg = routeJobs[legJobIndex];
                                    const customerForLeg = jobForLeg ? customers.find(c => c._id === (jobForLeg.customer?._id || jobForLeg.customer)) : null;
                                    return (
                                        <li key={index}>
                                            <div className="pl-2 border-l-2 ml-2">
                                                <p className="text-gray-500"><Route size={14} className="inline mr-1" />Drive {leg.distance.text} ({formatDuration(leg.duration.value)})</p>
                                                <p className="font-bold"><MapPin size={14} className="inline mr-1" />Stop {index + 1}: {customerForLeg?.contactPersonName || 'N/A'}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                            <div className="mt-4 pt-4 border-t">
                                <p className="font-semibold">Total Route:</p>
                                <p>Distance: {(routeResponse.routes[0].legs.reduce((acc, leg) => acc + leg.distance.value, 0) / 1000).toFixed(2)} km</p>
                                <p>Duration: {formatDuration(routeResponse.routes[0].legs.reduce((acc, leg) => acc + leg.duration.value, 0))}</p>
                            </div>

                            {/* === SEND TO STAFF BUTTON BLOCK === */}
                            <div className="mt-4 pt-4 border-t">
                                <button 
                                    onClick={handleSendToStaff} 
                                    disabled={isSending || !routeResponse || selectedStaffId === 'all'} 
                                    className="btn-primary w-full flex items-center justify-center"
                                >
                                    {isSending ? (
                                        <LucideLoader className="animate-spin mr-2" />
                                    ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                    )}
                                    Send Route to Staff
                                </button>
                                {sendSuccess && <p className="text-green-600 text-xs mt-2 text-center">{sendSuccess}</p>}
                                {sendError && <p className="text-red-500 text-xs mt-2 text-center">{sendError}</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel */}
            <div className="w-2/3 h-screen">
                <GoogleMap mapContainerClassName="w-full h-full" center={{ lat: 53.07, lng: -2.99 }} zoom={6}>
                    {routeResponse && <DirectionsRenderer directions={routeResponse} />}
                </GoogleMap>
            </div>
        </div>
    );
};

export default RoutePlannerView;