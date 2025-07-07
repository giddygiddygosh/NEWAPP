// backend/controllers/jobController.js

const Job = require('../models/Job');
const Customer = require('../models/Customer');
const User = require('../models/User'); // For manager/admin checks
const Staff = require('../models/Staff'); // IMPORT STAFF MODEL for clarity and proper population
const StockItem = require('../models/StockItem');
const Company = require('../models/Company'); // Needed for fetching company name for emails
const mongoose = require('mongoose');

const sendTemplatedEmail = require('../utils/emailTriggerService');

// Helper function to check if a staff member is unavailable during a specific job slot
const isStaffUnavailableOnDate = (staffMember, jobDate, jobTime, jobDuration) => {
    if (!staffMember || !staffMember.unavailabilityPeriods || staffMember.unavailabilityPeriods.length === 0) {
        return false; // Staff is available if no absence periods are recorded
    }

    const jobStart = new Date(`${jobDate}T${jobTime}`);
    const jobEnd = new Date(jobStart.getTime() + jobDuration * 60 * 1000);

    for (const period of staffMember.unavailabilityPeriods) {
        const periodStart = new Date(period.start);
        const periodEnd = new Date(period.end);
        
        periodEnd.setHours(23, 59, 59, 999); // Normalize periodEnd to end of day

        // Check if job falls within or overlaps with an absence period
        // Job starts before period ends AND Job ends after period starts
        if (jobStart < periodEnd && jobEnd > periodStart) {
            return true; // Staff is unavailable
        }
    }
    return false; // Staff is available for this job slot
};


/**
 * @desc Create a new job
 * @route POST /api/jobs
 * @access Private (Admin, Manager, Staff)
 */
exports.createJob = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            customer, serviceType, description, date, time, duration,
            assignedStaff, status, address, notes, recurring, endDate,
            usedStockItems
        } = req.body;
        const companyId = req.user.company;
        const createdBy = req.user._id;

        if (!customer || !serviceType || !date || !time || !duration) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Customer, service type, date, time, and duration are required.' });
        }

        const newStartTime = new Date(`${date}T${time}`);
        if (newStartTime < new Date()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid Date: You cannot book a job in the past.' });
        }

        // Staff Absence Check for Create Job
        if (assignedStaff && assignedStaff.length > 0) {
            const staffIdForCheck = assignedStaff[0];
            const staffMember = await Staff.findById(staffIdForCheck).select('unavailabilityPeriods contactPersonName').session(session);

            if (staffMember && isStaffUnavailableOnDate(staffMember, date, time, duration)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: 'Staff Unavailable: This staff member is on leave or sick during this time.', details: `${staffMember.contactPersonName} is unavailable due to pre-recorded absence.` });
            }
        }

        // Double booking check (only for create)
        if (assignedStaff && assignedStaff.length > 0) {
            const newEndTime = new Date(newStartTime.getTime() + duration * 60000);
            const existingJobs = await Job.find({
                assignedStaff: assignedStaff[0],
                date: {
                    $gte: new Date(newStartTime).setHours(0, 0, 0, 0),
                    $lte: new Date(newStartTime).setHours(23, 59, 59, 999)
                },
                status: { $ne: 'Cancelled' } // Only check against non-cancelled jobs
            }).session(session);

            const conflictingJob = existingJobs.find(existingJob => {
                if (!existingJob.date || !existingJob.time) return false;
                const existingJobStartTime = new Date(`${existingJob.date.toISOString().split('T')[0]}T${existingJob.time}`);
                const existingJobEndTime = new Date(existingJobStartTime.getTime() + existingJob.duration * 60000);
                return newStartTime < existingJobEndTime && newEndTime > existingJobStartTime;
            });

            if (conflictingJob) {
                const staffMember = await Staff.findById(assignedStaff[0]).select('contactPersonName').session(session);
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: 'Double Booking: This time slot is already taken.', details: `The selected staff member, ${staffMember.contactPersonName}, is already assigned to another job.` });
            }
        }

        const customerDoc = await Customer.findById(customer).session(session);
        if (!customerDoc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Customer not found.' });
        }
        const customerName = customerDoc.contactPersonName;

        const processedUsedStockItems = [];
        if (usedStockItems && Array.isArray(usedStockItems) && usedStockItems.length > 0) {
            for (const item of usedStockItems) {
                if (!mongoose.Types.ObjectId.isValid(item.stockItem) || !item.quantityUsed || item.quantityUsed <= 0) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: 'Invalid stock item data: stockItem ID and positive quantityUsed are required.' });
                }

                const stockDoc = await StockItem.findById(item.stockItem).session(session);
                if (!stockDoc || stockDoc.company.toString() !== companyId.toString()) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ message: `Stock item with ID ${item.stockItem} not found or not authorized for your company.` });
                }

                if (stockDoc.stockQuantity < item.quantityUsed) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: `Insufficient stock for ${stockDoc.name}. Available: ${stockDoc.stockQuantity}, Requested: ${item.quantityUsed}.` });
                }

                stockDoc.stockQuantity -= item.quantityUsed;
                await stockDoc.save({ session });
                processedUsedStockItems.push({ stockItem: stockDoc._id, quantityUsed: item.quantityUsed });
            }
        }

        const newJob = new Job({
            company: companyId,
            customer,
            customerName,
            serviceType,
            description,
            date,
            time,
            duration,
            assignedStaff: assignedStaff || [],
            status: status || 'Booked',
            address: address || customerDoc.address,
            notes,
            endDate,
            recurring: recurring || { pattern: 'none', endDate: null },
            usedStockItems: processedUsedStockItems,
            createdBy,
        });

        await newJob.save({ session });

        const populatedJob = await Job.findById(newJob._id)
            .populate('customer', 'contactPersonName companyName email phone address')
            .populate('assignedStaff', 'contactPersonName email phone')
            .populate('usedStockItems.stockItem', 'name unit purchasePrice salePrice')
            .session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ message: 'Job created successfully', job: populatedJob });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating job:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to create job.', error: error.message });
    }
};

/**
 * @desc Get all jobs for a company (with filtering and date range)
 * @route GET /api/jobs
 * @access Private (Admin, Manager, Staff)
 */
exports.getJobs = async (req, res) => {
    try {
        const companyId = req.user.company;
        const { startDate, endDate, customerId, staffId } = req.query;

        let query = { company: companyId };

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (customerId) {
            query.customer = customerId;
        }

        if (staffId) {
            if (staffId === 'unassigned') {
                query.assignedStaff = { $size: 0 };
            } else {
                query.assignedStaff = staffId;
            }
        }

        if (req.user.role === 'staff' && req.user.staff) {
            query.assignedStaff = req.user.staff._id;
        }

        const jobs = await Job.find(query)
            .populate('customer', 'contactPersonName companyName email phone address')
            .populate('assignedStaff', 'contactPersonName email phone')
            .populate('usedStockItems.stockItem', 'name unit purchasePrice salePrice')
            .sort({ date: 1, time: 1 });

        res.status(200).json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Get a single job by ID
 * @route GET /api/jobs/:id
 * @access Private (Admin, Manager, Staff - if assigned)
 */
exports.getJobById = async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.user.company;

        const job = await Job.findOne({ _id: jobId, company: companyId })
            .populate('customer', 'contactPersonName companyName email phone address')
            .populate('assignedStaff', 'contactPersonName email phone')
            .populate('usedStockItems.stockItem', 'name unit purchasePrice salePrice');

        if (!job) {
            return res.status(404).json({ message: 'Job not found or not authorized.' });
        }

        if (req.user.role === 'staff') {
            if (!req.user.staff || !job.assignedStaff.some(s => s._id.toString() === req.user.staff.toString())) {
                return res.status(403).json({ message: 'Not authorized to view this job.' });
            }
        }

        res.status(200).json(job);
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Update a job by ID
 * @route PUT /api/jobs/:id
 * @access Private (Admin, Manager, Staff - self)
 */
exports.updateJob = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const jobId = req.params.id;
        const companyId = req.user.company;
        const { usedStockItems, status, ...otherUpdates } = req.body;
        const originalJob = await Job.findById(jobId).session(session);

        if (!originalJob) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Job not found or not authorized.' });
        }

        // Authorization checks...
        if (req.user.role === 'staff') {
            if (!req.user.staff || !originalJob.assignedStaff.some(s => s._id.toString() === req.user.staff.toString())) {
                await session.abortTransaction();
                session.endSession();
                return res.status(403).json({ message: 'Not authorized to update this job.' });
            }
        }
        if (req.user.role === 'manager') {
            if (otherUpdates.assignedStaff && Array.isArray(otherUpdates.assignedStaff) && otherUpdates.assignedStaff.length > 0) {
                const assignedAdmin = await User.findOne({ _id: { $in: otherUpdates.assignedStaff }, company: companyId, role: 'admin' }).session(session);
                if (assignedAdmin) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(403).json({ message: 'Managers cannot assign admin roles to jobs.' });
                }
            }
        }

        // Staff Absence Check for Update Job
        if (otherUpdates.assignedStaff !== undefined || otherUpdates.date !== undefined || otherUpdates.time !== undefined || otherUpdates.duration !== undefined) {
            const currentAssignedStaffIds = (otherUpdates.assignedStaff !== undefined ? otherUpdates.assignedStaff : originalJob.assignedStaff);
            const currentJobDate = (otherUpdates.date !== undefined ? otherUpdates.date : originalJob.date);
            const currentJobTime = (otherUpdates.time !== undefined ? otherUpdates.time : originalJob.time);
            const currentJobDuration = (otherUpdates.duration !== undefined ? otherUpdates.duration : originalJob.duration);

            if (currentAssignedStaffIds && currentAssignedStaffIds.length > 0) {
                for (const staffId of currentAssignedStaffIds) {
                    const staffMember = await Staff.findById(staffId).select('unavailabilityPeriods contactPersonName').session(session);
                    if (staffMember && isStaffUnavailableOnDate(staffMember, currentJobDate, currentJobTime, currentJobDuration)) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(409).json({ message: 'Staff Unavailable: This staff member is on leave or sick during the updated time.', details: `${staffMember.contactPersonName} is unavailable due to pre-recorded absence.` });
                    }
                }
            }
        }

        // --- Handle stock item updates and quantity adjustments ---
        const originalUsedStockItems = originalJob.usedStockItems || [];
        const stockAdjustments = {};
        const finalUsedStockItems = [];

        if (usedStockItems && Array.isArray(usedStockItems)) {
            for (const newItem of usedStockItems) {
                if (!mongoose.Types.ObjectId.isValid(newItem.stockItem) || newItem.quantityUsed === undefined || newItem.quantityUsed < 0) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: 'Invalid stock item data: stockItem ID and non-negative quantityUsed are required.' });
                }

                const stockDoc = await StockItem.findById(item.stockItem).session(session);
                if (!stockDoc || stockDoc.company.toString() !== companyId.toString()) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ message: `Stock item with ID ${stockItemId} not found or not authorized for your company during update.` });
                }

                if (stockDoc.stockQuantity < change && change > 0) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: `Insufficient stock for ${stockDoc.name}. Available: ${stockDoc.stockQuantity}, Attempted to use: ${change}.` });
                }

                stockDoc.stockQuantity -= change;
                await stockDoc.save({ session });
            }
        } else {
            for (const oldItem of originalUsedStockItems) {
                stockAdjustments[oldItem.stockItem.toString()] = (stockAdjustments[oldItem.stockItem.toString()] || 0) - oldItem.quantityUsed;
            }
            originalJob.usedStockItems = []; // Clear used stock items if not provided
        }

        for (const stockItemId in stockAdjustments) {
            const change = stockAdjustments[stockItemId];
            if (change === 0) continue;

            const stockDoc = await StockItem.findById(stockItemId).session(session);
            if (!stockDoc || stockDoc.company.toString() !== companyId.toString()) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ message: `Stock item with ID ${stockItemId} not found or not authorized for your company during update.` });
            }

            if (stockDoc.stockQuantity < change && change > 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: `Insufficient stock for ${stockDoc.name}. Available: ${stockDoc.stockQuantity}, Attempted to use: ${change}.` });
            }

            stockDoc.stockQuantity -= change;
            await stockDoc.save({ session });
        }
        // --- END Stock Item Handling ---

        // Apply other updates to the job object based on `otherUpdates`
        Object.assign(originalJob, otherUpdates);

        // Handle specific fields if they need special processing
        if (Object.prototype.hasOwnProperty.call(req.body, 'usedStockItems')) {
            originalJob.usedStockItems = finalUsedStockItems;
        }

        // If customer ID changed, update customerName on the job
        if (otherUpdates.customer !== undefined && (originalJob.customer ? otherUpdates.customer?.toString() !== originalJob.customer._id.toString() : otherUpdates.customer !== null)) {
            if (otherUpdates.customer) {
                const newCustomerDoc = await Customer.findById(otherUpdates.customer).session(session);
                if (newCustomerDoc) {
                    originalJob.customerName = newCustomerDoc.contactPersonName;
                } else {
                    originalJob.customerName = 'Unknown Customer';
                }
            } else {
                originalJob.customer = null;
                originalJob.customerName = '';
            }
        }

        // NEW VALIDATION FOR UPDATE: Check for past date/time
        if (originalJob.date !== undefined || originalJob.time !== undefined) {
            const updatedDate = originalJob.date;
            const updatedTime = originalJob.time;
            const updatedStartTime = new Date(`${updatedDate.toISOString().split('T')[0]}T${updatedTime}`);

            if (updatedStartTime < new Date() && originalJob.status !== 'Completed' && originalJob.status !== 'Invoice Paid') {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'Invalid Update: You cannot move a job to a past date/time unless it is already completed.' });
            }
        }

        // NEW VALIDATION FOR UPDATE: Double booking check
        if ((originalJob.assignedStaff !== undefined && originalJob.assignedStaff.length > 0) ||
            (originalJob.date !== undefined) ||
            (originalJob.time !== undefined) ||
            (originalJob.duration !== undefined)) {

            const updatedAssignedStaffId = (originalJob.assignedStaff && originalJob.assignedStaff.length > 0)
                ? originalJob.assignedStaff[0]
                : null;

            if (updatedAssignedStaffId) {
                const updatedDate = originalJob.date;
                const updatedTime = originalJob.time;
                const updatedDuration = originalJob.duration;

                const updatedStartTime = new Date(`${updatedDate.toISOString().split('T')[0]}T${updatedTime}`);
                const updatedEndTime = new Date(updatedStartTime.getTime() + updatedDuration * 60000);

                const existingJobs = await Job.find({
                    _id: { $ne: jobId },
                    assignedStaff: updatedAssignedStaffId,
                    date: {
                        $gte: new Date(updatedStartTime).setHours(0, 0, 0, 0),
                        $lte: new Date(updatedStartTime).setHours(23, 59, 59, 999)
                    },
                    status: { $ne: 'Cancelled' }
                }).session(session);

                const conflictingJob = existingJobs.find(existingJob => {
                    if (!existingJob.date || !existingJob.time) return false;
                    const existingJobStartTime = new Date(`${existingJob.date.toISOString().split('T')[0]}T${existingJob.time}`);
                    const existingJobEndTime = new Date(existingJobStartTime.getTime() + existingJob.duration * 60000);
                    return updatedStartTime < existingJobEndTime && updatedEndTime > existingJobStartTime;
                });

                if (conflictingJob) {
                    const staffMember = await Staff.findById(updatedAssignedStaffId).select('contactPersonName').session(session);
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(409).json({ message: 'Double Booking: This staff member is already booked.', details: `Staff member ${staffMember ? staffMember.contactPersonName : 'N/A'} is assigned to another job at this time.` });
                }
            }
        }

        originalJob.updatedAt = Date.now();
        await originalJob.save({ session }); // Save the updated job

        // Trigger Job Completion Email (if status changed to Completed)
        if (status === 'Completed' && originalJob.status !== 'Completed') { // Only send if status *just* changed to 'Completed'
            const customer = await Customer.findById(originalJob.customer).session(session); // Fetch customer within transaction
            const company = await Company.findById(originalJob.company).select('name').session(session); // Fetch company name for placeholders

            if (customer && customer.email && customer.email.length > 0 && customer.email[0].email) {
                sendTemplatedEmail(
                    'job_completion',
                    originalJob.company,
                    customer.email[0].email, // Assuming first email is primary
                    {
                        customerName: customer.contactPersonName,
                        jobDescription: originalJob.description || originalJob.serviceType,
                        jobDate: new Date(originalJob.date).toLocaleDateString('en-GB'), // Format date for email
                        jobTime: originalJob.time,
                        companyName: company?.name || 'Your Company',
                        jobStatus: originalJob.status // 'Completed'
                    },
                    'Job Status Update' // Trigger source for logging
                );
            }
        }

        const updatedPopulatedJob = await Job.findById(jobId)
            .populate('customer', 'contactPersonName companyName email phone address')
            .populate('assignedStaff', 'contactPersonName email phone')
            .populate('usedStockItems.stockItem', 'name unit purchasePrice salePrice')
            .session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Job updated successfully', job: updatedPopulatedJob });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error updating job:', error);
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: `Validation failed: ${Object.values(errors).join(', ')}`, errors: errors });
        }
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Duplicate key error.' });
        }
        res.status(500).json({ message: 'Failed to update job.', error: error.message });
    }
};

/**
 * @desc Delete a job by ID
 * @route DELETE /api/jobs/:id
 * @access Private (Admin, Manager)
 */
exports.deleteJob = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const jobId = req.params.id;
        const companyId = req.user.company;

        const deletedJob = await Job.findOneAndDelete({ _id: jobId, company: companyId }).session(session);

        if (!deletedJob) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Job not found or not authorized.' });
        }

        // Return stock items to inventory when job is deleted
        if (deletedJob.usedStockItems && deletedJob.usedStockItems.length > 0) {
            for (const item of deletedJob.usedStockItems) {
                const stockDoc = await StockItem.findById(item.stockItem).session(session);
                if (stockDoc) {
                    stockDoc.stockQuantity += item.quantityUsed;
                    await stockDoc.save({ session });
                    console.log(`[JobController] Returned ${item.quantityUsed} of ${stockDoc.name} (ID: ${stockDoc._id}) to stock.`);
                } else {
                    console.warn(`[JobController] Stock item with ID ${item.stockItem} not found when trying to return stock for deleted job ${jobId}.`);
                }
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Job deleted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting job:', error);
        res.status(500).json({ message: 'Failed to delete job.', error: error.message });
    }
};

/**
 * @desc Check staff availability for a given date and time
 * @route POST /api/jobs/check-availability
 * @access Private (Admin, Manager, Staff)
 */
exports.checkAvailability = async (req, res) => {
    try {
        const { staffId, date, time, duration, jobIdToExclude } = req.body;
        const companyId = req.user.company;

        if (!staffId || !date || !time || !duration) {
            return res.status(400).json({ message: 'Staff ID, date, time, and duration are required for availability check.' });
        }

        const checkDate = new Date(date);
        const checkStartTime = new Date(`${date}T${time}`);
        const checkEndTime = new Date(checkStartTime.getTime() + duration * 60000);

        let query = {
            assignedStaff: staffId,
            date: {
                $gte: new Date(checkDate).setHours(0, 0, 0, 0),
                $lte: new Date(checkDate).setHours(23, 59, 59, 999)
            },
            company: companyId
        };

        if (jobIdToExclude) {
            query._id = { $ne: jobIdToExclude };
        }

        const existingJobs = await Job.find(query);

        const isAvailable = !existingJobs.some(existingJob => {
            if (!existingJob.date || !existingJob.time) return false;
            const existingJobStartTime = new Date(`${existingJob.date.toISOString().split('T')[0]}T${existingJob.time}`);
            const existingJobEndTime = new Date(existingJobStartTime.getTime() + existingJob.duration * 60000);
            return checkStartTime < existingJobEndTime && checkEndTime > existingJobStartTime;
        });

        if (isAvailable) {
            return res.status(200).json({ available: true, message: 'Staff member is available during this time slot.' });
        } else {
            const staffMember = await Staff.findById(staffId).select('contactPersonName'); // Fetch from Staff model
            return res.status(409).json({ available: false, message: `Staff member ${staffMember ? staffMember.contactPersonName : 'N/A'} is not available during this time slot due to a conflicting job.` });
        }

    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ message: 'Failed to check availability.', error: error.message });
    }
};

/**
 * @desc Assigns multiple jobs to a staff member for a planned route.
 * @route POST /api/jobs/assign-route
 * @access Private (Admin, Manager)
 */
exports.assignRouteToJobs = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { jobIds, staffId, optimizedRouteOrder, routeDistance, routeDuration } = req.body;
        const companyId = req.user.company;

        if (!Array.isArray(jobIds) || jobIds.length === 0 || !staffId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Job IDs and Staff ID are required to assign a route.' });
        }

        // Validate staff member exists and belongs to the company
        const staffMember = await Staff.findOne({ _id: staffId, company: companyId }).session(session);
        if (!staffMember) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Assigned staff member not found or not authorized.' });
        }

        // Validate each job and check for conflicts with staff absence
        const jobsToUpdate = await Job.find({ _id: { $in: jobIds }, company: companyId }).session(session);

        if (jobsToUpdate.length !== jobIds.length) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'One or more jobs not found or not authorized.' });
        }

        for (const job of jobsToUpdate) {
            // Check for staff absence conflict
            if (isStaffUnavailableOnDate(staffMember, job.date, job.time, job.duration)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: 'Staff Unavailable: One or more jobs conflict with staff absence.', details: `${staffMember.contactPersonName} is unavailable during job on ${new Date(job.date).toLocaleDateString()} at ${job.time}.` });
            }

            // Check for double booking with existing assigned jobs (excluding itself if it's already assigned)
            const proposedStartTime = new Date(`${job.date}T${job.time}`);
            const proposedEndTime = new Date(proposedStartTime.getTime() + job.duration * 60 * 1000);

            const existingConflicts = await Job.findOne({
                _id: { $ne: job._id }, // Exclude current job if updating
                assignedStaff: staffId,
                date: { $gte: new Date(job.date).setHours(0,0,0,0), $lte: new Date(job.date).setHours(23,59,59,999) },
                status: { $ne: 'Cancelled' },
                $or: [
                    { 'time': { $lt: new Date(proposedEndTime).toTimeString().substring(0,5) }, 'duration': { $gt: (proposedStartTime.getTime() - new Date(`${job.date}T00:00:00`).getTime()) / 60000 } },
                    { 'time': { $lt: new Date(proposedEndTime).toTimeString().substring(0,5) }, 'duration': { $gt: (new Date(`${job.date}T00:00:00`).getTime() + proposedEndTime.getTime()) / 60000 } }
                ] // Simplified conflict check, actual needs more robust time parsing
            }).session(session);

            if(existingConflicts) {
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: 'Double Booking: This staff member has conflicting jobs.', details: `${staffMember.contactPersonName} has a conflict on ${new Date(job.date).toLocaleDateString()} at ${job.time}.` });
            }

            // Update job details: assign staff, optionally update status
            job.assignedStaff = [staffId]; // Assign only this staff member
            job.status = 'Booked'; // Or 'Assigned', depending on your workflow
            // You could store optimizedRouteOrder, routeDistance, routeDuration on the job if needed
            await job.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, updatedCount: jobsToUpdate.length, message: `Successfully assigned ${jobsToUpdate.length} jobs to ${staffMember.contactPersonName}.` });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error assigning route to jobs:', error);
        res.status(500).json({ message: 'Failed to assign route to jobs.', error: error.message });
    }
};


module.exports = {
    createJob: exports.createJob,
    getJobs: exports.getJobs,
    getJobById: exports.getJobById,
    updateJob: exports.updateJob,
    deleteJob: exports.deleteJob,
    checkAvailability: exports.checkAvailability,
    assignRouteToJobs: exports.assignRouteToJobs, // NEW: Export the new function
};