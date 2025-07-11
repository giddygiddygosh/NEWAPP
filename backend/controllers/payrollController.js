const asyncHandler = require('express-async-handler');
const Staff = require('../models/Staff');
const Job = require('../models/Job');
const DailyTimeRecord = require('../models/DailyTimeRecord');
const Payslip = require('../models/Payslip');
const Company = require('../models/Company');
const mongoose = require('mongoose');
const { startOfDay, endOfDay, format } = require('date-fns');
const pdf = require('html-pdf');
const archiver = require('archiver');

/**
 * Helper function to render payslip data to HTML
 * This mimics the structure from PayslipViewModal for consistency
 */
const renderPayslipHtml = (payslip) => {
    // Ensure data is robust
    const staffName = payslip.staff?.contactPersonName || 'N/A';
    const staffEmail = payslip.staff?.email || 'N/A';
    const companyName = payslip.company?.name || 'N/A';
    const periodStartFormatted = format(new Date(payslip.payPeriodStart), 'dd/MM/yyyy');
    const periodEndFormatted = format(new Date(payslip.payPeriodEnd), 'dd/MM/yyyy');

    // Use payslip.grossPay, payslip.netPay, payslip.totalDeductions directly from the saved document
    const grossPayFormatted = (parseFloat(payslip.grossPay) || 0).toFixed(2);
    const netPayFormatted = (parseFloat(payslip.netPay) || 0).toFixed(2);
    const totalDeductionsFormatted = (parseFloat(payslip.totalDeductions) || 0).toFixed(2);

    const earningsHtml = payslip.earnings && payslip.earnings.length > 0
        ? payslip.earnings.map((e, idx) => `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                <span>${e.description}</span>
                <span style="font-weight: bold;">£${(parseFloat(e.amount) || 0).toFixed(2)}</span>
            </li>`).join('')
        : `<p style="font-size: 12px; color: #6b7280;">No earnings recorded.</p>`;

    const deductionsHtml = payslip.deductions && payslip.deductions.length > 0
        ? payslip.deductions.map((d, idx) => `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                <span>${d.description}</span>
                <span style="font-weight: bold;">-£${(parseFloat(d.amount) || 0).toFixed(2)}</span>
            </li>`).join('')
        : `<p style="font-size: 12px; color: #6b7280;">No deductions recorded.</p>`;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Payslip - ${staffName}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 20px; color: #333; }
            .container { width: 100%; max-width: 800px; margin: 0 auto; border: 1px solid #eee; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
            .header { text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { color: #0056b3; margin: 0; font-size: 28px; }
            .section { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
            .section-header { background-color: #f8f8f8; padding: 10px 15px; font-weight: bold; font-size: 16px; border-bottom: 1px solid #ddd; display: flex; align-items: center; }
            .section-content { padding: 15px; }
            .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px; }
            .details-grid p { margin: 0; }
            .details-grid .label { font-weight: bold; }
            ul { list-style: none; padding: 0; margin: 0; }
            li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #eee; }
            li:last-child { border-bottom: none; }
            .summary-item { display: flex; justify-content: space-between; align-items: center; font-weight: bold; padding: 10px 0; font-size: 15px; border-top: 1px solid #ccc; margin-top: 10px; }
            .net-pay { text-align: right; margin-top: 30px; font-size: 24px; font-weight: bold; color: #28a745; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Payslip</h1>
                <p>For pay period: ${periodStartFormatted} - ${periodEndFormatted}</p>
            </div>

            <div class="section">
                <div class="section-header">Employee & Company Details</div>
                <div class="section-content details-grid">
                    <div>
                        <p><span class="label">Employee:</span> ${staffName}</p>
                        <p><span class="label">Email:</span> ${staffEmail}</p>
                    </div>
                    <div>
                        <p><span class="label">Company:</span> ${companyName}</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-header">Earnings</div>
                <div class="section-content">
                    <ul>
                        ${earningsHtml}
                        <li class="summary-item" style="border-top: 2px solid #000; margin-top: 15px; padding-top: 15px;">
                            <span>Gross Pay:</span>
                            <span>£${grossPayFormatted}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="section">
                <div class="section-header">Deductions</div>
                <div class="section-content">
                    <ul>
                        ${deductionsHtml}
                        <li class="summary-item" style="border-top: 2px solid #000; margin-top: 15px; padding-top: 15px; color: #dc3545;">
                            <span>Total Deductions:</span>
                            <span>-£${totalDeductionsFormatted}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="net-pay">
                Net Pay: £${netPayFormatted}
            </div>

            <p style="text-align: center; margin-top: 40px; font-size: 12px; color: #6c757d;">
                This is an automatically generated payslip.
            </p>
        </div>
    </body>
    </html>
    `;
};


/**
 * Helper function to generate the Accountant Summary Report HTML.
 * It takes aggregated report data and formats it into a printable HTML document.
 */
const renderAccountantReportHtml = (reportData) => {
    // Ensure default values if reportData or its sub-objects are not fully populated
    const safeReportData = reportData || {};
    const overallTotals = safeReportData.overallTotals || { totalGrossPay: 0, totalDeductions: 0, totalNetPay: 0 };
    const staffBreakdown = safeReportData.staffSummaries || []; // Changed from staffBreakdown to staffSummaries
    const totalEarningsBreakdown = safeReportData.totalEarningsBreakdown || [];
    const totalDeductionsBreakdown = safeReportData.totalDeductionsBreakdown || [];

    const periodStartFormatted = format(safeReportData.periodStart || new Date(), 'dd/MM/yyyy');
    const periodEndFormatted = format(safeReportData.periodEnd || new Date(), 'dd/MM/yyyy');
    const companyName = safeReportData.companyName || 'Your Company';

    // Sort staff summaries by name
    const sortedStaffSummaries = [...staffBreakdown].sort((a, b) => (a.staffName || '').localeCompare(b.staffName || '')); // Added null/undefined check

    const staffRowsHtml = sortedStaffSummaries.length > 0 ? sortedStaffSummaries.map(staff => `
        <tr>
            <td>${staff.staffName}</td>
            <td style="text-align: right;">£${(staff.grossPay || 0).toFixed(2)}</td>
            <td style="text-align: right;">-£${(staff.totalDeductions || 0).toFixed(2)}</td>
            <td style="text-align: right;">£${(staff.netPay || 0).toFixed(2)}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align: center;">No staff data found for this period.</td></tr>`;

    // Aggregate earnings by description across all payslips
    const aggregatedEarnings = totalEarningsBreakdown.reduce((acc, earning) => {
        const existing = acc.find(item => item.description === earning.description);
        if (existing) {
            existing.amount += earning.amount;
        } else {
            acc.push({ description: earning.description, amount: earning.amount });
        }
        return acc;
    }, []).sort((a, b) => a.description.localeCompare(b.description)); // Sort for consistent order

    // Aggregate deductions by description across all payslips
    const aggregatedDeductions = totalDeductionsBreakdown.reduce((acc, deduction) => {
        const existing = acc.find(item => item.description === deduction.description);
        if (existing) {
            existing.amount += deduction.amount;
        } else {
            acc.push({ description: deduction.description, amount: deduction.amount });
        }
        return acc;
    }, []).sort((a, b) => a.description.localeCompare(b.description)); // Sort for consistent order


    const earningsBreakdownRows = aggregatedEarnings.map(e => `
        <tr>
            <td>${e.description}</td>
            <td style="text-align: right;">£${(e.amount || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    const deductionsBreakdownRows = aggregatedDeductions.map(d => `
        <tr>
            <td>${d.description}</td>
            <td style="text-align: right;">-£${(d.amount || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Payroll Summary Report</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 20px; color: #333; font-size: 14px; }
            .container { width: 100%; max-width: 900px; margin: 0 auto; border: 1px solid #eee; padding: 25px; box-shadow: 0 0 15px rgba(0,0,0,0.07); }
            .header { text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { color: #0056b3; margin: 0; font-size: 32px; }
            .header p { margin: 5px 0 0; font-size: 16px; color: #555; }
            .report-info { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 14px;}
            .section { margin-bottom: 30px; }
            .section h2 { background-color: #f0f8ff; color: #0056b3; padding: 12px 15px; margin: 0 0 15px; border-left: 5px solid #0056b3; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .total-row { background-color: #e6f7ff; font-weight: bold; }
            .text-right { text-align: right; }
            .text-green { color: #28a745; font-weight: bold; }
            .text-red { color: #dc3545; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Payroll Summary Report</h1>
            </div>
            <div class="period-info">
                For Pay Period: ${periodStartFormatted} - ${periodEndFormatted}
            </div>

            <h2>Overall Totals</h2>
            <table>
                <tr class="total-row">
                    <th>Total Gross Pay</th>
                    <th>Total Deductions</th>
                    <th>Total Net Pay</th>
                </tr>
                <tr>
                    <td class="text-green">£${(overallTotals.totalGrossPay || 0).toFixed(2)}</td>
                    <td class="text-red">-£${(overallTotals.totalDeductions || 0).toFixed(2)}</td>
                    <td class="text-green">£${(overallTotals.totalNetPay || 0).toFixed(2)}</td>
                </tr>
            </table>

            <h2>Breakdown by Employee</h2>
            <table>
                <thead>
                    <tr>
                        <th>Employee Name</th>
                        <th>Gross Pay</th>
                        <th>Total Deductions</th>
                        <th>Net Pay</th>
                    </tr>
                </thead>
                <tbody>
                    ${staffRowsHtml}
                </tbody>
            </table>

            <h2>Total Earnings Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${earningsBreakdownRows}
                </tbody>
            </table>

            <h2>Total Deductions Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${deductionsBreakdownRows}
                </tbody>
            </table>

            <div class="footer">
                Generated by ServiceOS on ${format(new Date(), 'dd/MM/yyyy HH:mm')}
            </div>
        </div>
    </body>
    </html>
    `;
};

/**
 * @desc    Calculate and generate payroll for a given period and staff
 * @route   POST /api/payroll/calculate
 * @access  Private (Admin, Manager)
 */
const calculatePayroll = asyncHandler(async (req, res) => {
    const { startDate, endDate, staffIds = [] } = req.body;
    const companyId = req.user.company;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Start date and end date are required for payroll calculation.');
    }

    // --- FIX FOR DUPLICATES & TIMEZONE CONSISTENCY ---
    // Ensure periodStart and periodEnd are consistently UTC at start/end of day
    const periodStart = startOfDay(new Date(startDate));
    periodStart.setUTCHours(0, 0, 0, 0); // Force UTC midnight
    const periodEnd = endOfDay(new Date(endDate));
    periodEnd.setUTCHours(23, 59, 59, 999); // Force UTC end of day
    // --- END FIX ---

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
            let deductions = [{ description: 'Tax (Placeholder)', amount: 0 }]; // Initialize with placeholder
            let payDetailsBreakdown = {};

            const staffName = staffMember.contactPersonName;

            // --- FIND OR CREATE PAYSLIP ---
            let existingPayslip = await Payslip.findOne({
                staff: staffMember._id,
                company: companyId,
                payPeriodStart: periodStart, // Use the standardized UTC dates for lookup
                payPeriodEnd: periodEnd     // Use the standardized UTC dates for lookup
            }).session(session);

            let payslipToSave = existingPayslip;

            switch (staffMember.payRateType) {
                case 'Hourly':
                    const hourlyTimeRecords = await DailyTimeRecord.find({
                        staff: staffMember._id,
                        company: companyId,
                        date: { $gte: periodStart, $lte: periodEnd }, // Use standardized dates
                        clockInTime: { $ne: null },
                        clockOutTime: { $ne: null }
                    }).session(session);

                    let totalMinutesHourly = hourlyTimeRecords.reduce((sum, record) => sum + (record.totalMinutes || 0), 0);
                    grossPay = (totalMinutesHourly / 60) * (staffMember.hourlyRate || 0);

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
                        date: { $gte: periodStart, $lte: periodEnd } // Use standardized dates
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
                        date: { $gte: periodStart, $lte: periodEnd } // Use standardized dates
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
                        date: { $gte: periodStart, $lte: periodEnd }, // Use standardized dates
                        clockInTime: { $ne: null },
                        clockOutTime: { $ne: null },
                        totalMinutes: { $gte: (staffMember.dailyClockInThresholdMins || 0) }
                    }).session(session);

                    let totalDaysCount = dailyRateRecords.length;
                    grossPay = totalDaysCount * (staffMember.jobFixedAmount || 0); // Assuming jobFixedAmount is used for daily rate
                    earnings.push({ description: 'Daily Rate Pay', amount: parseFloat(grossPay.toFixed(2)) });
                    payDetailsBreakdown = {
                        type: 'Daily Rate',
                        totalDays: totalDaysCount,
                        ratePerDay: staffMember.jobFixedAmount, // Assuming jobFixedAmount is used for daily rate
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

            // Calculate total deductions and net pay based on collected earnings and deductions
            const totalDeductionsCalculated = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
            const netPayCalculated = grossPay - totalDeductionsCalculated;


            if (payslipToSave) {
                // Update existing payslip
                payslipToSave.grossPay = parseFloat(grossPay.toFixed(2));
                payslipToSave.earnings = earnings;
                payslipToSave.deductions = deductions;
                payslipToSave.payDetailsBreakdown = payDetailsBreakdown;
                payslipToSave.status = 'Generated'; // Or 'Updated'
                payslipToSave.totalDeductions = parseFloat(totalDeductionsCalculated.toFixed(2)); // Explicitly set
                payslipToSave.netPay = parseFloat(netPayCalculated.toFixed(2));             // Explicitly set
                await payslipToSave.save({ session });
            } else {
                // Create new payslip if none found
                payslipToSave = new Payslip({
                    staff: staffMember._id,
                    company: companyId,
                    payPeriodStart: periodStart,
                    payPeriodEnd: periodEnd,
                    grossPay: parseFloat(grossPay.toFixed(2)),
                    earnings: earnings,
                    deductions: deductions,
                    totalDeductions: parseFloat(totalDeductionsCalculated.toFixed(2)), // Explicitly set
                    netPay: parseFloat(netPayCalculated.toFixed(2)),             // Explicitly set
                    payDetailsBreakdown: payDetailsBreakdown,
                    status: 'Generated'
                });
                await payslipToSave.save({ session });
            }
            // --- END FIND OR CREATE PAYSLIP ---

            // The netPay value here should now be accurate from the saved document
            payrollResults.push({
                staffId: staffMember._id,
                staffName: staffName,
                payRateType: staffMember.payRateType,
                grossPay: parseFloat(grossPay.toFixed(2)),
                netPay: parseFloat(payslipToSave.netPay.toFixed(2)), // Use the netPay from the saved document
                payslipId: payslipToSave._id, // Use the ID of the saved/updated document
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
 * @desc    Download a single payslip as PDF
 * @route   GET /api/payroll/payslips/download/:id
 * @access  Private (Admin, Manager, Staff - if owner)
 */
const downloadPayslip = asyncHandler(async (req, res) => {
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

    if (!new mongoose.Types.ObjectId(payslipCompanyId).equals(userCompanyObjectId)) {
        res.status(403);
        throw new Error('Not authorized to view this payslip for your company.');
    }

    if (requestingUserRole === 'staff' && payslip.staff._id.toString() !== requestingUserStaffId) {
        res.status(403);
        throw new Error('Not authorized to view this payslip.');
    }

    // Generate HTML for the payslip
    const htmlContent = renderPayslipHtml(payslip);

    // PDF options
    const options = {
        format: 'A4',
        orientation: 'portrait',
        border: '10mm',
        header: {
            height: '15mm',
            contents: `<div style="text-align: center; font-size: 10px; color: #666;">ServiceOS Payslip - ${payslip.staff?.contactPersonName || 'N/A'}</div>`
        },
        footer: {
            height: '10mm',
            contents: '<div style="text-align: center; font-size: 9px; color: #666;">Page {{page}} of {{pages}}</div>'
        }
    };

    // Create PDF
    pdf.create(htmlContent, options).toBuffer(async (err, buffer) => {
        if (err) {
            console.error('Error generating PDF:', err);
            return res.status(500).json({ message: 'Failed to generate PDF payslip.' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=payslip-${payslip.staff?.contactPersonName.replace(/\s+/g, '-') || 'unknown'}-${format(new Date(payslip.payPeriodStart), 'yyyyMMdd')}.pdf`);
        res.send(buffer);
    });
});

/**
 * @desc    Generate aggregated payroll report data (not a PDF)
 * @access  Private (Admin, Manager)
 * This function is designed to be called internally by other controllers
 * or via an API endpoint.
 */
const generateAccountantReportData = asyncHandler(async (periodStart, periodEnd, companyId, staffIds) => { // This function now takes params directly
    // --- START DEBUG LOGS ---
    console.log('[REPORT_DEBUG] Received periodStart:', periodStart.toISOString());
    console.log('[REPORT_DEBUG] Received periodEnd:', periodEnd.toISOString());
    console.log('[REPORT_DEBUG] Received companyId:', companyId.toString());
    console.log('[REPORT_DEBUG] Received staffIds:', staffIds);
    // --- END DEBUG LOGS ---

    let matchQuery = {
        company: new mongoose.Types.ObjectId(companyId),
        payPeriodStart: { $gte: periodStart },
        payPeriodEnd: { $lte: periodEnd }
    };

    if (staffIds && staffIds.length > 0) { // Check if staffIds is present and not empty
        const staffIdsArray = Array.isArray(staffIds) ? staffIds : staffIds.split(','); // Handle comma-separated string from URL
        matchQuery.staff = { $in: staffIdsArray.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // --- START DEBUG LOGS ---
    console.log('[REPORT_DEBUG] Final Mongoose Match Query:', JSON.stringify(matchQuery, null, 2));
    // --- END DEBUG LOGS ---

    const reportData = await Payslip.aggregate([
        { $match: matchQuery },
        {
            $lookup: {
                from: 'staffs', // Collection name for Staff model (often pluralized lowercase)
                localField: 'staff',
                foreignField: '_id',
                as: 'staffDetails'
            }
        },
        { $unwind: { path: '$staffDetails', preserveNullAndEmptyArrays: true } },

        // Group by staff to get individual summaries for 'Breakdown by Employee'
        {
            $group: {
                _id: '$staff', // Group by staff member ID
                staffName: { $first: '$staffDetails.contactPersonName' },
                totalGrossPayStaff: { $sum: '$grossPay' },
                totalDeductionsStaff: { $sum: '$totalDeductions' }, // Use totalDeductions
                totalNetPayStaff: { $sum: '$netPay' },             // Use netPay
                allEarnings: { $push: '$earnings' }, // Push all earnings arrays
                allDeductions: { $push: '$deductions' } // Push all deductions arrays
            }
        },
        {
            $project: {
                _id: 0,
                staffId: '$_id',
                staffName: 1,
                grossPay: '$totalGrossPayStaff',
                totalDeductions: '$totalDeductionsStaff',
                netPay: '$totalNetPayStaff',
                // Flatten and sum earnings by description
                totalEarningsBreakdown: {
                    $reduce: {
                        input: '$allEarnings',
                        initialValue: [],
                        in: {
                            $let: {
                                vars: {
                                    mergedArray: { $concatArrays: ['$$value', '$$this'] }
                                },
                                in: {
                                    $map: {
                                        input: { $setUnion: '$$mergedArray.description' },
                                        as: 'desc',
                                        in: {
                                            description: '$$desc',
                                            amount: {
                                                $sum: {
                                                    $map: {
                                                        input: {
                                                            $filter: {
                                                                input: '$$mergedArray',
                                                                as: 'item',
                                                                cond: { $eq: ['$$item.description', '$$desc'] }
                                                            }
                                                        },
                                                        as: 'filteredItem',
                                                        in: '$$filteredItem.amount'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                // Flatten and sum deductions by description
                totalDeductionsBreakdown: {
                    $reduce: {
                        input: '$allDeductionsTypes', // This might be a typo, should probably be '$allDeductions'
                        initialValue: [],
                        in: {
                            $let: {
                                vars: {
                                    mergedArray: { $concatArrays: ['$$value', '$$this'] }
                                },
                                in: {
                                    $map: {
                                        input: { $setUnion: '$$mergedArray.description' },
                                        as: 'desc',
                                        in: {
                                            description: '$$desc',
                                            amount: {
                                                $sum: {
                                                    $map: {
                                                        input: {
                                                            $filter: {
                                                                input: '$$mergedArray',
                                                                as: 'item',
                                                                cond: { $eq: ['$$item.description', '$$desc'] }
                                                            }
                                                        },
                                                        as: 'filteredItem',
                                                        in: '$$filteredItem.amount'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        // Group one last time to get overall totals and format nested arrays
        {
            $group: {
                _id: null, // Group all into one document
                totalGrossPay: { $sum: '$grossPay' },
                totalDeductions: { $sum: '$totalDeductions' },
                totalNetPay: { $sum: '$netPay' },
                staffSummaries: {
                    $push: {
                        staffName: '$staffName',
                        grossPay: '$grossPay',
                        totalDeductions: '$totalDeductions',
                        netPay: '$netPay'
                    }
                },
                allEarningsTypes: { $push: '$totalEarningsBreakdown' },
                allDeductionsTypes: { $push: '$totalDeductionsBreakdown' }
            }
        },
        {
            $project: {
                _id: 0,
                totalGrossPay: 1,
                totalDeductions: 1,
                totalNetPay: 1,
                staffSummaries: 1,
                // Resummarize earnings by type across all staff
                totalEarningsBreakdown: {
                    $reduce: {
                        input: '$allEarningsTypes',
                        initialValue: [],
                        in: {
                            $let: {
                                vars: {
                                    mergedArray: { $concatArrays: ['$$value', '$$this'] }
                                },
                                in: {
                                    $map: {
                                        input: { $setUnion: '$$mergedArray.description' },
                                        as: 'desc',
                                        in: {
                                            description: '$$desc',
                                            amount: {
                                                $sum: {
                                                    $map: {
                                                        input: {
                                                            $filter: {
                                                                input: '$$mergedArray',
                                                                as: 'item',
                                                                cond: { $eq: ['$$item.description', '$$desc'] }
                                                            }
                                                        },
                                                        as: 'filteredItem',
                                                        in: '$$filteredItem.amount'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                // Resummarize deductions by type across all staff
                totalDeductionsBreakdown: {
                    $reduce: {
                        input: '$allDeductionsTypes',
                        initialValue: [],
                        in: {
                            $let: {
                                vars: {
                                    mergedArray: { $concatArrays: ['$$value', '$$this'] }
                                },
                                in: {
                                    $map: {
                                        input: { $setUnion: '$$mergedArray.description' },
                                        as: 'desc',
                                        in: {
                                            description: '$$desc',
                                            amount: {
                                                $sum: {
                                                    $map: {
                                                        input: {
                                                            $filter: {
                                                                input: '$$mergedArray',
                                                                as: 'item',
                                                                cond: { $eq: ['$$item.description', '$$desc'] }
                                                            }
                                                        },
                                                        as: 'filteredItem',
                                                        in: '$$filteredItem.amount'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    ]);

    // Handle case where no payslips are found, aggregation returns empty array
    // Or if the aggregation produced no _id:null final result (e.g. no documents matched initial query)
    if (reportData.length === 0 || !reportData[0]) {
        console.log('[REPORT_DEBUG] No aggregated report data found for the given criteria. Returning zeroed report.');
        return {
            companyName: (await Company.findById(companyId).lean())?.name || 'N/A',
            periodStart: periodStart,
            periodEnd: periodEnd,
            overallTotals: {
                totalGrossPay: 0,
                totalDeductions: 0,
                totalNetPay: 0
            },
            staffSummaries: [], // Changed from staffBreakdown
            totalEarningsBreakdown: [],
            totalDeductionsBreakdown: []
        };
    }

    const finalReport = reportData[0];
    finalReport.companyName = (await Company.findById(companyId).lean())?.name || 'N/A'; // Add company name
    finalReport.periodStart = periodStart; // Add period dates to reportData
    finalReport.periodEnd = periodEnd;    // Add period dates to reportData

    // --- START DEBUG LOGS ---
    console.log('[REPORT_DEBUG] Final Report Data being sent to HTML renderer:', JSON.stringify(finalReport, null, 2));
    // --- END DEBUG LOGS ---

    return finalReport;
});


/**
 * @desc    Download multiple payslips as a ZIP archive, including an Accountant Report PDF
 * @route   GET /api/payroll/payslips/bulk-download
 * @access  Private (Admin, Manager)
 */
const downloadPayslipsBulk = asyncHandler(async (req, res) => {
    const { startDate, endDate, staffIds = '' } = req.query; // Use query params for GET request, default to empty string

    const companyId = req.user.company;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Start date and end date are required for bulk payslip download.');
    }

    // --- FIX FOR TIMEZONE CONSISTENCY IN QUERYING ---
    const periodStart = startOfDay(new Date(startDate));
    periodStart.setUTCHours(0, 0, 0, 0); // Force UTC midnight
    const periodEnd = endOfDay(new Date(endDate));
    periodEnd.setUTCHours(23, 59, 59, 999); // Force UTC end of day
    // --- END FIX ---

    let payslipQuery = {
        company: companyId,
        payPeriodStart: { $gte: periodStart },
        payPeriodEnd: { $lte: periodEnd }
    };

    let parsedStaffIds = [];
    if (staffIds) { // Only parse if staffIds string is not empty
        parsedStaffIds = staffIds.split(',').map(id => new mongoose.Types.ObjectId(id));
        payslipQuery.staff = { $in: parsedStaffIds };
    }


    const payslipsToDownload = await Payslip.find(payslipQuery)
        .populate('staff', 'contactPersonName email')
        .populate('company', 'name')
        .lean();

    if (payslipsToDownload.length === 0) {
        // If no payslips are found, still generate a report with zero data
        // but return a 200 OK with an empty zip or a report indicating no payslips
        // For bulk download, returning an empty ZIP is more user-friendly than a 404,
        // and we still include the accountant report even if no payslips.
    }

    // Set headers for ZIP file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=payslips_bulk-${format(periodStart, 'yyyyMMdd')}_to_${format(periodEnd, 'yyyyMMdd')}.zip`);

    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets compression level
    });

    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
            console.warn('Archiver warning:', err);
        } else {
            console.error('Archiver warning:', err);
        }
    });

    archive.on('error', function(err) {
        console.error('Archiver error:', err);
        if (!res.headersSent) {
             res.status(500).json({ message: 'Failed to create zip archive due to an internal error.' });
        }
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // --- Generate Accountant Report PDF and add to archive ---
    // Use the standardized UTC dates here too
    const accountantReportData = await generateAccountantReportData(periodStart, periodEnd, companyId, parsedStaffIds); // Pass parsed staff IDs
    const accountantReportHtml = renderAccountantReportHtml(accountantReportData);
    const accountantReportPdfOptions = { format: 'A4', orientation: 'portrait', border: '10mm' };

    try {
        const accountantReportPdfBuffer = await new Promise((resolve, reject) => {
            pdf.create(accountantReportHtml, accountantReportPdfOptions).toBuffer((err, buffer) => {
                if (err) {
                    console.error('Error generating Accountant Report PDF for bulk:', err);
                    reject(new Error('Failed to generate Accountant Report PDF.'));
                } else {
                    resolve(buffer);
                }
            });
        });
        archive.append(accountantReportPdfBuffer, { name: `Payroll_Summary_Report_${format(periodStart, 'yyyyMMdd')}_to_${format(periodEnd, 'yyyyMMdd')}.pdf` });
    } catch (pdfError) {
        console.error("Critical: Could not generate Accountant Report PDF for bulk download. This report will be missing from the ZIP.", pdfError);
        // Do NOT re-throw or `res.status` here, as headers might have been sent or we want to continue with payslips.
    }
    // --- END NEW ---

    // Append individual payslip PDFs
    for (const payslip of payslipsToDownload) {
        const htmlContent = renderPayslipHtml(payslip);
        const pdfOptions = {
            format: 'A4',
            orientation: 'portrait',
            border: '10mm'
        };

        try {
            const pdfBuffer = await new Promise((resolve, reject) => {
                pdf.create(htmlContent, pdfOptions).toBuffer((err, buffer) => {
                    if (err) {
                        console.error('Error generating single PDF for bulk:', err);
                        reject(new Error('Failed to generate PDF for a payslip.'));
                    } else {
                        resolve(buffer);
                    }
                });
            });
            archive.append(pdfBuffer, { name: `payslip-${payslip.staff?.contactPersonName.replace(/\s+/g, '-') || 'unknown'}-${format(new Date(payslip.payPeriodStart), 'yyyyMMdd')}.pdf` });
        } catch (pdfError) {
            console.error(`Error generating PDF for payslip ID ${payslip._id}:`, pdfError);
            // Log the error but continue to try and generate other payslips if possible.
        }
    }

    archive.finalize();
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
    console.log(`[PAYSLIP_DEBUG] Payslip Company field (from DB document): `, payslip.company);
    console.log(`[PAYSLIP_DEBUG] Derived payslipCompanyId: ${payslipCompanyId.toString()}`);
    console.log(`[PAYSLIP_DEBUG] User's Company ID (from req.user.company): `, companyId);
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

// **NEW FUNCTION TO FETCH A LIST OF PAYSLIPS FOR A STAFF MEMBER**
/**
 * @desc    Get all payslips for a specific staff member
 * @route   GET /api/payroll/payslips/staff/:staffId
 * @access  Private (Admin, Manager, Staff - if owner)
 */
const getStaffPayslips = asyncHandler(async (req, res) => {
    const staffId = req.params.staffId;
    const companyId = req.user.company; // Company ID from the authenticated user
    const requestingUserRole = req.user.role;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    // Authorization: Staff can only view their own payslips
    // Admins/Managers can view any staff's payslips within their company
    if (requestingUserRole === 'staff' && staffId !== requestingUserStaffId) {
        res.status(403);
        throw new Error('Not authorized to view payslips for this staff member.');
    }

    try {
        const payslips = await Payslip.find({ staff: staffId, company: companyId })
            .sort({ payPeriodEnd: -1 }) // Sort by most recent pay period end date
            .limit(5) // Limit to, for example, the last 5 payslips for the dashboard summary
            .populate('staff', 'contactPersonName email') // Populate staff details if needed on frontend
            .lean(); // Return plain JavaScript objects

        res.status(200).json(payslips);
    } catch (error) {
        console.error(`Error fetching payslips for staff ${staffId}:`, error);
        res.status(500).json({ message: 'Failed to fetch staff payslips.' });
    }
});


module.exports = {
    calculatePayroll,
    getPayslipById,
    downloadPayslip,
    downloadPayslipsBulk,
    generateAccountantReportData,
    renderAccountantReportHtml,
    renderPayslipHtml,
    getStaffPayslips, // <--- EXPORT THIS NEW FUNCTION
};