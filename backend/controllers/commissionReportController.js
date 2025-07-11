// backend/controllers/commissionReportController.js

const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer'); // Assuming this path is correct
const Staff = require('../models/Staff');     // Assuming this path is correct

/**
 * @desc    Get commission report
 * @route   GET /api/reports/commission
 * @access  Private (Admin, Manager)
 * @query   startDate, endDate, salesPersonName (optional)
 */
const getCommissionReport = asyncHandler(async (req, res) => {
    const companyId = req.user.company._id;
    const { startDate, endDate, salesPersonName } = req.query;

    // Build query object for filtering customers
    let query = { company: companyId };

    // Filter by salesPersonName if provided
    if (salesPersonName) {
        // Use a case-insensitive regex for flexibility
        query.salesPersonName = new RegExp(salesPersonName, 'i');
    }

    // Filter by creation date of the customer (which is when commissionEarned is set)
    // Or you might want to consider the 'updatedAt' field if commission can change later
    if (startDate || endDate) {
        query.createdAt = {}; // Or 'updatedAt' if that's more appropriate for commission date
        if (startDate) {
            query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            // Set end date to end of the day
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    try {
        const pipeline = [
            {
                $match: query // Filter customers based on the constructed query
            },
            {
                $group: {
                    _id: "$salesPersonName", // Group by salesPersonName
                    totalCommission: { $sum: "$commissionEarned" }, // Sum commissionEarned for each salesperson
                    customersCount: { $sum: 1 }, // Count how many customers each salesperson has
                }
            },
            {
                $sort: { totalCommission: -1 } // Sort by highest commission first
            },
            {
                $project: {
                    _id: 0, // Exclude the _id field from the final output
                    salesPersonName: "$_id", // Rename _id to salesPersonName
                    totalCommission: 1,
                    customersCount: 1
                }
            }
        ];

        const reportData = await Customer.aggregate(pipeline);

        // Optionally, if you want to include staff details for salesPersonName,
        // you would need to fetch Staff separately and merge the data.
        // For now, the report just uses the name stored on the customer.

        // Get a list of all salespersons (staff) in the company for filtering options on the frontend
        const salespersons = await Staff.find({ company: companyId, role: { $in: ['admin', 'manager', 'staff'] } })
                                       .select('contactPersonName email')
                                       .lean(); // .lean() for plain JS objects

        res.status(200).json({
            message: 'Commission report generated successfully.',
            report: reportData,
            salespersons: salespersons
        });

    } catch (error) {
        console.error('Error generating commission report:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = {
    getCommissionReport,
};