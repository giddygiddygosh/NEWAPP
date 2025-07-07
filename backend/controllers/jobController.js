// backend/controllers/jobController.js

const Job = require('../models/Job');
const Customer = require('../models/Customer');
const User = require('../models/User'); // For manager/admin checks
const Staff = require('../models/Staff'); // IMPORT STAFF MODEL for clarity and proper population
const StockItem = require('../models/StockItem');
const mongoose = require('mongoose');

// NEW: Import the email trigger service
const sendTemplatedEmail = require('../utils/emailTriggerService');

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

        // Date in past validation
        const newStartTime = new Date(`${date}T${time}`);
        if (newStartTime < new Date()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid Date: You cannot book a job in the past.' });
        }

        // Double booking check (only for create)
        if (assignedStaff && assignedStaff.length > 0) {
            const newEndTime = new Date(newStartTime.getTime() + duration * 60000);
            const existingJobs = await Job.find({
                assignedStaff: assignedStaff[0], // Assuming single assigned staff for this check
                date: {
                    $gte: new Date(newStartTime).setHours(0, 0, 0, 0),
                    $lte: new Date(newStartTime).setHours(23, 59, 59, 999)
                }
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

        // Validate and process usedStockItems
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

                // Decrement stock quantity
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

        // Populate the job for consistent response, including usedStockItems
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

        // Apply staff filtering for staff users
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
        const { usedStockItems, ...otherUpdates } = req.body;

        const job = await Job.findOne({ _id: jobId, company: companyId }).session(session);

        if (!job) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Job not found or not authorized.' });
        }

        // Authorization checks...
        if (req.user.role === 'staff') {
            if (!req.user.staff || !job.assignedStaff.some(s => s._id.toString() === req.user.staff.toString())) {
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

        // --- Handle stock item updates and quantity adjustments ---
        const originalUsedStockItems = job.usedStockItems || [];
        const stockAdjustments = {};
        const finalUsedStockItems = [];

        if (usedStockItems && Array.isArray(usedStockItems)) {
            for (const newItem of usedStockItems) {
                if (!mongoose.Types.ObjectId.isValid(newItem.stockItem) || newItem.quantityUsed === undefined || newItem.quantityUsed < 0) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: 'Invalid stock item data: stockItem ID and non-negative quantityUsed are required.' });
                }

                const existingItem = originalUsedStockItems.find(
                    (oldItem) => oldItem.stockItem.toString() === newItem.stockItem.toString()
                );

                let quantityChange = 0;
                if (existingItem) {
                    quantityChange = newItem.quantityUsed - existingItem.quantityUsed;
                } else {
                    quantityChange = newItem.quantityUsed;
                }

                stockAdjustments[newItem.stockItem.toString()] = (stockAdjustments[newItem.stockItem.toString()] || 0) + quantityChange;
                finalUsedStockItems.push({ stockItem: newItem.stockItem, quantityUsed: newItem.quantityUsed });
            }

            for (const oldItem of originalUsedStockItems) {
                const isStillPresent = usedStockItems.some(
                    (newItem) => newItem.stockItem.toString() === oldItem.stockItem.toString()
                );
                if (!isStillPresent) {
                    stockAdjustments[oldItem.stockItem.toString()] = (stockAdjustments[oldItem.stockItem.toString()] || 0) - oldItem.quantityUsed;
                }
            }
        } else {
            for (const oldItem of originalUsedStockItems) {
                stockAdjustments[oldItem.stockItem.toString()] = (stockAdjustments[oldItem.stockItem.toString()] || 0) - oldItem.quantityUsed;
            }
            job.usedStockItems = []; // Clear used stock items if not provided
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
        Object.keys(otherUpdates).forEach(key => {
            if (key === 'customer') {
                job.customer = otherUpdates.customer;
            } else if (key === 'recurring') {
                if (!job.recurring) {
                    job.recurring = { pattern: 'none', endDate: null };
                }
                if (otherUpdates.recurring) {
                    if (otherUpdates.recurring.pattern !== undefined) {
                        job.recurring.pattern = otherUpdates.recurring.pattern;
                    }
                    if (otherUpdates.recurring.endDate !== undefined) {
                        job.recurring.endDate = otherUpdates.recurring.endDate;
                    }
                }
            } else if (key === 'assignedStaff') {
                job.assignedStaff = Array.isArray(otherUpdates.assignedStaff)
                    ? otherUpdates.assignedStaff.filter(s => mongoose.Types.ObjectId.isValid(s))
                    : [];
            } else if (key === 'date' || key === 'endDate') {
                if (otherUpdates[key]) {
                    job[key] = new Date(otherUpdates[key]);
                } else {
                    job[key] = null;
                }
            } else {
                job[key] = otherUpdates[key];
            }
        });

        // Update usedStockItems on the job document with the `finalUsedStockItems` array
        if (Object.prototype.hasOwnProperty.call(req.body, 'usedStockItems')) {
            job.usedStockItems = finalUsedStockItems;
        }

        // If customer ID changed, update customerName on the job
        if (otherUpdates.customer !== undefined && (job.customer ? otherUpdates.customer?.toString() !== job.customer._id.toString() : otherUpdates.customer !== null)) {
            if (otherUpdates.customer) {
                const newCustomerDoc = await Customer.findById(otherUpdates.customer).session(session);
                if (newCustomerDoc) {
                    job.customerName = newCustomerDoc.contactPersonName;
                } else {
                    job.customerName = 'Unknown Customer';
                }
            } else {
                job.customer = null;
                job.customerName = '';
            }
        }

        // NEW VALIDATION FOR UPDATE: Check for past date/time
        if (otherUpdates.date !== undefined || otherUpdates.time !== undefined) {
            const updatedDate = otherUpdates.date !== undefined ? new Date(otherUpdates.date) : job.date;
            const updatedTime = otherUpdates.time !== undefined ? otherUpdates.time : job.time;
            const updatedStartTime = new Date(`${updatedDate.toISOString().split('T')[0]}T${updatedTime}`);

            if (updatedStartTime < new Date() && job.status !== 'Completed' && job.status !== 'Invoice Paid') {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'Invalid Update: You cannot move a job to a past date/time unless it is already completed.' });
            }
        }

        // NEW VALIDATION FOR UPDATE: Double booking check
        if ((otherUpdates.assignedStaff !== undefined && otherUpdates.assignedStaff.length > 0) ||
            (otherUpdates.date !== undefined) ||
            (otherUpdates.time !== undefined) ||
            (otherUpdates.duration !== undefined)) {

            const updatedAssignedStaffId = (otherUpdates.assignedStaff && otherUpdates.assignedStaff.length > 0)
                ? otherUpdates.assignedStaff[0]
                : (job.assignedStaff.length > 0 ? job.assignedStaff[0] : null);

            if (updatedAssignedStaffId) {
                const updatedDate = otherUpdates.date !== undefined ? new Date(otherUpdates.date) : job.date;
                const updatedTime = otherUpdates.time !== undefined ? otherUpdates.time : job.time;
                const updatedDuration = otherUpdates.duration !== undefined ? otherUpdates.duration : job.duration;

                const updatedStartTime = new Date(`${updatedDate.toISOString().split('T')[0]}T${updatedTime}`);
                const updatedEndTime = new Date(updatedStartTime.getTime() + updatedDuration * 60000);

                const existingJobs = await Job.find({
                    _id: { $ne: jobId },
                    assignedStaff: updatedAssignedStaffId,
                    date: {
                        $gte: new Date(updatedStartTime).setHours(0, 0, 0, 0),
                        $lte: new Date(updatedStartTime).setHours(23, 59, 59, 999)
                    }
                }).session(session);

                const conflictingJob = existingJobs.find(existingJob => {
                    if (!existingJob.date || !existingJob.time) return false;
                    const existingJobStartTime = new Date(`${existingJob.date.toISOString().split('T')[0]}T${existingJob.time}`);
                    const existingJobEndTime = new Date(existingJobStartTime.getTime() + existingJob.duration * 60000);
                    return updatedStartTime < existingJobEndTime && updatedEndTime > existingJobStartTime;
                });

                if (conflictingJob) {
                    const staffMember = await Staff.findById(updatedAssignedStaffId).select('contactPersonName').session(session); // Fetch from Staff model
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(409).json({ message: 'Double Booking: This staff member is already booked.', details: `Staff member ${staffMember ? staffMember.contactPersonName : 'N/A'} is assigned to another job at this time.` });
                }
            }
        }

        job.updatedAt = Date.now();

        await job.save({ session });

        const updatedPopulatedJob = await Job.findById(jobId)
            .populate('customer', 'contactPersonName companyName email phone address')
            .populate('assignedStaff', 'contactPersonName email phone') // CORRECTED: Populate fields from Staff model
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

module.exports = {
    createJob: exports.createJob,
    getJobs: exports.getJobs,
    getJobById: exports.getJobById,
    updateJob: exports.updateJob,
    deleteJob: exports.deleteJob,
    checkAvailability: exports.checkAvailability,
};