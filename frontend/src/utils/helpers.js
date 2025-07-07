// ServiceOS/frontend/src/utils/helpers.js

import {
    DollarSign,
    PoundSterling,
    Euro,
    Clock,
    CheckCircle,
    CheckCircle2,
    FileText,
    XCircle,
    Hourglass,
    Package,
    Pause,
    Tag,
    BriefcaseMedical
} from 'lucide-react';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ===============================================
// CURRENCY HELPERS
// ===============================================
export const getCurrencySymbol = (code) => {
    switch (code) {
        case 'GBP': return '£';
        case 'USD': return '$';
        case 'EUR': return '€';
        case 'CAD': return 'C$';
        case 'AUD': return 'A$';
        case 'JPY': return '¥';
        case 'CNY': return '¥';
        case 'INR': return '₹';
        default: return '';
    }
};

// ===============================================
// STRING / TEXT HELPERS
// ===============================================
export const toTitleCase = (str) => {
    if (!str) return '';
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
};

// ===============================================
// DATE & TIME HELPERS
// ===============================================
export const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Kept the one with more robust date parsing/comparison
export const isDateOverdue = (dateString) => {
    if (!dateString) return false;
    const checkDate = new Date(dateString);
    const today = new Date();
    checkDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return checkDate < today;
};

export const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

export const isToday = (date) => {
    return isSameDay(date, new Date());
};

export const isSameMonth = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth();
};

export const getMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();
    const days = [];
    const startOfWeekDay = (firstDay.getDay() === 0) ? 6 : firstDay.getDay() - 1; // Adjust for Monday-first week
    for (let i = 0; i < startOfWeekDay; i++) {
        const prevMonthDay = new Date(year, month, 0);
        prevMonthDay.setDate(prevMonthDay.getDate() - (startOfWeekDay - 1 - i));
        days.push(prevMonthDay);
    }
    for (let i = 1; i <= numDays; i++) {
        days.push(new Date(year, month, i));
    }
    const totalCells = days.length;
    const remainingCells = 42 - totalCells; // Ensure 6 rows of 7 days
    for (let i = 1; i <= remainingCells; i++) {
        days.push(new Date(year, month + 1, i));
    }
    return days;
};

export const getWeekDays = (date) => {
    const startOfWeek = new Date(date);
    const dayOfWeek = startOfWeek.getDay(); // Sunday - Saturday : 0 - 6
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    startOfWeek.setDate(diff);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        weekDays.push(day);
    }
    return weekDays;
};

// Consolidated generateTimeSlots (kept the more flexible one)
export const generateTimeSlots = (startHour = 8, endHour = 20, intervalMinutes = 30) => {
    const slots = [];
    for (let h = startHour; h <= endHour; h++) {
        for (let m = 0; m < 60; m += intervalMinutes) {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            // Prevent adding slots past endHour exactly if intervalMinutes doesn't align
            if (h === endHour && m >= 60) continue; 
            slots.push(time);
        }
    }
    return slots;
};

// Helper to convert "HH:MM" string to minutes from midnight
const parseTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60) + minutes;
};

export const isSlotAvailable = (dateString, slotTime, jobDurationMinutes, staffMembers, allJobs) => {
    const checkStartTimeMinutes = parseTime(slotTime);
    const checkEndTimeMinutes = checkStartTimeMinutes + jobDurationMinutes;

    const availableStaffForSlot = [];

    for (const staffMember of staffMembers) {
        // Option to check if staff is explicitly unavailable on a date (e.g., vacation)
        // You'd need to ensure your staff data includes an 'availability' field for this.
        const isStaffUnavailable = staffMember.availability && staffMember.availability[dateString] === false;
        if (isStaffUnavailable) {
            continue; // Skip this staff member if they are explicitly marked unavailable
        }

        let isConflict = false;

        // Filter jobs relevant to this staff member for the specific day
        const staffJobsForDay = allJobs.filter(job =>
            job.assignedStaff?.some(assigned => {
                // Check if assigned is an object with _id (common for populated fields)
                // or if it's just the _id string directly
                if (typeof assigned === 'object' && assigned !== null && assigned._id) {
                    return assigned._id.toString() === staffMember._id.toString();
                }
                return assigned.toString() === staffMember._id.toString(); // If assignedStaff stores only IDs
            }) &&
            isSameDay(new Date(job.date), new Date(dateString)) && // Compare job date with current date string
            job.status !== 'Cancelled' // Do not consider cancelled jobs as conflicts
        );

        for (const existingJob of staffJobsForDay) {
            // Ensure existingJob.time and existingJob.duration are correctly parsed
            const existingJobStartTimeMinutes = parseTime(existingJob.time);
            const existingJobDurationMinutes = parseFloat(existingJob.duration || 0); // Handle potential missing/null duration
            const existingJobEndTimeMinutes = existingJobStartTimeMinutes + existingJobDurationMinutes;

            // Check for overlap: Slot starts before existing job ends, AND slot ends after existing job starts
            if (checkStartTimeMinutes < existingJobEndTimeMinutes && checkEndTimeMinutes > existingJobStartTimeMinutes) {
                isConflict = true;
                break; // Conflict found for this staff member, no need to check other jobs for them
            }
        }

        if (!isConflict) {
            availableStaffForSlot.push(staffMember);
        }
    }

    return availableStaffForSlot;
};


// ===============================================
// STATUS CONFIGURATION
// ===============================================
export const STATUS_CONFIG = {
    'Booked': { color: 'blue', icon: Clock },
    'In Progress': { color: 'yellow', icon: Hourglass },
    'Confirmed': { color: 'indigo', icon: CheckCircle },
    'Completed': { color: 'green', icon: CheckCircle2 },
    'Invoiced': { color: 'purple', icon: FileText },
    'Invoice Paid': { color: 'green', icon: DollarSign },
    'Cancelled': { color: 'red', icon: XCircle },
    'Pending': { color: 'yellow', icon: Hourglass },
    'On Hold': { color: 'orange', icon: Pause },
    'Stock Return Needed': { color: 'orange', icon: Package },
    'Quote Sent': { color: 'teal', icon: Tag },
    'Quote Accepted': { color: 'lime', icon: CheckCircle },
    'Quote Declined': { color: 'rose', icon: XCircle },
    'Emergency': { color: 'red', icon: BriefcaseMedical },
};

export const QUOTE_STATUS_CONFIG = {
    'Pending': { color: 'yellow' },
    'Approved': { color: 'green' },
    'Rejected': { color: 'red' },
    'Converted': { color: 'purple' }
};

// ===============================================
// PDF GENERATION HELPERS
// ===============================================
export const generatePdfFromHtml = (element, filename = 'document.pdf') => {
    if (!element) {
        console.error("Element for PDF generation not found.");
        return;
    }
    html2canvas(element, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        pdf.save(filename);
    }).catch(error => {
        console.error("Error generating PDF:", error);
        alert("Failed to generate PDF. Please try again.");
    });
};

// ===============================================
// JOB DISPLAY / CLIPPING HELPERS (for Scheduler)
// ===============================================

/**
 * NEW, SMARTER FUNCTION to determine if a job should be visible on a given day.
 * It understands the difference between multi-day, one-off, and recurring jobs.
 */
export const isJobVisibleOnDate = (job, dateToCheck) => {
    if (!job || !dateToCheck) return false;

    // Normalize dates to midnight for accurate day-level comparisons
    const checkDate = new Date(dateToCheck);
    checkDate.setHours(0, 0, 0, 0);

    const jobStartDate = new Date(job.date);
    jobStartDate.setHours(0, 0, 0, 0);

    // --- 1. Handle Recurring Jobs ---
    if (job.recurring && job.recurring.pattern && job.recurring.pattern !== 'none') {
        const recurringEndDate = job.recurring.endDate ? new Date(job.recurring.endDate) : null;
        if(recurringEndDate) recurringEndDate.setHours(0, 0, 0, 0);

        // Check if the current day is outside the recurrence range
        if (checkDate < jobStartDate || (recurringEndDate && checkDate > recurringEndDate)) {
            return false;
        }

        // Check if the day matches the specific pattern
        switch (job.recurring.pattern) {
            case 'daily':
                return true; // Occurs every day within the range
            case 'weekly':
                // Check if it's the same day of the week (0=Sunday, 1=Monday, etc.)
                return checkDate.getDay() === jobStartDate.getDay();
            case 'monthly':
                // Check if it's the same day of the month
                return checkDate.getDate() === jobStartDate.getDate();
            case 'yearly':
                // Check if it's the same day and month
                return checkDate.getDate() === jobStartDate.getMonth() && checkDate.getMonth() === jobStartDate.getMonth();
            default:
                return false;
        }
    }
    // --- 2. Handle Non-Recurring Jobs (Multi-day or One-off) ---
    else {
        const jobEndDate = job.endDate ? new Date(job.endDate) : jobStartDate;
        jobEndDate.setHours(0, 0, 0, 0);
        return checkDate >= jobStartDate && checkDate <= jobEndDate;
    }
};


// This function is now only responsible for calculating the visual position and size of a job
// on a day where it's already been determined to be visible.
export const calculateJobDisplayTimes = (job, START_HOUR_CALENDAR, END_HOUR_CALENDAR, currentDate) => {
    const jobStartDate = new Date(job.date);
    const jobEndDate = job.endDate ? new Date(job.endDate) : jobStartDate;
    const [jobStartHour, jobStartMinute] = job.time ? job.time.split(':').map(Number) : [0, 0];
    const jobDurationMinutes = parseFloat(job.duration || 0);

    const intrinsicStartMinutes = (jobStartHour * 60) + jobStartMinute;
    const intrinsicEndMinutes = intrinsicStartMinutes + jobDurationMinutes;

    let displayStartMinutes;
    let displayEndMinutes;

    // If it's a recurring job, its display is always its simple time and duration.
    if (job.recurring && job.recurring.pattern && job.recurring.pattern !== 'none') {
        displayStartMinutes = intrinsicStartMinutes;
        displayEndMinutes = intrinsicEndMinutes;
    } else {
        // For non-recurring jobs, check if they span across midnight for clipping.
        const startsToday = isSameDay(jobStartDate, currentDate);
        const endsToday = isSameDay(jobEndDate, currentDate);

        displayStartMinutes = startsToday ? intrinsicStartMinutes : START_HOUR_CALENDAR * 60;
        displayEndMinutes = endsToday ? intrinsicEndMinutes : (END_HOUR_CALENDAR + 1) * 60;
    }

    const finalDisplayStart = Math.max(displayStartMinutes, START_HOUR_CALENDAR * 60);
    const finalDisplayEnd = Math.min(displayEndMinutes, (END_HOUR_CALENDAR + 1) * 60);

    const displayDurationMinutes = Math.max(0, finalDisplayEnd - finalDisplayStart);

    const continuesPrev = displayStartMinutes < finalDisplayStart;
    const continuesNext = displayEndMinutes > finalDisplayEnd;

    const customerName = job.customer?.contactPersonName || job.customerName;
    const assignedStaffNames = job.assignedStaff?.map(s => s.contactPersonName) || [];

    return {
        ...job,
        displayStartMinutes: finalDisplayStart,
        displayDurationMinutes: displayDurationMinutes,
        continuesPrev,
        continuesNext,
        customerName: customerName,
        assignedStaffNames: assignedStaffNames,
    };
};


// ===============================================
// CSV EXPORT HELPERS (ADDED settings parameter)
// ===============================================
export const exportCsv = (data, filename = 'export.csv', settings) => {
    const processCell = (cell) => {
        let processed = String(cell == null ? '' : cell);
        if (processed.includes(',') || processed.includes('"') || processed.includes('\n')) {
            processed = `"${processed.replace(/"/g, '""')}"`;
        }
        return processed;
    };

    let csvContent = "";

    data.forEach(row => {
        if (Array.isArray(row)) { // For headers or summary rows (arrays of strings)
            csvContent += row.map(processCell).join(',') + '\n';
        } else if (typeof row === 'object' && row !== null) { // For data rows (objects)
            if (settings && Array.isArray(settings.headers)) {
                csvContent += settings.headers.map(headerKey => {
                    const value = headerKey.split('.').reduce((o, i) => (o ? o[i] : ''), row);
                    return processCell(value);
                }).join(',') + '\n';
            } else {
                const values = Object.values(row).map(processCell);
                csvContent += values.join(',') + '\n';
            }
        } else { // Handle single values, like titles
            csvContent += processCell(row) + '\n';
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// ===============================================
// GEOLOCATION HELPERS
// ===============================================
export const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser. Please use a modern browser.'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (position && position.coords) {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                } else {
                    reject(new Error('Could not obtain valid location data from the device.'));
                }
            },
            (error) => {
                let errorMessage = 'Failed to get current location.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Location access denied. Please enable location permissions for this site in your browser settings.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location information is unavailable. This may be due to poor network conditions or disabled location services on your device.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Failed to get location within the allowed time. Please ensure a stable network connection and that location services are enabled on your device.";
                        break;
                    case error.UNKNOWN_ERROR:
                        errorMessage = "An unknown error occurred while trying to get location. Please try again.";
                        break;
                }
                reject(new Error(errorMessage));
            },
            options
        );
    });
};