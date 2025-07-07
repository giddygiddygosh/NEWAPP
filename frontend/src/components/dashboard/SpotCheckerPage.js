// ServiceOS/frontend/src/components/dashboard/SpotCheckerPage.js

import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { useAuth } from '../context/AuthContext';
// CORRECTED IMPORT: Use JobModal for job creation
import JobModal from '../jobs/JobModal'; // <-- CORRECTED IMPORT PATH AND NAME

// Re-import ModernInput, ModernSelect, and helpers directly as they are now used by SpotCheckerPage's logic
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { isSlotAvailable, generateTimeSlots, isDateOverdue } from '../../utils/helpers';
import { Calendar, Clock, Hash, Search, User, Briefcase, Plus, Loader } from 'lucide-react';


const SpotCheckerPage = () => {
    const { user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [staff, setStaff] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [settings, setSettings] = useState({});

    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [isLoadingStaff, setIsLoadingStaff] = useState(true);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);

    const [fetchError, setFetchError] = useState(null);

    // State for the JobModal
    const [isJobModalOpen, setIsJobModalOpen] = useState(false); // Renamed for clarity
    const [jobModalInitialData, setJobModalInitialData] = useState(null);
    const [jobModalAvailableStaff, setJobModalAvailableStaff] = useState(null); // Keep this for passing available staff to modal

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [searchStartDate, setSearchStartDate] = useState(today);
    const [searchEndDate, setSearchEndDate] = useState(thirtyDaysFromNow.toISOString().split('T')[0]);
    const [jobDuration, setJobDuration] = useState('60'); // Default duration, will be updated by settings
    const [assignedStaffIds, setAssignedStaffIds] = useState(new Set());
    const [selectedCustomer, setSelectedCustomer] = useState('');

    const [availableSlots, setAvailableSlots] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    const customerOptions = useMemo(() => (customers || []).map(c => ({ value: c._id, label: c.contactPersonName })), [customers]);

    const assignStaff = (staffId) => {
        setAssignedStaffIds(prev => new Set(prev).add(staffId));
    };

    const unassignStaff = (staffId) => {
        setAssignedStaffIds(prev => {
            const newAssigned = new Set(prev);
            newAssigned.delete(staffId);
            return newAssigned;
        });
    };

    const availableStaffForSelection = useMemo(() => (staff || []).filter(s => !assignedStaffIds.has(s._id)), [staff, assignedStaffIds]);
    const assignedStaffForSelection = useMemo(() => (staff || []).filter(s => assignedStaffIds.has(s._id)), [staff, assignedStaffIds]);


    useEffect(() => {
        const fetchAllData = async () => {
            if (!user?.company) {
                setFetchError("User company information not available.");
                setIsLoadingJobs(false); setIsLoadingStaff(false);
                setIsLoadingCustomers(false); setIsLoadingSettings(false);
                return;
            }

            try {
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const twoMonthsLater = new Date(now.getFullYear(), now.getMonth() + 2, 0);

                const jobsRes = await api.get('/jobs', {
                    params: {
                        startDate: firstDayOfMonth.toISOString().split('T')[0],
                        endDate: twoMonthsLater.toISOString().split('T')[0],
                    }
                });
                setJobs(jobsRes.data);
            } catch (err) { console.error("Error fetching jobs:", err); setFetchError("Failed to load jobs."); } finally { setIsLoadingJobs(false); }

            try {
                const staffRes = await api.get('/staff');
                setStaff(staffRes.data.map(s => ({ _id: s._id, name: s.contactPersonName, ...s })));
            } catch (err) { console.error("Error fetching staff:", err); setFetchError(prev => prev ? prev + " Failed to load staff." : "Failed to load staff."); } finally { setIsLoadingStaff(false); }

            try {
                const customersRes = await api.get('/customers');
                setCustomers(customersRes.data.map(c => ({ _id: c._id, name: c.contactPersonName, ...c })));
            } catch (err) { console.error("Error fetching customers:", err); setFetchError(prev => prev ? prev + " Failed to load customers." : "Failed to load customers."); } finally { setIsLoadingCustomers(false); }

            try {
                const settingsRes = await api.get('/settings');
                setSettings(settingsRes.data || {});
                setJobDuration(settingsRes.data?.defaultDuration || '60');
            } catch (err) { console.error("Error fetching settings:", err); setFetchError(prev => prev ? prev + " Failed to load settings." : "Failed to load settings."); } finally { setIsLoadingSettings(false); }
        };

        if (user?.company) {
            fetchAllData();
        }
    }, [user]);

    const handleSearch = async () => {
        setIsSearching(true);
        setAvailableSlots(null);
        setSearchMessage('');

        if (new Date(searchStartDate) > new Date(searchEndDate)) { setSearchMessage("Error: End date cannot be before start date."); setIsSearching(false); return; }
        if (parseFloat(jobDuration) <= 0) { setSearchMessage("Error: Job duration must be greater than 0."); setIsSearching(false); return; }
        if (assignedStaffIds.size === 0 && (!staff || staff.length === 0)) { setSearchMessage("No staff members available in the system to search for. Please add staff first."); setIsSearching(false); return; }

        const foundSlots = [];
        let currentDate = new Date(searchStartDate);
        const endDate = new Date(searchEndDate);
        endDate.setHours(23, 59, 59, 999);

        const durationMinutes = parseFloat(jobDuration);
        const dailyTimeSlots = generateTimeSlots();

        while (currentDate <= endDate) {
            const currentDayString = currentDate.toISOString().split('T')[0];
            const staffToCheck = assignedStaffIds.size > 0
                ? (staff || []).filter(s => assignedStaffIds.has(s._id))
                : (staff || []);

            if (staffToCheck.length === 0) { currentDate.setDate(currentDate.getDate() + 1); continue; }

            for (const timeSlot of dailyTimeSlots) {
                const availableStaffForSlot = isSlotAvailable(
                    currentDayString,
                    timeSlot,
                    durationMinutes,
                    staffToCheck,
                    (jobs || [])
                );

                if (availableStaffForSlot.length > 0) {
                    foundSlots.push({
                        date: currentDayString,
                        time: timeSlot,
                        availableStaff: availableStaffForSlot
                    });
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        setTimeout(() => {
            setAvailableSlots(foundSlots);
            if (foundSlots.length === 0) { setSearchMessage("No available slots found for the selected criteria and date range. Try adjusting your search."); } else { setSearchMessage(''); }
            setIsSearching(false);
        }, 500);
    };

    // Callback when "Book Now" is clicked
    const handleOpenJobModal = (slot) => { // slot is passed here
        const customer = (customers || []).find(c => c._id === selectedCustomer);

        setJobModalInitialData({
            date: new Date(`${slot.date}T${slot.time}:00`), // Pass full Date object for selected slot
            customer: customer?._id || null, // customerId
            customerName: customer?.contactPersonName || null, // customerName
            // Pre-select staff if only one is available or passed from SpotChecker
            assignedStaff: slot.availableStaff && slot.availableStaff.length > 0 ? [slot.availableStaff[0]._id] : [],
            time: slot.time, // Extract HH:MM directly from slot.time
            duration: settings.defaultDuration || 60, // Default duration
            serviceType: '', // Example: default service type
            description: '',
            address: customer?.address || {}, // Default to customer's address
        });
        setJobModalAvailableStaff(slot.availableStaff); // Pass available staff to the modal
        setIsJobModalOpen(true); // Renamed state to match JobModal
    };

    const handleJobSaved = () => {
        setIsJobModalOpen(false); // Renamed state to match JobModal
        setJobModalInitialData(null);
        setJobModalAvailableStaff(null);
        const fetchJobs = async () => {
            setIsLoadingJobs(true);
            try {
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const twoMonthsLater = new Date(now.getFullYear(), now.getMonth() + 2, 0);

                const jobsRes = await api.get('/jobs', {
                    params: {
                        startDate: firstDayOfMonth.toISOString().split('T')[0],
                        endDate: twoMonthsLater.toISOString().split('T')[0],
                    }
                });
                setJobs(jobsRes.data);
            } catch (err) { console.error("Error re-fetching jobs:", err); setFetchError("Failed to re-load jobs after saving."); } finally { setIsLoadingJobs(false); }
        };
        fetchJobs();
    };

    const isOverallLoading = isLoadingJobs || isLoadingStaff || isLoadingCustomers || isLoadingSettings || isSearching;

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Search className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Smart Availability Finder</h1>
                </div>
            </header>

            {isOverallLoading ? (
                <div className="p-10 text-center text-gray-500 text-xl font-semibold bg-white rounded-xl shadow-lg h-96 flex items-center justify-center">
                    {isLoadingJobs || isLoadingStaff || isLoadingCustomers || isLoadingSettings ? "Loading core data..." : "Preparing search..."}
                    {(isLoadingJobs || isLoadingStaff || isLoadingCustomers || isLoadingSettings) && <Loader size={24} className="ml-3 animate-spin" />}
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Find Available Slots</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <ModernInput
                                label="Search Start Date"
                                type="date"
                                value={searchStartDate}
                                onChange={(e) => setSearchStartDate(e.target.value)}
                                icon={<Calendar />}
                                disabled={isSearching}
                            />
                            <ModernInput
                                label="Search End Date"
                                type="date"
                                value={searchEndDate}
                                onChange={(e) => setSearchEndDate(e.target.value)}
                                icon={<Calendar />}
                                disabled={isSearching}
                            />
                            <ModernInput
                                label="Job Duration (mins)"
                                type="number"
                                value={jobDuration}
                                onChange={(e) => setJobDuration(e.target.value)}
                                icon={<Hash />}
                                min="15"
                                step="15"
                                disabled={isSearching}
                            />
                            <ModernSelect
                                label="Select Customer (Optional)"
                                name="selectedCustomer"
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                icon={<User />}
                                disabled={isSearching || isLoadingCustomers}
                            >
                                {isLoadingCustomers ? (
                                    <option value="">Loading Customers...</option>
                                ) : (
                                    <>
                                        <option value="">All Customers</option>
                                        {customerOptions.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                        {customers?.length === 0 && <option value="" disabled>No Customers Available</option>}
                                    </>
                                )}
                            </ModernSelect>
                        </div>

                        <div className="mt-6">
                            <label className="text-sm font-semibold text-gray-600 mb-1 block">Assign Staff (Optional)</label>
                            <div className="grid grid-cols-2 gap-4 border border-gray-200 rounded-lg p-4 items-stretch">
                                <div className="flex flex-col">
                                    <h4 className="font-semibold text-gray-700 mb-2 text-center">Available Staff</h4>
                                    <div className="border border-gray-300 rounded-lg p-2 overflow-y-auto flex-1 h-32">
                                        {isLoadingStaff ? (
                                            <p className="text-sm text-gray-400 text-center pt-4">Loading Staff...</p>
                                        ) : availableStaffForSelection.length > 0 ? availableStaffForSelection.map(s => (
                                            <div key={s._id} onClick={() => assignStaff(s._id)} className="p-2 rounded-md hover:bg-blue-100 cursor-pointer mb-1">
                                                {s.name}
                                            </div>
                                        )) : (
                                            <p className="text-sm text-gray-400 text-center pt-4">All staff assigned or no staff found.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="font-semibold text-gray-700 mb-2 text-center">Selected Staff</h4>
                                    <div className="border border-dashed border-gray-300 rounded-lg p-2 overflow-y-auto space-y-2 flex-1 h-32">
                                        {assignedStaffForSelection.length > 0 ? assignedStaffForSelection.map(s => (
                                            <div key={s._id} onClick={() => unassignStaff(s._id)} className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 cursor-pointer">
                                                {s.name}
                                            </div>
                                        )) : (
                                            <p className="text-sm text-sm text-gray-500 text-center pt-4">No staff selected.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleSearch}
                                className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 h-auto transition-colors transform hover:scale-105 flex items-center justify-center gap-2"
                                disabled={isOverallLoading}
                            >
                                {isSearching ? (
                                    <>
                                        <Loader size={20} className="animate-spin" /> Searching...
                                    </>
                                ) : (
                                    <>
                                        <Search size={20} /> Find Slots
                                    </>
                                )}
                            </button>
                        </div>
                        {searchMessage && <p className="text-center text-red-600 mt-4">{searchMessage}</p>}
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Available Slots</h2>
                        {availableSlots !== null ? (
                            availableSlots.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {availableSlots.map((slot, index) => (
                                        <div key={index} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col gap-2">
                                            <p className="font-semibold text-lg text-blue-800 flex items-center gap-2">
                                                <Calendar size={20} />{new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </p>
                                            <p className="text-md text-gray-700 flex items-center gap-2">
                                                <Clock size={16} />{slot.time} (Duration: {jobDuration} mins)
                                            </p>
                                            <p className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                                                <User size={16} />Available Staff:
                                                {(slot.availableStaff || []).map(s => (
                                                    <span key={s._id} className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold ml-1 my-0.5">
                                                        {s.name}
                                                    </span>
                                                ))}
                                            </p>
                                            <button
                                                onClick={() => handleOpenJobModal(slot)}
                                                className="mt-3 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-md"
                                            >
                                                Book Now
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-8 text-lg">
                                    No available slots found for the selected criteria and date range. Try adjusting your search.
                                </p>
                            )
                        ) : (
                            <p className="text-center text-gray-500 py-8 text-lg">
                                Use the search filters above to find available slots.
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* Use JobModal for Add Job Modal */}
            <JobModal // Changed component name
                isOpen={isJobModalOpen} // Using renamed state
                onClose={() => { setIsJobModalOpen(false); setJobModalInitialData(null); setJobModalAvailableStaff(null); }} // Using renamed state
                onSave={handleJobSaved} // Callback for job creation
                jobData={jobModalInitialData} // Using renamed state
                // JobModal expects 'customers' and 'staff' as props, so pass them
                customers={customers}
                staff={jobModalAvailableStaff || staff} // Pass all staff or just the available ones
            />
        </div>
    );
};

export default SpotCheckerPage;