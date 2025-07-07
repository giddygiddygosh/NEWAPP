import React, { useState, useMemo, useCallback } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isToday as isDateToday, addDays } from 'date-fns';
import { Clock } from 'lucide-react';
import { STATUS_CONFIG } from '../../utils/helpers';

const MonthView = ({ jobs, currentDate, onOpenDetails, onOpenModal, onDayClick, onJobUpdate }) => {
    const [dragOverDay, setDragOverDay] = useState(null);

    const handleDragStart = useCallback((e, jobId) => {
        e.dataTransfer.setData("jobId", jobId);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault(); // Essential to allow dropping
    }, []);

    const handleDragEnter = useCallback((day) => {
        setDragOverDay(day);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverDay(null);
    }, []);

    const handleDrop = useCallback((e, newDate) => {
        e.preventDefault();
        setDragOverDay(null); // Clear drag over state immediately on drop

        const jobId = e.dataTransfer.getData("jobId");
        if (!jobId) {
            console.warn("No jobId found in dataTransfer on drop.");
            return;
        }

        const droppedJob = jobs.find(j => j._id === jobId);
        if (!droppedJob) {
            console.warn(`Dropped job with ID ${jobId} not found in current jobs state.`);
            return;
        }

        const originalJobDate = new Date(droppedJob.date);

        if (!isSameDay(originalJobDate, newDate)) {
            const changes = {
                date: newDate.toISOString().split('T')[0], // Send date as YYYY-MM-DD string
            };
            onJobUpdate(jobId, changes);
        } else {
            console.log("Job dropped on the same day, no update needed.");
        }
    }, [jobs, onJobUpdate]);

    const firstDay = useMemo(() => startOfMonth(currentDate), [currentDate]);
    const lastDay = useMemo(() => endOfMonth(currentDate), [currentDate]);

    // Calculate the start of the calendar grid (Sunday before the 1st of the month)
    const startDate = useMemo(() => {
        const start = new Date(firstDay);
        start.setDate(start.getDate() - start.getDay()); // Go to the Sunday of that week
        return start;
    }, [firstDay]);

    // Calculate the end of the calendar grid (Saturday after the last of the month)
    const endDate = useMemo(() => {
        const end = new Date(lastDay);
        end.setDate(end.getDate() + (6 - end.getDay())); // Go to the Saturday of that week
        return end;
    }, [lastDay]);

    const daysInMonthView = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    // Group jobs by day for easy rendering
    const jobsByDay = useMemo(() => {
        const map = new Map();
        (jobs || []).forEach(job => {
            // For MonthView, we typically just show on the job's start date
            const jobDate = new Date(job.date);
            const dateKey = format(jobDate, 'yyyy-MM-dd'); // Use a consistent key for grouping
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey).push(job);
        });
        return map;
    }, [jobs]);

    const JobCard = ({ job, onDragStart, onClick }) => {
        const jobStatusColor = STATUS_CONFIG[job.status]?.color || 'gray';
        const customerDisplayName = job.customer?.contactPersonName || job.customerName;

        return (
            <div
                draggable="true"
                onDragStart={(e) => onDragStart(e, job._id)}
                onClick={(e) => { e.stopPropagation(); onClick(job); }} // Stop propagation to prevent day click
                className={`flex items-center gap-1 p-1 pr-2 rounded-md bg-${jobStatusColor}-100 text-${jobStatusColor}-800
                            border-l-4 border-${jobStatusColor}-500 text-xs truncate cursor-pointer hover:shadow-md transition-shadow
                            z-20 // Ensure job cards are above the day cell background and other items
                            `}
                title={`${job.serviceType} - ${customerDisplayName} (${job.time})`}
            >
                <Clock size={12} className="flex-shrink-0" />
                <span className="font-semibold truncate">{job.serviceType}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 text-center text-sm font-semibold text-gray-600 border-b border-gray-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-3">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 flex-grow overflow-auto border-t border-gray-200">
                {daysInMonthView.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isToday = isDateToday(day);
                    const isDragOver = dragOverDay && isSameDay(dragOverDay, day);

                    const dayClass = `
                        p-2 border-r border-b border-gray-200 relative
                        ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                        ${isToday ? 'bg-blue-50' : ''}
                        ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-100/50' : ''}
                        flex flex-col justify-between
                        min-h-[120px]
                    `;

                    return (
                        <div
                            key={dateKey}
                            className={dayClass}
                            onDragOver={handleDragOver}
                            onDragEnter={() => handleDragEnter(day)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, day)}
                            onClick={() => onDayClick(day)}
                        >
                            <div className={`text-right text-sm font-bold mb-2 ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                                {format(day, 'd')}
                            </div>
                            <div className="flex-grow space-y-1 overflow-y-auto custom-scrollbar">
                                {(jobsByDay.get(dateKey) || []).map(job => (
                                    <JobCard
                                        key={job._id}
                                        job={job}
                                        onDragStart={handleDragStart}
                                        onClick={onOpenDetails}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthView;