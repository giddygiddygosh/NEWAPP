// src/components/scheduler/SchedulerView.jsx

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import CalendarHeader from './CalendarHeader';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import Loader from '../common/Loader';
import JobModal from '../jobs/JobModal';
import api from '../../utils/api';
import { startOfMonth, endOfMonth, addDays, startOfDay, getDay, isSameDay } from 'date-fns';

const LOCAL_STORAGE_VIEW_MODE_KEY = 'schedulerViewMode';
const LOCAL_STORAGE_LAYOUT_KEY = 'schedulerDayViewLayout';
const LOCAL_STORAGE_CURRENT_DATE_KEY = 'schedulerCurrentDate';

const SchedulerView = (props) => {
    const getInitialViewMode = () => localStorage.getItem(LOCAL_STORAGE_VIEW_MODE_KEY) || 'month';
    const getInitialDayViewLayout = () => localStorage.getItem(LOCAL_STORAGE_LAYOUT_KEY) || 'vertical';
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
    const [viewMode, setViewMode] = useState(getInitialViewMode);
    const [dayViewLayout, setDayViewLayout] = useState(getInitialDayViewLayout);
    const [currentDate, setCurrentDate] = useState(getInitialCurrentDate);
    const [customerFilter, setCustomerFilter] = useState('all');
    const [staffFilter, setStaffFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [userFacingError, setUserFacingError] = useState(null);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [jobToEdit, setJobToEdit] = useState(null);

    const activeFetchIdRef = useRef(0);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_VIEW_MODE_KEY, viewMode);
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_LAYOUT_KEY, dayViewLayout);
    }, [dayViewLayout]);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_CURRENT_DATE_KEY, currentDate.toISOString());
    }, [currentDate]);

    const fetchSchedulerData = useCallback(async () => {
        const fetchId = ++activeFetchIdRef.current;
        
        setUserFacingError(null);
        setIsLoading(true);

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
                setIsLoading(false);
            }
        }
    }, [currentDate, viewMode]);

    useEffect(() => {
        fetchSchedulerData();
    }, [fetchSchedulerData]);

    const handleJobUpdate = useCallback(async (jobId, updatedData) => {
        const originalJob = jobs.find(j => j._id === jobId);
        if (!originalJob) return;

        setJobs(prevJobs => prevJobs.map(job =>
            job._id === jobId ? { ...job, ...updatedData } : job
        ));
        setUserFacingError(null);

        try {
            const response = await api.put(`/jobs/${jobId}`, updatedData);
            setJobs(prevJobs => prevJobs.map(job =>
                job._id === jobId ? response.data.job : job
            ));
        } catch (err) {
            console.error("Job update failed (backend error):", err.response?.data?.message || err.message, err);
            setUserFacingError(err.response?.data?.message || 'Failed to update job. Reverting changes.');
            fetchSchedulerData();
        }
    }, [jobs, fetchSchedulerData]);

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

    // --- FIX START: This function now correctly handles the date ---
    const handleOpenJobModal = useCallback((date) => {
        // Helper function to format the date correctly, avoiding timezone issues.
        const toLocalISOString = (dateObj) => {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // If a date is passed (e.g., from clicking on the calendar), use it.
        // Otherwise, default to the current local date.
        const targetDate = date ? new Date(date) : new Date();

        const newJobTemplate = {
            date: toLocalISOString(targetDate), // Use the safe formatter
            recurring: { pattern: 'none', endDate: null }
        };
        setJobToEdit(newJobTemplate);
        setIsJobModalOpen(true);
    }, []);
    // --- FIX END ---

    const handleOpenDetailsModal = useCallback((job) => {
        const preparedJobData = {
            ...job,
            assignedStaff: job.staff, 
            usedStockItems: (job.usedStock || []).map(item => ({
                stockItem: item.stockId,
                name: item.name,
                unit: item.unit,
                quantityUsed: item.quantity
            })),
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

        if (!savedJob || !savedJob._id) {
            fetchSchedulerData(); 
            return;
        }

        setJobs(prevJobs => {
            const existingJobIndex = prevJobs.findIndex(job => job._id === savedJob._id);

            if (existingJobIndex > -1) {
                const updatedJobs = [...prevJobs];
                updatedJobs[existingJobIndex] = savedJob;
                return updatedJobs;
            } else {
                return [...prevJobs, savedJob];
            }
        });
    }, [fetchSchedulerData]);

    const filteredJobs = useMemo(() => {
        if (!jobs) return [];
        return jobs.filter(job =>
            (customerFilter === 'all' || job.customer?._id === customerFilter) &&
            (staffFilter === 'all' || (job.staff || []).some(s => (s._id || s) === staffFilter))
        );
    }, [jobs, customerFilter, staffFilter]);

    return (
        <div className="h-full flex flex-col p-8">
            {userFacingError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {userFacingError}
                </div>
            )}

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
                isLoadingCustomers={isLoading}
                isLoadingStaff={isLoading}
                className="flex-shrink-0 mb-6"
            />

            <div className="bg-white rounded-xl shadow-lg flex-1 flex flex-col p-6 w-full">
                {isLoading ? (
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



