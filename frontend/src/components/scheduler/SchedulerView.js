// src/components/scheduler/SchedulerView.jsx

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import CalendarHeader from './CalendarHeader';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import Loader from '../common/Loader';
import JobModal from '../jobs/JobModal';
import api from '../../utils/api';
// Ensure all necessary date-fns functions are imported
import { startOfMonth, endOfMonth, addDays, startOfDay, getDay, isSameDay } from 'date-fns';

// Keys for localStorage
const LOCAL_STORAGE_VIEW_MODE_KEY = 'schedulerViewMode';
const LOCAL_STORAGE_LAYOUT_KEY = 'schedulerDayViewLayout';
const LOCAL_STORAGE_CURRENT_DATE_KEY = 'schedulerCurrentDate';

const SchedulerView = (props) => {
    // --- Retrieve initial state from localStorage or use defaults ---
    // MOVED THESE FUNCTION DEFINITIONS TO THE TOP, BEFORE useState CALLS
    const getInitialViewMode = () => {
        return localStorage.getItem(LOCAL_STORAGE_VIEW_MODE_KEY) || 'month';
    };

    const getInitialDayViewLayout = () => {
        return localStorage.getItem(LOCAL_STORAGE_LAYOUT_KEY) || 'vertical';
    };

    const getInitialCurrentDate = () => {
        const storedDate = localStorage.getItem(LOCAL_STORAGE_CURRENT_DATE_KEY);
        if (storedDate) {
            const date = new Date(storedDate);
            if (!isNaN(date.getTime())) {
                return startOfDay(date);
            }
        }
        return startOfDay(new Date());
    };

    const [jobs, setJobs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [staff, setStaff] = useState([]);
    // These useState calls now correctly reference the functions defined above them
    const [viewMode, setViewMode] = useState(getInitialViewMode);
    const [dayViewLayout, setDayViewLayout] = useState(getInitialDayViewLayout);
    const [currentDate, setCurrentDate] = useState(getInitialCurrentDate);
    const [customerFilter, setCustomerFilter] = useState('all');
    const [staffFilter, setStaffFilter] = useState('all');
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [isLoadingStaff, setIsLoadingStaff] = useState(false);
    const [userFacingError, setUserFacingError] = useState(null);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [jobToEdit, setJobToEdit] = useState(null);

    // --- Ref to manage active fetches and prevent race conditions ---
    const activeFetchIdRef = useRef(0);

    // --- useEffects to persist state to localStorage whenever it changes ---
    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_VIEW_MODE_KEY, viewMode);
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_LAYOUT_KEY, dayViewLayout);
    }, [dayViewLayout]);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_CURRENT_DATE_KEY, currentDate.toISOString());
    }, [currentDate]);
    // --- End persistence useEffects ---

    // useCallback for fetching scheduler data based on current view and date
    const fetchSchedulerData = useCallback(async () => {
        const fetchId = ++activeFetchIdRef.current;
        
        setUserFacingError(null);
        setIsLoadingJobs(true);

        try {
            let fetchStartDate, fetchEndDate;
            const baseDate = currentDate;

            if (viewMode === 'month') {
                const firstDayOfMonth = startOfMonth(baseDate);
                const lastDayOfMonth = endOfMonth(baseDate); 

                const firstDayOfCalendarGrid = new Date(firstDayOfMonth);
                firstDayOfCalendarGrid.setDate(firstDayOfCalendarGrid.getDate() - getDay(firstDayOfCalendarGrid));

                const lastDayOfCalendarGrid = new Date(lastDayOfMonth);
                lastDayOfCalendarGrid.setDate(lastDayOfCalendarGrid.getDate() + (6 - getDay(lastDayOfCalendarGrid)));

                fetchStartDate = firstDayOfCalendarGrid;
                fetchEndDate = lastDayOfCalendarGrid;

            } else if (viewMode === 'week') {
                const firstDayOfWeek = new Date(baseDate);
                firstDayOfWeek.setDate(firstDayOfWeek.getDate() - getDay(firstDayOfWeek));

                fetchStartDate = firstDayOfWeek;
                fetchEndDate = addDays(firstDayOfWeek, 6);
            } else { // Day view
                fetchStartDate = baseDate;
                fetchEndDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59, 999);
            }

            setIsLoadingCustomers(true);
            setIsLoadingStaff(true);
            const [jobsRes, customersRes, staffRes] = await Promise.all([
                api.get(`/jobs?startDate=${fetchStartDate.toISOString()}&endDate=${fetchEndDate.toISOString()}`),
                api.get('/customers'),
                api.get('/staff')
            ]);
            
            if (fetchId === activeFetchIdRef.current) {
                setJobs(jobsRes.data);
                setCustomers(customersRes.data);
                setStaff(staffRes.data);
                setUserFacingError(null);
            }
        } catch (err) {
            if (fetchId === activeFetchIdRef.current) {
                console.error('Error fetching scheduler data:', err.response?.data?.message || err.message);
                setUserFacingError(err.response?.data?.message || 'Failed to fetch scheduler data.');
            }
        } finally {
            if (fetchId === activeFetchIdRef.current) {
                setIsLoadingJobs(false);
                setIsLoadingCustomers(false);
                setIsLoadingStaff(false);
            }
        }
    }, [currentDate, viewMode]);

    useEffect(() => {
        fetchSchedulerData();
    }, [fetchSchedulerData]);

    // Handle job updates (drag/drop, resize, modal save)
    const handleJobUpdate = useCallback(async (jobId, updatedData) => {
        const originalJob = jobs.find(j => j._id === jobId);
        if (!originalJob) {
            console.warn(`Attempted to update job with ID ${jobId}, but it was not found in current state.`);
            return;
        }

        // --- Optimistic Update: Update UI immediately for a smooth experience ---
        const optimisticJobs = prevJobs => prevJobs.map(job => {
            if (job._id === jobId) {
                let updatedAssignedStaff = originalJob.assignedStaff;
                if ('assignedStaff' in updatedData) {
                    if (Array.isArray(updatedData.assignedStaff) && updatedData.assignedStaff.length > 0) {
                        const newStaffId = updatedData.assignedStaff[0];
                        const staffMemberObj = staff.find(s => s._id === newStaffId);
                        updatedAssignedStaff = staffMemberObj ? [staffMemberObj] : [];
                    } else {
                        updatedAssignedStaff = [];
                    }
                }

                const newDateForOptimistic = updatedData.date ? new Date(updatedData.date) : originalJob.date;
                const newTimeForOptimistic = updatedData.time || originalJob.time;
                const newDurationForOptimistic = updatedData.duration || originalJob.duration;

                const newRecurringForOptimistic = updatedData.recurring
                    ? { ...originalJob.recurring, ...updatedData.recurring }
                    : originalJob.recurring;

                return {
                    ...originalJob,
                    ...updatedData, // Apply all other updates
                    date: newDateForOptimistic,
                    time: newTimeForOptimistic,
                    duration: newDurationForOptimistic,
                    assignedStaff: updatedAssignedStaff,
                    recurring: newRecurringForOptimistic,
                };
            }
            return job;
        });

        setJobs(optimisticJobs); // Apply optimistic update to local state
        setUserFacingError(null); // Clear any previous errors

        try {
            // Make the API call to update the job on the backend
            const response = await api.put(`/jobs/${jobId}`, updatedData);
            
            // --- CRITICAL CHANGE HERE: Update state with the exact job returned from backend ---
            setJobs(prevJobs => prevJobs.map(job =>
                job._id === jobId ? response.data.job : job // Use backend's definitive job object
            ));
            // Removed: fetchSchedulerData(); // No longer re-fetch all jobs on successful update

        } catch (err) {
            console.error("Job update failed (backend error):", err.response?.data?.message || err.message, err);
            const errorMessage = err.response?.data?.message || 'Failed to update job. Reverting changes.';
            setUserFacingError(errorMessage);
            // On failure, revert to the server's state by re-fetching data (causes the "jump back")
            fetchSchedulerData();
        }
    }, [jobs, staff, fetchSchedulerData]); // Dependencies for useCallback

    const handleNavigate = useCallback((direction) => {
        setCurrentDate(prevDate => {
            let newDate = startOfDay(new Date(prevDate));

            if (viewMode === 'month') {
                newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
            } else if (viewMode === 'week') {
                newDate = addDays(newDate, (direction === 'next' ? 7 : -7));
            } else if (viewMode === 'day') {
                newDate = addDays(newDate, (direction === 'next' ? 1 : -1));
            }
            return startOfDay(newDate);
        });
    }, [viewMode]);

    const handleOpenJobModal = useCallback((date) => {
        const newJobTemplate = {
            date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            recurring: { pattern: 'none', endDate: null }
        };
        setJobToEdit(newJobTemplate);
        setIsJobModalOpen(true);
    }, []);

    const handleOpenDetailsModal = useCallback((job) => {
        const preparedJobData = {
            ...job,
            recurring: {
                pattern: job.recurring?.pattern || 'none',
                endDate: job.recurring?.endDate || null
            }
        };
        setJobToEdit(preparedJobData);
        setIsJobModalOpen(true);
    }, []);

    const handleJobSaved = useCallback((savedJob) => {
        setIsJobModalOpen(false);
        setJobToEdit(null);
        setUserFacingError(null);

        if (savedJob && savedJob.date) {
            const jobDate = startOfDay(new Date(savedJob.date));
            if (!isSameDay(currentDate, jobDate)) {
                setCurrentDate(jobDate); // This will trigger fetchSchedulerData
            } else {
                fetchSchedulerData(); // Explicitly call if date didn't change (e.g., job for current day)
            }
        } else {
            fetchSchedulerData(); // Fallback if savedJob data is incomplete
        }
    }, [fetchSchedulerData, setCurrentDate, currentDate]);

    const filteredJobs = useMemo(() => {
        if (!jobs) return [];
        return jobs.filter(job =>
            (customerFilter === 'all' || job.customer?._id === customerFilter) &&
            (staffFilter === 'all' || (job.assignedStaff || []).some(s => (s._id || s) === staffFilter))
        );
    }, [jobs, customerFilter, staffFilter]);

    const isLoadingData = isLoadingJobs;    

    return (
        // Outermost div for the entire Scheduler page.
        // It provides the overall padding (p-8) for the page content.
        <div className="h-full flex flex-col p-8">
            {userFacingError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {userFacingError}
                </div>
            )}

            {/* Calendar Header: It now spans the full width within the p-8 padding of its parent.
                Removed max-w-7xl and mx-auto from here.
                The padding now comes from the parent div.
            */}
            <CalendarHeader
                currentDate={currentDate}
                viewMode={viewMode}
                onViewChange={setViewMode}
                dayViewLayout={dayViewLayout}
                onLayoutChange={setDayViewLayout}
                onNavigate={handleNavigate}
                onNewJob={handleOpenJobModal}
                customers={customers}
                staff={staff}
                onCustomerFilterChange={setCustomerFilter}
                onStaffFilterChange={setStaffFilter}
                isLoadingCustomers={isLoadingCustomers}
                isLoadingStaff={isLoadingStaff}
                className="flex-shrink-0 mb-6" // This class manages its own internal flex layout/spacing
            />

            {/* Main Content Area: This div will be the "card" for the calendar views.
                It has a white background, shadow, rounded corners, padding, and is centered.
            */}
            <div className="bg-white rounded-xl shadow-lg flex-1 flex flex-col p-6 w-full">
                {isLoadingData ? (
                    <div className="p-10 text-center text-gray-500 text-xl font-semibold flex items-center justify-center flex-1">
                        <Loader /><span className="ml-4">Loading Scheduler Data...</span>
                    </div>
                ) : (
                    <div className="h-full flex-1">
                        {viewMode === 'month' && (
                            <MonthView
                                jobs={filteredJobs}
                                currentDate={currentDate}
                                onOpenDetails={handleOpenDetailsModal}
                                onOpenModal={handleOpenJobModal}
                                onDayClick={(d) => { setViewMode('day'); setCurrentDate(d); }}
                                onJobUpdate={handleJobUpdate}
                            />
                        )}
                        {viewMode === 'week' && (
                            <WeekView
                                jobs={filteredJobs}
                                currentDate={currentDate}
                                onOpenDetails={handleOpenDetailsModal}
                                staff={staff}
                                onJobUpdate={handleJobUpdate}
                            />
                        )}
                        {viewMode === 'day' && (
                            <DayView
                                jobs={filteredJobs}
                                currentDate={currentDate}
                                onOpenDetails={handleOpenDetailsModal}
                                staff={staff}
                                layout={dayViewLayout}
                                onJobUpdate={handleJobUpdate}
                                fetchSchedulerData={fetchSchedulerData}
                            />
                        )}
                    </div>
                )}
            </div>
            {isJobModalOpen && (
                <JobModal
                    isOpen={isJobModalOpen}
                    onClose={() => setIsJobModalOpen(false)}
                    onSave={handleJobSaved}
                    jobData={jobToEdit}
                    customers={customers}
                    staff={staff}
                />
            )}
        </div>
    );
};

export default SchedulerView;