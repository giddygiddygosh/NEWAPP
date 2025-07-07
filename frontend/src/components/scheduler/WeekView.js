// src/components/scheduler/WeekView.js

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Clock } from 'lucide-react';
import { getWeekDays, isSameDay, STATUS_CONFIG } from '../../utils/helpers';
import { format } from 'date-fns';

const WeekView = ({ jobs, currentDate, onOpenDetails, staff, onJobUpdate }) => {
    const [dragOverDay, setDragOverDay] = useState(null);
    const [isDraggingJob, setIsDraggingJob] = useState(false);
    const dragLeaveTimeoutRef = useRef(null); // Ref to store the timeout ID for dragLeave

    const handleDragStart = useCallback((e, jobId) => {
        console.log("WeekView: DragStart initiated for jobId:", jobId); // Debugging: Check if this fires consistently
        setIsDraggingJob(true); // Set dragging state immediately

        // Set the data payload for the drag operation
        e.dataTransfer.setData("jobId", jobId);
        e.dataTransfer.effectAllowed = "move"; // Explicitly allow 'move' effect

        // Optional: Set a custom drag image for smoother visual. Transparent gif is good.
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent 1x1 gif base64
        e.dataTransfer.setDragImage(img, 0, 0); // Set to a transparent image, positioned at cursor

        // Add an onDragEnd listener for additional cleanup or debugging
        // This is crucial to reset isDraggingJob even if the drag is aborted (e.g., released outside a drop target)
        const handleDragEndCleanup = () => {
            console.log("WeekView: DragEnd detected for jobId:", jobId); // CRITICAL DEBUG LOG
            setIsDraggingJob(false); // Ensure dragging state is reset on drag end
            // Clean up the event listener itself to prevent it from firing multiple times if re-attached
            e.currentTarget.removeEventListener('dragend', handleDragEndCleanup);
        };
        // Attach the dragend listener to the element that started the drag (e.currentTarget is the JobCard div)
        e.currentTarget.addEventListener('dragend', handleDragEndCleanup);

    }, []); // No external dependencies for this useCallback, it's self-contained.

    const handleDragOver = useCallback((e) => {
        e.preventDefault(); // Crucial: Allows dropping
        e.dataTransfer.dropEffect = "move"; // Indicate that a 'move' operation is allowed here
        // Clear any pending dragLeave timeout if the user re-enters/stays over a valid target
        if (dragLeaveTimeoutRef.current) {
            clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = null;
        }
    }, []);

    const handleDragEnter = useCallback((day) => {
        // Corrected typo here: dragLeaveTimeoutRefRef -> dragLeaveTimeoutRef
        if (dragLeaveTimeoutRef.current) { // THIS LINE WAS THE PROBLEM (Line 51)
            clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = null;
        }
        setDragOverDay(day); // Set the current day as the drag over target
    }, []);

    const handleDragLeave = useCallback(() => {
        // Set a timeout to clear dragOverDay. If handleDragEnter/Over fires again, it will cancel this.
        if (dragLeaveTimeoutRef.current) { // Clear any existing timeout before setting a new one
            clearTimeout(dragLeaveTimeoutRef.current);
        }
        // Give a small grace period (e.g., 50ms) before truly considering it "left"
        dragLeaveTimeoutRef.current = setTimeout(() => {
            setDragOverDay(null); // Only clear if the mouse doesn't re-enter within the timeout
            dragLeaveTimeoutRef.current = null; // Clear the ref after timeout fires
        }, 50); // Adjust this value (e.g., 30ms-100ms) for desired responsiveness vs. forgiveness
    }, []);

    const handleDrop = useCallback((e, newDate) => {
        e.preventDefault();
        setDragOverDay(null); // Clear drag over state immediately on drop
        // setIsDraggingJob will be reset by the dragend listener, so it's not strictly needed here

        // Clear any pending dragLeave timeout on final drop to prevent unwanted flicker
        if (dragLeaveTimeoutRef.current) {
            clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = null;
        }

        const jobId = e.dataTransfer.getData("jobId");
        if (!jobId) {
            console.warn("WeekView: No jobId found in dataTransfer on drop.");
            return;
        }

        const droppedJob = jobs.find(j => j._id === jobId);
        if (!droppedJob) {
            console.warn(`WeekView: Dropped job with ID ${jobId} not found in current jobs state.`);
            return;
        }

        const originalJobDate = new Date(droppedJob.date);

        if (!isSameDay(originalJobDate, newDate)) {
            const changes = {
                date: newDate.toISOString().split('T')[0],
            };
            onJobUpdate(jobId, changes);
        } else {
            console.log("WeekView: Job dropped on the same day, no update needed.");
        }
    }, [jobs, onJobUpdate]); // Add jobs and onJobUpdate to useCallback dependencies

    const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

    const staffWithUnassigned = useMemo(() => {
        const uniqueStaff = Array.from(new Map((staff || []).map(s => [s._id, s])).values());
        const staffWithPhotos = uniqueStaff.map(s => ({
            _id: s._id,
            name: s.contactPersonName,
            profilePhotoUrl: s.profilePhotoUrl
        }));
        return [...staffWithPhotos, { _id: 'unassigned', name: 'Unassigned', isUnassigned: true }];
    }, [staff]);

    const JobCard = ({ job, onClick, onDragStart, className, isDraggingGlobal }) => {
        const jobStatusColor = STATUS_CONFIG[job.status]?.color || 'gray';
        const customerDisplayName = job.customer?.contactPersonName || job.customerName;

        return (
            <div
                key={job._id}
                draggable="true" // Ensure this is explicitly true
                onDragStart={onDragStart} // This handler is passed from the parent WeekView
                onClick={onClick}
                className={`p-2 bg-white rounded-lg shadow-md border-l-4
                            border-${jobStatusColor}-500 text-${jobStatusColor}-800 text-xs ${className}
                            z-20 // Ensure job cards are on top and draggable
                            ${isDraggingGlobal ? 'no-transition' : 'transition-all duration-200 ease-in-out'} // Apply no-transition class
                            cursor-grab active:cursor-grabbing // Ensure cursor feedback is always there
                           `}
            >
                <p className="font-bold text-sm text-gray-900 truncate">{job.serviceType}</p>
                <p className="font-semibold text-xs text-gray-700 truncate">{customerDisplayName}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center"><Clock size={14} className="inline mr-1 text-gray-400"/> {job.time}</p>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-7 divide-x divide-gray-200 h-full">
            {weekDays.map(day => {
                // Filter jobs for the current day, considering multi-day jobs
                const dayJobs = (jobs || []).filter(job => {
                    const jobStartDate = new Date(job.date);
                    const jobEndDate = job.endDate ? new Date(job.endDate) : jobStartDate;
                    return isSameDay(jobStartDate, day) || isSameDay(jobEndDate, day) || (jobStartDate < day && jobEndDate > day);
                }).sort((a,b) => (a.time || '').localeCompare(b.time || '')); // Safely sort by time

                const isToday = isSameDay(new Date(), day); // Using isSameDay from helpers
                const isDragOver = dragOverDay && isSameDay(dragOverDay, day);

                return (
                    <div
                        key={day.toISOString()}
                        className={`flex flex-col transition-colors duration-200 ${isDragOver ? 'bg-blue-50' : ''}`}
                        // Attach drag and drop handlers to the entire day column div
                        onDragOver={handleDragOver}
                        onDragEnter={() => handleDragEnter(day)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day)} // Drop target is the date for the column
                    >
                        <div className={`p-3 text-center border-b border-gray-200 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
                            <p className="text-sm font-semibold text-gray-500">{day.toLocaleString('default', { weekday: 'short' })}</p>
                            <p className={`text-3xl font-bold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>{day.getDate()}</p>
                        </div>
                        <div className="flex-grow p-3 space-y-3 bg-white min-h-[60vh] overflow-y-auto custom-scrollbar">
                            {dayJobs.length > 0 ? dayJobs.map(job => (
                                <JobCard
                                    key={job._id}
                                    job={job}
                                    onDragStart={(e) => handleDragStart(e, job._id)}
                                    onClick={(e) => { e.stopPropagation(); onOpenDetails(job); }}
                                    isDraggingGlobal={isDraggingJob} // Pass the new state
                                />
                            )) : (
                                <div className="text-center text-sm text-gray-400 pt-8 h-full">No jobs scheduled.</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default WeekView;