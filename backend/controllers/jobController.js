// backend/controllers/jobController.js

const Job = require('../models/Job');
const Customer = require('../models/Customer');
const User = require('../models/User'); // For manager/admin checks
const Staff = require('../models/Staff'); // IMPORT STAFF MODEL for clarity and proper population
const StockItem = require('../models/StockItem');
const Company = require('../models/Company'); // Needed for fetching company name for emails
const Absence = require('../models/Absence'); // <--- IMPORTANT: NEW IMPORT FOR ABSENCE MODEL
const mongoose = require('mongoose');

const sendTemplatedEmail = require('../utils/emailTriggerService');

// Helper function to check if a staff member is unavailable during a specific job slot
// THIS FUNCTION NOW QUERIES THE DEDICATED ABSENCE COLLECTION
const isStaffUnavailableOnDate = async (staffId, jobDate, jobTime, jobDuration) => {
    // Fetch absences for the specific staff member using the new Absence model
    const absences = await Absence.find({ staff: staffId }).lean(); // Use .lean() for faster reads

    if (!absences || absences.length === 0) {
        return false; // Staff is available if no absence periods are recorded
    }

    const jobStart = new Date(`${jobDate}T${jobTime}`);
    const jobEnd = new Date(jobStart.getTime() + jobDuration * 60 * 1000);

    for (const period of absences) { // Loop through the fetched absences
        const periodStart = new Date(period.start);
        const periodEnd = new Date(period.end);
        
        // Normalize periodEnd to end of day to check for full-day absence conflicts.
        // If periods are meant to be exact times (e.g., job 9-10, absence 9:30-10:30), remove this normalization.
        periodEnd.setHours(23, 59, 59, 999); 

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

        // Staff Absence Check for Create Job - NOW USES THE NEW ABSENCE MODEL
        if (assignedStaff && assignedStaff.length > 0) {
            const staffIdForCheck = assignedStaff[0]; // Assuming one staff per job for simplicity of check
            const staffMember = await Staff.findById(staffIdForCheck).select('contactPersonName').session(session); // Only need name now

            // AWAIT the asynchronous isStaffUnavailableOnDate function
            if (staffMember && await isStaffUnavailableOnDate(staffIdForCheck, date, time, duration)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ message: 'Staff Unavailable: This staff member is on leave or sick during this time.', details: `${staffMember.contactPersonName} is unavailable due to pre-recorded absence.` });
            }
        }

        // Double booking check (only for create) - This remains the same as it checks against other jobs, not absences
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
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Duplicate key error.' });
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

        // Staff Absence Check for Update Job - NOW USES THE NEW ABSENCE MODEL
        if (otherUpdates.assignedStaff !== undefined || otherUpdates.date !== undefined || otherUpdates.time !== undefined || otherUpdates.duration !== undefined) {
            const currentAssignedStaffIds = (otherUpdates.assignedStaff !== undefined ? otherUpdates.assignedStaff : originalJob.assignedStaff);
            const currentJobDate = (otherUpdates.date !== undefined ? otherUpdates.date : originalJob.date);
            const currentJobTime = (otherUpdates.time !== undefined ? otherUpdates.time : originalJob.time);
            const currentJobDuration = (otherUpdates.duration !== undefined ? otherUpdates.duration : originalJob.duration);

            if (currentAssignedStaffIds && currentAssignedStaffIds.length > 0) {
                for (const staffId of currentAssignedStaffIds) {
                    const staffMember = await Staff.findById(staffId).select('contactPersonName').session(session);
                    // AWAIT the asynchronous isStaffUnavailableOnDate function
                    if (staffMember && await isStaffUnavailableOnDate(staffId, currentJobDate, currentJobTime, currentJobDuration)) {
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

                const stockDoc = await StockItem.findById(newItem.stockItem).session(session); // Corrected 'item.stockItem' to 'newItem.stockItem'
                if (!stockDoc || stockDoc.company.toString() !== companyId.toString()) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ message: `Stock item with ID ${newItem.stockItem} not found or not authorized for your company during update.` }); // Corrected 'stockItemId' to 'newItem.stockItem'
                }

                const oldQuantity = originalUsedStockItems.find(item => item.stockItem.toString() === newItem.stockItem.toString())?.quantityUsed || 0;
                const change = newItem.quantityUsed - oldQuantity; // Calculate the change in quantity

                if (stockDoc.stockQuantity < change && change > 0) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: `Insufficient stock for ${stockDoc.name}. Available: ${stockDoc.stockQuantity}, Attempted to use: ${change}.` });
                }

                stockDoc.stockQuantity -= change;
                await stockDoc.save({ session });
                finalUsedStockItems.push({ stockItem: stockDoc._id, quantityUsed: item.quantityUsed }); // Push the new item
            }
        } else {
            // If usedStockItems is not provided or is null, revert all stock from originalJob
            for (const oldItem of originalUsedStockItems) {
                const stockDoc = await StockItem.findById(oldItem.stockItem).session(session);
                if (stockDoc) {
                    stockDoc.stockQuantity += oldItem.quantityUsed;
                    await stockDoc.save({ session });
                }
            }
            // originalJob.usedStockItems will be set to [] below
        }

        // Apply other updates to the job object based on `otherUpdates`
        Object.assign(originalJob, otherUpdates);

        // Handle specific fields if they need special processing
        if (Object.prototype.hasOwnProperty.call(req.body, 'usedStockItems')) {
            originalJob.usedStockItems = finalUsedStockItems;
        }

        // If customer ID changed, update customerName on the job
        if (otherUpdates.customer !== undefined && (originalJob.customer ? otherUpdates.customer?.toString() !== originalJob.customer._id.toString() : originalJob.customer !== null)) {
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

                const existingConflicts = await Job.findOne({
                    _id: { $ne: jobId }, // Exclude current job if updating
                    assignedStaff: updatedAssignedStaffId,
                    date: { $gte: new Date(updatedStartTime).setHours(0,0,0,0), $lte: new Date(updatedStartTime).setHours(23,59,59,999) },
                    status: { $ne: 'Cancelled' },
                    $or: [
                        // Overlap check: existing job starts before new ends AND existing job ends after new starts
                        {
                            $and: [
                                { time: { $lt: updatedEndTime.toTimeString().substring(0,5) } },
                                { $expr: { $gt: [ { $add: [ { $dateFromString: { dateString: { $concat: [ { $dateToString: { format: '%Y-%m-%dT', date: '$date' } }, '$time' ] } } }, { $multiply: ['$duration', 60000] } ] }, updatedStartTime ] } }
                            ]
                        }
                    ]
                }).session(session);

                if(existingConflicts) {
                    await session.abortTransaction();
                    session.endSession();
                    // Assuming staffMember is available here, otherwise fetch it for the message
                    const conflictStaffMember = await Staff.findById(updatedAssignedStaffId).select('contactPersonName').session(session);
                    return res.status(409).json({ message: 'Double Booking: This staff member has conflicting jobs.', details: `${conflictStaffMember ? conflictStaffMember.contactPersonName : 'N/A'} has a conflict on ${new Date(existingConflicts.date).toLocaleDateString()} at ${existingConflicts.time}.` });
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
                    // Overlap check: existing job starts before new ends AND existing job ends after new starts
                    {
                        $and: [
                            { time: { $lt: proposedEndTime.toTimeString().substring(0,5) } },
                            { $expr: { $gt: [ { $add: [ { $dateFromString: { dateString: { $concat: [ { $dateToString: { format: '%Y-%m-%dT', date: '$date' } }, '$time' ] } } }, { $multiply: ['$duration', 60000] } ] }, proposedStartTime ] } }
                        ]
                    }
                ]
            }).session(session);

            if(existingConflicts) {
                await session.abortTransaction();
                session.endSession();
                // Assuming staffMember is available here, otherwise fetch it for the message
                const conflictStaffMember = await Staff.findById(staffId).select('contactPersonName').session(session);
                return res.status(409).json({ message: 'Double Booking: This staff member has conflicting jobs.', details: `${conflictStaffMember ? conflictStaffMember.contactPersonName : 'N/A'} has a conflict on ${new Date(job.date).toLocaleDateString()} at ${existingConflicts.time}.` });
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

        const job = await Job.findOne({ _id: jobId, company: companyId }).session(session);
        if (!job) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Job not found or not authorized.' });
        }

        // Revert stock items used in the job
        if (job.usedStockItems && job.usedStockItems.length > 0) {
            for (const item of job.usedStockItems) {
                const stockDoc = await StockItem.findById(item.stockItem).session(session);
                if (stockDoc) {
                    stockDoc.stockQuantity += item.quantityUsed;
                    await stockDoc.save({ session });
                }
            }
        }

        await Job.deleteOne({ _id: jobId }).session(session);

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

module.exports = {
    createJob: exports.createJob,
    getJobs: exports.getJobs,
    getJobById: exports.getJobById,
    updateJob: exports.updateJob,
    deleteJob: exports.deleteJob,
    checkAvailability: exports.checkAvailability, // Note: checkAvailability is not defined in this file's exports. If needed, define it or remove this export.
    assignRouteToJobs: exports.assignRouteToJobs,
};