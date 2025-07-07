import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { isSameDay, STATUS_CONFIG, isJobVisibleOnDate, calculateJobDisplayTimes } from '../../utils/helpers';
import { Clock, User, Briefcase } from 'lucide-react';
import { format } from 'date-fns'; // Import format for consistent date string creation

const START_HOUR = 0; // Represents 00:00 for the start of the visible grid
const END_HOUR = 23; // Represents 23:00 for the end of the visible grid
const PIXELS_PER_HOUR = 120;
const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

const DayView = ({ jobs, currentDate, onOpenDetails, staff, layout, onJobUpdate, fetchSchedulerData }) => {
    // relevantJobs now acts as the *displayed* jobs, which will be updated by parent's 'jobs' prop
    // when parent's 'jobs' state changes (either from fetchSchedulerData or optimistic update)
    const [relevantJobs, setRelevantJobs] = useState([]);
    const [dragOverStaffId, setDragOverStaffId] = useState(null);
    const [resizingInfo, setResizingInfo] = useState(null);
    const timeGridContainerRef = useRef(null);

    // Update relevantJobs whenever the 'jobs' prop or 'currentDate' changes
    useEffect(() => {
        setRelevantJobs((jobs || []).filter(job => isJobVisibleOnDate(job, currentDate)));
    }, [jobs, currentDate]); // 'jobs' is now a direct dependency

    const timedJobs = useMemo(() => (relevantJobs || []).map(job => calculateJobDisplayTimes(job, START_HOUR, END_HOUR, currentDate)), [relevantJobs, currentDate]);
    const timeSlotLabels = useMemo(() => Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => `${(i + START_HOUR).toString().padStart(2, '0')}:00`), []);
    const staffWithUnassigned = useMemo(() => {
        const uniqueStaff = Array.from(new Map((staff || []).map(s => [s._id, s])).values());
        const staffWithPhotos = uniqueStaff.map(s => ({ _id: s._id, name: s.contactPersonName, profilePhotoUrl: s.profilePhotoUrl }));
        return [...staffWithPhotos, { _id: 'unassigned', name: 'Unassigned', isUnassigned: true }];
    }, [staff]);

    const isTimeSlotAvailable = useCallback((jobIdToIgnore, targetStaffId, newStartTime, newDuration) => {
        const now = new Date();
        const newStartDateOnly = new Date(newStartTime);
        newStartDateOnly.setHours(0, 0, 0, 0);

        const todayDateOnly = new Date(now);
        todayDateOnly.setHours(0, 0, 0, 0);

        // Client-side validation: Do not allow movement to past dates or times on the current day
        if (newStartDateOnly < todayDateOnly) {
            alert('Error: You cannot move a job to a past date.');
            return false;
        }
        if (isSameDay(newStartTime, now) && newStartTime < now) {
            alert('Error: You cannot move a job to a past time on the current day.');
            return false;
        }

        // Check for conflicts with other jobs for the same staff member
        if (targetStaffId && targetStaffId !== 'unassigned') {
            const newEndTime = new Date(newStartTime.getTime() + newDuration * 60000);
            const conflictingJob = jobs.find(job => { // Use the 'jobs' prop directly for conflict check
                if (job._id === jobIdToIgnore) return false;

                const jobStaffId = job.assignedStaff && job.assignedStaff.length > 0 ? (job.assignedStaff[0]._id || job.assignedStaff[0]) : null;
                if (jobStaffId !== targetStaffId) return false;

                const jobDateStr = typeof job.date === 'string' ? job.date.split('T')[0] : format(new Date(job.date), 'yyyy-MM-dd');

                const existingStartTime = new Date(`${jobDateStr}T${job.time}`);
                const existingEndTime = new Date(existingStartTime.getTime() + job.duration * 60000);

                return newStartTime < existingEndTime && newEndTime > existingStartTime;
            });
            if (conflictingJob) {
                alert(`Error: This time slot conflicts with another job for this staff member.`);
                return false;
            }
        }
        return true;
    }, [jobs]); // 'jobs' is a dependency for this useCallback

    const handleDragStart = useCallback((e, jobId) => {
        e.dataTransfer.setData("jobId", jobId);
    }, []);

    const handleDragOver = useCallback((e) => e.preventDefault(), []);
    const handleDragEnter = useCallback((staffId) => setDragOverStaffId(staffId), []);
    const handleDragLeave = useCallback(() => setDragOverStaffId(null), []);

    const handleDrop = useCallback((e, targetStaffId) => {
        e.preventDefault();
        setDragOverStaffId(null);
        const jobId = e.dataTransfer.getData("jobId");
        const droppedJob = relevantJobs.find(j => j._id === jobId);
        if (!jobId || !droppedJob) return;

        const timeGridEl = timeGridContainerRef.current;
        if (!timeGridEl) return;

        let newTime = droppedJob.time;
        // Only calculate new time if it's not a multi-day job (which typically wouldn't be dragged for time)
        if (!droppedJob.endDate || isSameDay(new Date(droppedJob.date), new Date(droppedJob.endDate))) {
            const rect = timeGridEl.getBoundingClientRect();
            let pixelOffsetInGrid;

            if (layout === 'horizontal') {
                pixelOffsetInGrid = (e.clientX - rect.left + timeGridEl.scrollLeft);
            } else {
                pixelOffsetInGrid = (e.clientY - rect.top + timeGridEl.scrollTop);
            }

            const minutesFromCalendarStart = pixelOffsetInGrid / PIXELS_PER_MINUTE;
            const snappedMinutesFromCalendarStart = Math.round(minutesFromCalendarStart / 5) * 5;
            const newTotalMinutesFromMidnight = snappedMinutesFromCalendarStart + (START_HOUR * 60);

            const newStartHour = Math.floor(newTotalMinutesFromMidnight / 60);
            const newStartMinute = newTotalMinutesFromMidnight % 60;

            newTime = `${String(newStartHour).padStart(2, '0')}:${String(newStartMinute).padStart(2, '0')}`;
        }

        const newStartTime = new Date(`${format(currentDate, 'yyyy-MM-dd')}T${newTime}`);
        // Check for conflicts using the full 'jobs' prop, not just 'relevantJobs' if the check is across all jobs
        if (!isTimeSlotAvailable(jobId, targetStaffId, newStartTime, droppedJob.duration)) {
            return;
        }

        const changes = {};
        const timeChanged = newTime !== droppedJob.time;
        const currentAssignedStaffId = (droppedJob.assignedStaff && droppedJob.assignedStaff.length > 0)
            ? (droppedJob.assignedStaff[0]._id || droppedJob.assignedStaff[0])
            : 'unassigned';
        const staffChanged = currentAssignedStaffId !== targetStaffId;

        if (timeChanged) changes.time = newTime;
        if (staffChanged) changes.assignedStaff = targetStaffId === 'unassigned' ? [] : [targetStaffId];

        if (Object.keys(changes).length > 0) {
            onJobUpdate(jobId, changes);
        }
    }, [relevantJobs, layout, currentDate, isTimeSlotAvailable, onJobUpdate]); // relevantJobs added to dependencies

    const handleResizeStart = useCallback((e, jobId, direction) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = layout === 'vertical' ? 'ns-resize' : 'ew-resize';
        setResizingInfo({ jobId, direction, originalDuration: relevantJobs.find(j => j._id === jobId)?.duration }); // Store original duration
    }, [layout, relevantJobs]);

    const handleMouseMove = useCallback((e) => {
        if (!resizingInfo) return;
        const { jobId, direction, originalDuration } = resizingInfo; // Use originalDuration
        const timeGridEl = timeGridContainerRef.current;
        if (!timeGridEl) return;
        const rect = timeGridEl.getBoundingClientRect();
        let minutesFromStartOfGrid;
        if (layout === 'horizontal') {
            minutesFromStartOfGrid = (e.clientX - rect.left + timeGridEl.scrollLeft) / PIXELS_PER_MINUTE;
        } else {
            minutesFromStartOfGrid = (e.clientY - rect.top + timeGridEl.scrollTop) / PIXELS_PER_MINUTE;
        }

        const snappedMinutes = Math.round(minutesFromStartOfGrid / 15) * 15;

        setRelevantJobs(prevJobs => prevJobs.map(job => {
            if (job._id === jobId) {
                const originalStartMinutesRelativeToCalendar = (parseInt(job.time.split(':')[0]) * 60 + parseInt(job.time.split(':')[1])) - (START_HOUR * 60);
                const originalEndMinutesRelativeToCalendar = originalStartMinutesRelativeToCalendar + (originalDuration !== undefined ? originalDuration : job.duration); // Use originalDuration or current

                let newStartMinutesRelativeToCalendar = originalStartMinutesRelativeToCalendar;
                let newEndMinutesRelativeToCalendar = originalEndMinutesRelativeToCalendar;

                if (direction === 'start') {
                    newStartMinutesRelativeToCalendar = Math.min(snappedMinutes, originalEndMinutesRelativeToCalendar - 15);
                } else { // direction === 'end'
                    newEndMinutesRelativeToCalendar = Math.max(snappedMinutes, originalStartMinutesRelativeToCalendar + 15);
                }

                const newDuration = newEndMinutesRelativeToCalendar - newStartMinutesRelativeToCalendar;
                if (newDuration < 15) return job; // Minimum duration of 15 minutes

                const newTotalStartMinutesFromMidnight = newStartMinutesRelativeToCalendar + (START_HOUR * 60);
                const newStartHour = Math.floor(newTotalStartMinutesFromMidnight / 60);
                const newStartMinute = newTotalStartMinutesFromMidnight % 60;
                const newTime = `${String(newStartHour).padStart(2, '0')}:${String(newStartMinute).padStart(2, '0')}`;

                return { ...job, time: newTime, duration: newDuration };
            }
            return job;
        }));
    }, [resizingInfo, layout, START_HOUR, relevantJobs]); // Added relevantJobs to dependencies for consistent state access during resize

    const handleMouseUp = useCallback(() => {
        if (!resizingInfo) return;
        document.body.style.cursor = 'default';
        const finalJob = relevantJobs.find(j => j._id === resizingInfo.jobId);
        if (finalJob) {
            const targetStaffId = (finalJob.assignedStaff && finalJob.assignedStaff.length > 0) ? (finalJob.assignedStaff[0]._id || finalJob.assignedStaff[0]) : 'unassigned';
            const newStartTime = new Date(`${format(currentDate, 'yyyy-MM-dd')}T${finalJob.time}`);
            if (isTimeSlotAvailable(finalJob._id, targetStaffId, newStartTime, finalJob.duration)) {
                onJobUpdate(finalJob._id, { time: finalJob.time, duration: finalJob.duration });
            } else {
                fetchSchedulerData(); // Revert to previous state by fetching data again
            }
        }
        setResizingInfo(null);
    }, [resizingInfo, relevantJobs, onJobUpdate, currentDate, fetchSchedulerData, isTimeSlotAvailable]);

    useEffect(() => {
        if (resizingInfo) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingInfo, handleMouseMove, handleMouseUp]);

    const JobCard = ({ job, positionStyles = {}, onResizeStart, layout }) => {
        const customerDisplayName = job.customer?.contactPersonName || job.customerName;
        const jobStatusColor = STATUS_CONFIG[job.status]?.color || 'gray';
        const handleMouseDownOnResize = (e, direction) => { e.stopPropagation(); onResizeStart(e, job._id, direction); };

        return (
            <div
                key={job._id}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, job._id)}
                onClick={() => onOpenDetails(job)}
                className={`p-2 text-xs rounded-lg shadow-sm z-20 overflow-hidden flex flex-col justify-center bg-${jobStatusColor}-100 text-${jobStatusColor}-800 border-l-4 border-${jobStatusColor}-500 transition-all duration-200 ease-in-out cursor-grab active:cursor-grabbing relative`}
                style={positionStyles}
            >
                {layout === 'vertical' ? (
                    <>
                        <div onMouseDown={(e) => handleMouseDownOnResize(e, 'start')} className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-gray-300 hover:bg-blue-500 rounded-full cursor-ns-resize" />
                        <div onMouseDown={(e) => handleMouseDownOnResize(e, 'end')} className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-gray-300 hover:bg-blue-500 rounded-full cursor-ns-resize" />
                    </>
                ) : (
                    <>
                        <div onMouseDown={(e) => handleMouseDownOnResize(e, 'start')} className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 bg-gray-300 hover:bg-blue-500 rounded-full cursor-ew-resize" />
                        <div onMouseDown={(e) => handleMouseDownOnResize(e, 'end')} className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1.5 bg-gray-300 hover:bg-blue-500 rounded-full cursor-ew-resize" />
                    </>
                )}
                <div className="px-1">
                    <p className="font-bold text-sm text-gray-900 truncate">{job.serviceType}</p>
                    <p className="font-semibold text-xs text-gray-700 truncate">{customerDisplayName}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center"><Clock size={14} className="inline mr-1 text-gray-400"/> {job.time}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 bg-white rounded-xl shadow-lg h-full relative overflow-hidden">
            {layout === 'vertical' ? (
                <div className="flex flex-col h-full">
                    <div className="flex-shrink-0 grid grid-cols-[auto_1fr] border-b border-gray-200 bg-gray-50 sticky top-0 z-30">
                        <div className="w-24 text-center text-sm font-bold text-blue-700 p-3">Time</div>
                        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${staffWithUnassigned.length}, minmax(0, 1fr))` }}>{staffWithUnassigned.map(staffMember => (<h3 key={staffMember._id} className="text-center font-bold text-md py-3 border-l border-gray-200 flex flex-col items-center gap-1">{staffMember.profilePhotoUrl ? <img src={staffMember.profilePhotoUrl} alt={staffMember.name} className="w-8 h-8 rounded-full object-cover" /> : (staffMember.isUnassigned ? <Briefcase size={20} className="text-gray-500" /> : <User size={20} className="text-blue-500" />)}<span className={staffMember.isUnassigned ? "text-gray-600 font-semibold" : "text-blue-600 font-semibold"}>{staffMember.name}</span></h3>))}</div></div>
                    <div ref={timeGridContainerRef} className="flex-1 flex relative overflow-y-auto custom-scrollbar">
                        <div className="w-24 flex-shrink-0 border-r border-gray-200 bg-white">{timeSlotLabels.map(time => (<div key={time} className="text-center text-xs pt-2 text-gray-700 font-semibold border-b border-gray-100" style={{ height: `${PIXELS_PER_HOUR}px` }}>{time}</div>))}</div>
                        <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${staffWithUnassigned.length}, minmax(0, 1fr))` }}>
                            <div className="absolute inset-0 z-0">{Array.from({ length: (END_HOUR - START_HOUR + 1) * 12 }).map((_, i) => (<div key={`line-h-bg-${i}`} className="absolute left-0 right-0 border-t border-dashed border-gray-200" style={{ top: `${(i) * (PIXELS_PER_MINUTE * 5)}px` }}></div>))}</div>
                            {staffWithUnassigned.map((staffMember) => (
                                <div key={staffMember._id} className={`relative h-full ${dragOverStaffId === staffMember._id ? 'bg-blue-100/50' : ''}`} onDragOver={handleDragOver} onDragEnter={() => handleDragEnter(staffMember._id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, staffMember._id)}>
                                    {timedJobs.filter(job => {
                                        const jobStaffId = job.assignedStaff && job.assignedStaff.length > 0 ? (job.assignedStaff[0]._id || job.assignedStaff[0]) : 'unassigned';
                                        return jobStaffId === staffMember._id;
                                    }).map(job => {
                                        const jobDisplayData = calculateJobDisplayTimes(job, START_HOUR, END_HOUR, currentDate);
                                        const top = (jobDisplayData.displayStartMinutes - (START_HOUR * 60)) * PIXELS_PER_MINUTE;
                                        if (jobDisplayData.displayDurationMinutes <= 0) return null;
                                        return (<JobCard key={job._id} job={job} onOpenDetails={onOpenDetails} layout={layout} onResizeStart={handleResizeStart} positionStyles={{ top: `${top}px`, height: `${jobDisplayData.displayDurationMinutes * PIXELS_PER_MINUTE - 2}px`, left: '2px', right: '2px', position: 'absolute' }} />);
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex h-full">
                    <div className="flex-shrink-0 w-36 border-r border-gray-200 bg-gray-50">
                        <div className="h-16 flex items-center justify-center p-2 text-sm font-bold text-blue-700 border-b border-gray-200">Staff</div>
                        {staffWithUnassigned.map(staffMember => (<div key={staffMember._id} className="h-24 border-b border-gray-200 flex flex-col items-center justify-center p-2 text-center text-sm font-medium bg-white">{staffMember.profilePhotoUrl ? <img src={staffMember.profilePhotoUrl} alt={staffMember.name} className="w-10 h-10 rounded-full object-cover mb-1" /> : (staffMember.isUnassigned ? <Briefcase size={24} className="text-gray-500 mb-1" /> : <User size={24} className="text-blue-500 mb-1" />)}<span className={staffMember.isUnassigned ? "text-gray-600 font-semibold" : "text-blue-600 font-semibold"}>{staffMember.name}</span></div>))}
                    </div>
                    <div ref={timeGridContainerRef} className="flex-1 overflow-auto custom-scrollbar">
                        <div className="sticky top-0 z-20 bg-gray-50"><div className="flex h-16 border-b border-gray-200" style={{ minWidth: `${(END_HOUR - START_HOUR + 1) * PIXELS_PER_HOUR}px` }}>{timeSlotLabels.map(time => <div key={time} style={{ width: `${PIXELS_PER_HOUR}px` }} className="flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-xs text-gray-700 font-semibold">{time}</div>)}</div></div>
                        <div className="relative" style={{minWidth: `${(END_HOUR - START_HOUR + 1) * PIXELS_PER_HOUR}px`}}>
                            {staffWithUnassigned.map((staffMember) => (
                                <div key={staffMember._id} className={`relative h-24 border-b border-gray-200 transition-colors duration-200 ${dragOverStaffId === staffMember._id ? 'bg-blue-100/50' : ''}`} onDragOver={handleDragOver} onDragEnter={() => handleDragEnter(staffMember._id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, staffMember._id)}>
                                    <div className="absolute inset-0 z-0">{Array.from({ length: (END_HOUR - START_HOUR + 1) * 12 }).map((_, i) => (<div key={`line-v-bg-${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-gray-200" style={{ left: `${(i) * (PIXELS_PER_MINUTE * 5)}px` }}></div>))}</div>
                                    {timedJobs.filter(job => {
                                        const jobStaffId = job.assignedStaff && job.assignedStaff.length > 0 ? (job.assignedStaff[0]._id || job.assignedStaff[0]) : 'unassigned';
                                        return jobStaffId === staffMember._id;
                                    }).map(job => {
                                        const jobDisplayData = calculateJobDisplayTimes(job, START_HOUR, END_HOUR, currentDate);
                                        const left = (jobDisplayData.displayStartMinutes - (START_HOUR * 60)) * PIXELS_PER_MINUTE;
                                        const width = jobDisplayData.displayDurationMinutes * PIXELS_PER_MINUTE;
                                        if (jobDisplayData.displayDurationMinutes <= 0) return null;
                                        return (<JobCard key={job._id} job={job} onOpenDetails={onOpenDetails} layout={layout} onResizeStart={handleResizeStart} positionStyles={{ left: `${left + 2}px`, width: `${Math.max(30, width - 4)}px`, top: '2px', bottom: '2px', position: 'absolute' }} />);
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DayView;