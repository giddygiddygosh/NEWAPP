const asyncHandler = require('express-async-handler');
const Staff = require('../models/Staff');
const Job = require('../models/Job');
const DailyTimeRecord = require('../models/DailyTimeRecord');
const Payslip = require('../models/Payslip'); // Import the Payslip model
const Company = require('../models/Company'); // Import Company model for population
const mongoose = require('mongoose'); // Ensure mongoose is imported for .Types.ObjectId
const { startOfDay, endOfDay } = require('date-fns');

/**
 * @desc    Calculate and generate payroll for a given period and staff
 * @route   POST /api/payroll/calculate
 * @access  Private (Admin, Manager)
 */
const calculatePayroll = asyncHandler(async (req, res) => {
    const { startDate, endDate, staffIds = [] } = req.body;
    const companyId = req.user.company; // This is an ObjectId (or string representation)

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Start date and end date are required for payroll calculation.');
    }

    const periodStart = startOfDay(new Date(startDate));
    const periodEnd = endOfDay(new Date(endDate));

    if (periodStart >= periodEnd) {
        res.status(400);
        throw new Error('End date must be after start date.');
    }

    let staffQuery = { company: companyId };
    if (staffIds.length > 0) {
        staffQuery._id = { $in: staffIds };
    }

    const staffMembers = await Staff.find(staffQuery)
        .select('contactPersonName payRateType hourlyRate jobFixedAmount jobPercentage dailyClockInThresholdMins');

    const payrollResults = [];

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        for (const staffMember of staffMembers) {
            let grossPay = 0;
            let earnings = [];
            let deductions = [{ description: 'Tax (Placeholder)', amount: 0 }];
            let payDetailsBreakdown = {};

            const staffName = staffMember.contactPersonName;

            switch (staffMember.payRateType) {
                case 'Hourly':
                    const hourlyTimeRecords = await DailyTimeRecord.find({
                        staff: staffMember._id,
                        company: companyId,
                        date: { $gte: periodStart, $lte: periodEnd },
                        clockInTime: { $ne: null },
                        clockOutTime: { $ne: null }
                    }).session(session);

                    let totalMinutesHourly = hourlyTimeRecords.reduce((sum, record) => sum + (record.totalMinutes || 0), 0);
                    grossPay = (totalMinutesHourly / 60) * (staffMember.hourlyRate || 0); // Convert minutes to hours
                    
                    earnings.push({ description: 'Hourly Wages', amount: parseFloat(grossPay.toFixed(2)) });
                    payDetailsBreakdown = {
                        type: 'Hourly',
                        totalHours: (totalMinutesHourly / 60).toFixed(2),
                        rate: staffMember.hourlyRate,
                        records: hourlyTimeRecords.map(r => ({ date: r.date, minutes: r.totalMinutes }))
                    };
                    break;

                case 'Fixed per Job':
                    const fixedJobs = await Job.find({
                        staff: staffMember._id,
                        company: companyId,
                        status: 'Completed',
                        date: { $gte: periodStart, $lte: periodEnd }
                    }).session(session).select('price');

                    grossPay = fixedJobs.length * (staffMember.jobFixedAmount || 0);
                    earnings.push({ description: 'Fixed Job Payments', amount: parseFloat(grossPay.toFixed(2)) });
                    payDetailsBreakdown = {
                        type: 'Fixed per Job',
                        totalJobs: fixedJobs.length,
                        amountPerJob: staffMember.jobFixedAmount,
                        jobIds: fixedJobs.map(j => j._id)
                    };
                    break;

                case 'Percentage per Job':
                    const percentageJobs = await Job.find({
                        staff: staffMember._id,
                        company: companyId,
                        status: 'Completed',
                        date: { $gte: periodStart,  $lte: periodEnd }
                    }).session(session).select('price');

                    let totalJobValue = percentageJobs.reduce((sum, job) => sum + (job.price || 0), 0);
                    grossPay = totalJobValue * ((staffMember.jobPercentage || 0) / 100);
                    earnings.push({ description: 'Job Commission', amount: parseFloat(grossPay.toFixed(2)) });
                    payDetailsBreakdown = {
                        type: 'Percentage per Job',
                        totalJobValue: totalJobValue.toFixed(2),
                        percentage: staffMember.jobPercentage,
                        jobIds: percentageJobs.map(j => j._id)
                    };
                    break;

                case 'Daily Rate':
                    const dailyRateRecords = await DailyTimeRecord.find({
                        staff: staffMember._id,
                        company: companyId,
                        date: { $gte: periodStart, $lte: periodEnd },
                        clockInTime: { $ne: null },
                        clockOutTime: { $ne: null },
                        totalMinutes: { $gte: (staffMember.dailyClockInThresholdMins || 0) }
                    }).session(session);
                    
                    let totalDaysCount = dailyRateRecords.length;
                    grossPay = totalDaysCount * (staffMember.jobFixedAmount || 0); 
                    earnings.push({ description: 'Daily Rate Pay', amount: parseFloat(grossPay.toFixed(2)) });
                    payDetailsBreakdown = {
                        type: 'Daily Rate',
                        totalDays: totalDaysCount,
                        ratePerDay: staffMember.jobFixedAmount,
                        records: dailyRateRecords.map(r => ({ date: r.date, minutes: r.totalMinutes }))
                    };
                    break;

                default:
                    grossPay = 0; 
                    earnings.push({ description: 'Unconfigured Pay', amount: 0 });
                    payDetailsBreakdown = { type: 'N/A', message: 'Unknown pay rate type or not configured.' };
            }

            if (typeof grossPay !== 'number' || isNaN(grossPay)) {
                grossPay = 0; 
            }
            
            const newPayslip = new Payslip({
                staff: staffMember._id,
                company: companyId,
                payPeriodStart: periodStart,
                payPeriodEnd: periodEnd,
                grossPay: parseFloat(grossPay.toFixed(2)),
                earnings: earnings,
                deductions: deductions, 
                payDetailsBreakdown: payDetailsBreakdown,
                status: 'Generated' 
            });
            await newPayslip.save({ session }); 

            let finalNetPay = newPayslip.netPay;
            if (typeof finalNetPay !== 'number' || isNaN(finalNetPay)) {
                finalNetPay = 0;
            }

            payrollResults.push({
                staffId: staffMember._id,
                staffName: staffName,
                payRateType: staffMember.payRateType,
                grossPay: parseFloat(grossPay.toFixed(2)),
                netPay: parseFloat(finalNetPay.toFixed(2)),
                payslipId: newPayslip._id,
                payDetails: payDetailsBreakdown
            });
        }

        await session.commitTransaction(); 
        session.endSession();

        res.status(200).json(payrollResults);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error calculating and generating payroll:', error);
        res.status(500).json({ message: 'Failed to calculate and generate payroll.', error: error.message });
    }
});

/**
 * @desc    Get a single payslip by ID
 * @route   GET /api/payroll/payslips/:id
 * @access  Private (Admin, Manager, Staff - if owner)
 */
const getPayslipById = asyncHandler(async (req, res) => {
    const payslipId = req.params.id;
    const companyId = req.user.company; 
    const requestingUserRole = req.user.role;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    const payslip = await Payslip.findById(payslipId)
        .populate('staff', 'contactPersonName email')
        .populate('company', 'name')
        .lean();

    if (!payslip) {
        res.status(404);
        throw new Error('Payslip not found.'); 
    }

    const payslipCompanyId = payslip.company && payslip.company._id ? payslip.company._id : payslip.company;
    const userCompanyObjectId = new mongoose.Types.ObjectId(companyId); 

    // --- NEW DEBUG LOGS (around line 205-208 based on previous errors) ---
    console.log(`[PAYSLIP_DEBUG] Fetching Payslip ID: ${payslipId}`);
    console.log(`[PAYSLIP_DEBUG] Payslip object: `, payslip);
    console.log(`[PAYSLIP_DEBUG] Payslip Company field (from DB document): `, payslip.company); // This will show populated obj or raw ID
    console.log(`[PAYSLIP_DEBUG] Derived payslipCompanyId: ${payslipCompanyId.toString()}`);
    console.log(`[PAYSLIP_DEBUG] User's Company ID (from req.user.company): `, companyId); // This is req.user.company, could be ObjectId obj or string
    console.log(`[PAYSLIP_DEBUG] User's Company ID as ObjectId: ${userCompanyObjectId.toString()}`);
    console.log(`[PAYSLIP_DEBUG] Comparison result (payslipCompanyId.equals(userCompanyObjectId)): ${new mongoose.Types.ObjectId(payslipCompanyId).equals(userCompanyObjectId)}`);
    // --- END NEW DEBUG LOGS ---

    if (!new mongoose.Types.ObjectId(payslipCompanyId).equals(userCompanyObjectId)) { 
        res.status(403); 
        throw new Error('Not authorized to view this payslip for your company.');
    }

    if (requestingUserRole === 'staff' && payslip.staff._id.toString() !== requestingUserStaffId) {
        res.status(403);
        throw new Error('Not authorized to view this payslip.');
    }

    res.status(200).json(payslip);
});


module.exports = {
    calculatePayroll,
    getPayslipById,
};