// backend/controllers/dashboardController.js

const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Job = require('../models/Job');
const Staff = require('../models/Staff');
const StockItem = require('../models/StockItem');
const Invoice = require('../models/Invoice');
const DailyTimeRecord = require('../models/DailyTimeRecord');
const { startOfDay, endOfDay } = require('date-fns');
const mongoose = require('mongoose');

/**
 * @desc    Get summary statistics for the admin dashboard
 * @route   GET /api/dashboard/summary-stats
 * @access  Private (Admin, Manager)
 */
const getSummaryStats = asyncHandler(async (req, res) => {
    const companyId = req.user.company;

    const [
        totalCustomers,
        totalLeads,
        totalCompletedJobs,
        totalRevenueResult,
        lowStockItemsResult // Changed name to reflect it's an aggregation result
    ] = await Promise.all([
        Customer.countDocuments({ company: companyId }),
        Lead.countDocuments({ company: companyId }),
        Job.countDocuments({ company: companyId, status: 'Completed' }),
        Invoice.aggregate([
            { $match: { company: new mongoose.Types.ObjectId(companyId), status: { $in: ['Paid', 'Completed'] } } }, // Ensure companyId is ObjectId here too
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        // CORRECTED: Use aggregation to count low stock items
        StockItem.aggregate([
            { $match: { company: new mongoose.Types.ObjectId(companyId) } }, // Match by companyId first
            {
                $match: {
                    $expr: { $lt: ['$stockQuantity', '$reorderLevel'] } // Use $expr for field-to-field comparison
                }
            },
            { $count: 'lowStockCount' } // Count the matched documents
        ])
    ]);

    res.status(200).json({
        totalCustomers: totalCustomers || 0,
        totalLeads: totalLeads || 0,
        totalRevenue: totalRevenueResult[0] ? totalRevenueResult[0].total : 0,
        totalCompletedJobs: totalCompletedJobs || 0,
        // Extract the count from the aggregation result for low stock items
        lowStockItemsCount: lowStockItemsResult[0] ? lowStockItemsResult[0].lowStockCount : 0,
    });
});

/**
 * @desc    Get jobs overview for a specific date (e.g., today's bookings)
 * @route   GET /api/dashboard/jobs-overview
 * @access  Private (Admin, Manager)
 */
const getJobsOverview = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const { date } = req.query; // Date for "jobs today" (e.g., YYYY-MM-DD)

    if (!date) {
        res.status(400);
        throw new Error('Date parameter is required for jobs overview.');
    }

    const todayStart = startOfDay(new Date(date));
    const todayEnd = endOfDay(new Date(date));
    const tomorrowStart = startOfDay(new Date());
    tomorrowStart.setDate(tomorrowStart.getDate() + 1); // Set to start of tomorrow

    // Fetch jobs for the specified date
    const jobsToday = await Job.find({
        company: companyId,
        date: { $gte: todayStart, $lte: todayEnd },
        status: { $nin: ['Cancelled'] } // Exclude cancelled jobs
    })
    .populate('customer', 'contactPersonName') // Populate customer name
    .select('customer serviceType time status address.street address.city') // Select necessary fields
    .sort('time')
    .lean();

    // Fetch count of upcoming jobs (scheduled for after 'today')
    const upcomingJobsCount = await Job.countDocuments({
        company: companyId,
        date: { $gt: todayEnd }, // Jobs after the end of today
        status: { $in: ['Scheduled', 'In Progress', 'Pending Completion'] } // Consider appropriate upcoming statuses
    });

    res.status(200).json({
        totalJobsToday: jobsToday.length,
        jobsToday: jobsToday.map(job => ({
            id: job._id,
            customerName: job.customer?.contactPersonName || 'N/A',
            type: job.serviceType,
            time: job.time,
            status: job.status,
            address: {
                street: job.address?.street,
                city: job.address?.city
            }
        })),
        upcomingJobsCount: upcomingJobsCount
    });
});

/**
 * @desc    Get job counts grouped by status
 * @route   GET /api/dashboard/jobs-by-status
 * @access  Private (Admin, Manager)
 */
const getJobsByStatus = asyncHandler(async (req, res) => {
    const companyId = req.user.company;

    const jobStatusCounts = await Job.aggregate([
        { $match: { company: new mongoose.Types.ObjectId(companyId) } }, // Ensure companyId is ObjectId
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } }
    ]);

    // Format into a more usable object { "StatusName": Count }
    const formattedCounts = jobStatusCounts.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
    }, {});

    res.status(200).json(formattedCounts);
});

/**
 * @desc    Get summary of staff availability
 * @route   GET /api/dashboard/staff-availability
 * @access  Private (Admin, Manager)
 */
const getStaffAvailability = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const allStaff = await Staff.find({ company: companyId }).lean();
    const staffIds = allStaff.map(s => s._id);

    const dailyTimeRecords = await DailyTimeRecord.find({
        company: companyId,
        staff: { $in: staffIds },
        date: { $gte: todayStart, $lte: todayEnd }
    }).lean();

    const currentJobs = await Job.find({
        company: companyId,
        staff: { $in: staffIds },
        status: { $in: ['In Progress', 'Scheduled'] },
        date: { $gte: todayStart, $lte: todayEnd }
    }).lean();

    const currentAbsences = await Staff.aggregate([
        { $match: { company: new mongoose.Types.ObjectId(companyId), _id: { $in: staffIds.map(id => new mongoose.Types.ObjectId(id)) } } }, // Ensure IDs are ObjectIds
        { $unwind: '$unavailabilityPeriods' },
        {
            $match: {
                'unavailabilityPeriods.status': 'Approved',
                'unavailabilityPeriods.start': { $lte: now },
                'unavailabilityPeriods.end': { $gte: now }
            }
        },
        { $group: { _id: '$_id', staffName: { $first: '$contactPersonName' } } }
    ]);
    const absentStaffIds = currentAbsences.map(a => a._id.toString());

    const availability = {
        'On Duty (Clocked In)': 0,
        'On Job (Not Clocked In)': 0,
        'On Leave': 0,
        'Off Duty': 0
    };

    const staffClockInStatus = {};

    dailyTimeRecords.forEach(record => {
        staffClockInStatus[record.staff.toString()] = {
            isClockedIn: !!record.clockInTime && !record.clockOutTime,
            isClockedOut: !!record.clockOutTime
        };
    });

    allStaff.forEach(staff => {
        const staffIdStr = staff._id.toString();
        const clockedStatus = staffClockInStatus[staffIdStr];
        const isOnLeave = absentStaffIds.includes(staffIdStr);
        const hasJobToday = currentJobs.some(job => job.staff.some(sId => sId.equals(staff._id)));

        if (isOnLeave) {
            availability['On Leave']++;
        } else if (clockedStatus && clockedStatus.isClockedIn) {
            availability['On Duty (Clocked In)']++;
        } else if (hasJobToday && (!clockedStatus || clockedStatus.isClockOut)) {
            availability['On Job (Not Clocked In)']++;
        } else {
            availability['Off Duty']++;
        }
    });

    res.status(200).json(availability);
});


/**
 * @desc    Get recent activities (latest jobs, invoices, leads)
 * @route   GET /api/dashboard/recent-activity
 * @access  Private (Admin, Manager)
 */
const getRecentActivity = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const limit = 5; // Number of recent items to fetch for each category

    const [
        latestJobs,
        latestInvoices,
        newLeads
    ] = await Promise.all([
        Job.find({ company: companyId })
            .populate('customer', 'contactPersonName')
            .select('serviceType customer date')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(),
        Invoice.find({ company: companyId })
            .populate('customer', 'contactPersonName')
            .select('invoiceNumber totalAmount customer')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(),
        Lead.find({ company: companyId })
            .select('contactPersonName leadSource')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
    ]);

    res.status(200).json({
        jobs: latestJobs.map(job => ({
            id: job._id,
            type: job.serviceType,
            customer: job.customer?.contactPersonName || 'N/A',
            date: job.date
        })),
        invoices: latestInvoices.map(invoice => ({
            id: invoice._id,
            number: invoice.invoiceNumber,
            amount: invoice.totalAmount,
            customer: invoice.customer?.contactPersonName || 'N/A'
        })),
        leads: newLeads.map(lead => ({
            id: lead._id,
            name: lead.contactPersonName,
            source: lead.leadSource
        }))
    });
});

module.exports = {
    getSummaryStats,
    getJobsOverview,
    getJobsByStatus,
    getStaffAvailability,
    getRecentActivity,
};