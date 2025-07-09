const DailyTimeRecord = require('../models/DailyTimeRecord');
const Staff = require('../models/Staff'); // Needed for authorization checks
const asyncHandler = require('express-async-handler');
const { startOfDay, endOfDay, isSameDay } = require('date-fns'); // For date comparisons

/**
 * @desc    Staff clocks in for the day
 * @route   POST /api/daily-time/clock-in
 * @access  Private (Staff)
 */
const clockInDaily = asyncHandler(async (req, res) => {
    const { staffId } = req.body;
    const companyId = req.user.company;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    // Authorization: Staff can only clock in for themselves
    if (req.user.role === 'staff' && staffId !== requestingUserStaffId) {
        res.status(403);
        throw new Error('Not authorized to clock in for another staff member.');
    }

    const today = startOfDay(new Date()); // Get the start of today for the current timezone

    // Find if there's an existing record for today that hasn't been clocked out yet
    let record = await DailyTimeRecord.findOne({
        staff: staffId,
        company: companyId,
        date: today, // Matches records for the start of today
        isClockedIn: true // Already clocked in
    });

    if (record) {
        // If already clocked in for today
        res.status(400);
        throw new Error('Already clocked in for today.');
    }

    // Find existing record for today (if they clocked out earlier but want to re-clock-in)
    // We'll allow re-clocking in for today if they clocked out previously.
    record = await DailyTimeRecord.findOne({
        staff: staffId,
        company: companyId,
        date: today,
    });

    if (record) {
        // If a record exists for today (they clocked out earlier), update it for a new clock-in
        record.clockInTime = new Date();
        record.clockOutTime = null; // Clear clock-out time if re-clocking in
        record.totalMinutes = 0;
        record.isClockedIn = true;
    } else {
        // Create a new record for today
        record = new DailyTimeRecord({
            staff: staffId,
            company: companyId,
            date: today,
            clockInTime: new Date(),
            isClockedIn: true,
        });
    }

    await record.save();
    res.status(200).json({ message: 'Clocked in successfully!', record });
});

/**
 * @desc    Staff clocks out for the day
 * @route   POST /api/daily-time/clock-out
 * @access  Private (Staff)
 */
const clockOutDaily = asyncHandler(async (req, res) => {
    const { staffId } = req.body;
    const companyId = req.user.company;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    // Authorization: Staff can only clock out for themselves
    if (req.user.role === 'staff' && staffId !== requestingUserStaffId) {
        res.status(403);
        throw new Error('Not authorized to clock out for another staff member.');
    }

    const today = startOfDay(new Date()); // Get the start of today for the current timezone

    // Find the active clock-in record for today
    let record = await DailyTimeRecord.findOne({
        staff: staffId,
        company: companyId,
        date: today,
        isClockedIn: true
    });

    if (!record) {
        // If no active clock-in, check if they already clocked out for the day
        record = await DailyTimeRecord.findOne({
            staff: staffId,
            company: companyId,
            date: today,
        });
        if (record && record.clockOutTime) {
             res.status(400);
             throw new Error('Already clocked out for today.');
        } else {
            // If no record or no clock-in time
            res.status(400);
            throw new Error('Not clocked in yet for today.');
        }
    }
    
    // Ensure clockInTime exists before attempting to calculate duration
    if (!record.clockInTime) {
        res.status(400);
        throw new Error('Clock-in time not recorded. Cannot clock out.');
    }

    record.clockOutTime = new Date();
    record.isClockedIn = false;
    // totalMinutes will be calculated by the pre-save hook

    await record.save();
    res.status(200).json({ message: 'Clocked out successfully!', record });
});

/**
 * @desc    Get a staff member's daily time records (current or specific date range)
 * @route   GET /api/daily-time/:staffId
 * @access  Private (Staff - self, Admin, Manager)
 */
const getDailyTimeRecords = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const companyId = req.user.company;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    // Authorization: Staff can only view their own records
    if (req.user.role === 'staff' && staffId !== requestingUserStaffId) {
        res.status(403);
        throw new Error('Not authorized to view another staff member\'s time records.');
    }

    const { startDate, endDate } = req.query;
    let query = {
        staff: staffId,
        company: companyId
    };

    if (startDate && endDate) {
        // Find records where the 'date' field falls within the given range
        query.date = {
            $gte: startOfDay(new Date(startDate)),
            $lte: endOfDay(new Date(endDate))
        };
    } else {
        // If no date range, default to today's record (or current active clock-in)
        query.date = startOfDay(new Date());
    }

    const records = await DailyTimeRecord.find(query).sort({ date: -1, clockInTime: -1 });

    // If fetching for today and no explicit date range, also check for ongoing clock-in
    // If a record for today exists but is still clocked in, that should be primary.
    if (!startDate && !endDate) {
        const todayRecord = records.find(r => isSameDay(r.date, new Date()));
        if (todayRecord) {
            res.status(200).json(todayRecord); // Return single record for today
        } else {
            res.status(200).json(null); // No record for today
        }
    } else {
        res.status(200).json(records); // Return array of records for date range
    }
});

/**
 * @desc    Get the current clock-in status for a staff member for today
 * @route   GET /api/daily-time/status/:staffId
 * @access  Private (Staff - self, Admin, Manager)
 */
const getCurrentDailyStatus = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const companyId = req.user.company;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    // Authorization: Staff can only view their own status
    if (req.user.role === 'staff' && staffId !== requestingUserStaffId) {
        res.status(403);
        throw new Error('Not authorized to view another staff member\'s daily status.');
    }

    const today = startOfDay(new Date());

    const record = await DailyTimeRecord.findOne({
        staff: staffId,
        company: companyId,
        date: today,
    });

    if (record) {
        res.status(200).json({
            isClockedIn: record.isClockedIn,
            clockInTime: record.clockInTime,
            clockOutTime: record.clockOutTime,
            totalMinutes: record.totalMinutes,
            recordId: record._id,
        });
    } else {
        res.status(200).json({
            isClockedIn: false,
            clockInTime: null,
            clockOutTime: null,
            totalMinutes: 0,
            recordId: null,
        });
    }
});


module.exports = {
    clockInDaily,
    clockOutDaily,
    getDailyTimeRecords,
    getCurrentDailyStatus,
};