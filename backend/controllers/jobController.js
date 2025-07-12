const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const Customer = require('../models/Customer');
const StockItem = require('../models/StockItem');
const CompanySetting = require('../models/CompanySetting');
const sendTemplatedEmail = require('../utils/emailTriggerService');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Form = require('../models/Form');
const Invoice = require('../models/Invoice');
const { generateAndProcessInvoiceForJob } = require('../services/invoiceService');

// ================== THIS IS THE CORRECTED FUNCTION ==================
const extractTasksFromFormSchema = (formSchema) => {
    const tasks = [];
    if (!formSchema || !Array.isArray(formSchema)) {
        return tasks;
    }

    formSchema.forEach(row => {
        (row.columns || []).forEach(col => {
            (col.fields || []).forEach(field => {
                if (field.mapping && field.mapping.startsWith('task_item')) {
                    const description = field.label || 'Unnamed Task';
                    tasks.push({
                        taskId: new mongoose.Types.ObjectId(), // Generate a new unique ID for each task
                        description: description,
                        completed: false
                    });
                }
            });
        });
    });

    const uniqueTasks = Array.from(new Map(tasks.map(task => [task.description, task])).values());
    return uniqueTasks;
};
// =====================================================================

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const getJobs = asyncHandler(async (req, res) => {
    const companyId = req.user.company._id;
    const { staffId, startDate, endDate, status } = req.query;
    let query = { company: companyId };
    if (staffId) query.staff = staffId; // Assumes staffId is a single string or ObjectId
    if (startDate && endDate) query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    if (status) query.status = status;
    const jobs = await Job.find(query).populate('customer', 'contactPersonName email phone address').populate('staff', 'contactPersonName email phone role');
    res.status(200).json(jobs);
});

const getJobById = asyncHandler(async (req, res) => {
    const companyId = req.user.company._id;
    // Populate deposit-related fields if you want them returned by default (optional, but good for display)
    const job = await Job.findById(req.params.id)
        .populate('customer', 'contactPersonName email phone address')
        .populate('staff', 'contactPersonName email phone role');

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }
    res.status(200).json(job);
});

const createJob = asyncHandler(async (req, res) => {
    // Destructure all existing fields, and add the NEW DEPOSIT FIELDS
    const {
        customer, staff, serviceType, description, address, date, time, priority, price, usedStockItems, formTemplate,
        depositRequired, // <--- ADDED: New deposit field for creation
    } = req.body;
    const companyId = req.user.company._id;

    // Validation for new deposit field
    if (typeof price !== 'number' || price < 0) {
        res.status(400);
        throw new Error('Price must be a non-negative number.');
    }
    if (depositRequired !== undefined && (typeof depositRequired !== 'number' || depositRequired < 0)) {
        res.status(400);
        throw new Error('Deposit required must be a non-negative number.');
    }
    if (depositRequired > price) {
        res.status(400);
        throw new Error('Deposit required cannot exceed the total job price.');
    }

    if (!customer || !staff || !Array.isArray(staff) || staff.length === 0 || !serviceType || !address || !date) {
        res.status(400);
        throw new Error('Missing or invalid required job fields.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const customerDoc = await Customer.findById(customer).session(session);
        if (!customerDoc) {
            res.status(404); // Use 404 for not found sub-resource
            throw new Error('Customer not found.');
        }

        // Ensure staff members belong to the company
        const staffIds = staff.map(s => (typeof s === 'object' && s !== null) ? s._id : s).filter(Boolean); // Handle staff coming as objects or IDs
        const foundStaff = await mongoose.model('Staff').find({ _id: { $in: staffIds }, company: companyId }).session(session);
        if (foundStaff.length !== staffIds.length) {
            res.status(400);
            throw new Error('One or more assigned staff members not found or do not belong to your company.');
        }

        const serviceAddress = customerDoc.serviceAddresses.find(sa => sa.street === address.street && sa.postcode === address.postcode) || customerDoc.address;
        const jobAddress = { ...address, payType: serviceAddress?.payType || 'Fixed', amount: serviceAddress?.amount || price };

        let jobTasks = [];
        if (formTemplate) {
            const form = await Form.findById(formTemplate).session(session);
            if (form) jobTasks = extractTasksFromFormSchema(form.formSchema);
        }

        const formattedUsedStock = (usedStockItems || []).map(item => ({
            stockId: item.stockItem,
            name: item.name,
            quantity: item.quantityUsed
        }));

        const jobData = {
            company: companyId, customer, staff: staffIds, serviceType, description, address: jobAddress, date, time, // Use validated staffIds
            priority, price, // This is the total price for the job
            depositRequired: depositRequired !== undefined ? depositRequired : 0, // <--- ADDED: Default to 0 if not provided
            depositPaid: 0, // Always 0 on creation, paid via separate Stripe flow
            depositPaymentIntentId: null, // Null on creation
            // depositStatus is set by the schema's pre-save hook
            usedStock: formattedUsedStock,
            formTemplate: formTemplate || null,
            tasks: jobTasks,
        };
        const newJobArray = await Job.create([jobData], { session });
        const newJob = newJobArray[0];

        if (formattedUsedStock.length > 0) {
            for (const item of formattedUsedStock) {
                await StockItem.findByIdAndUpdate(item.stockId, { $inc: { stockQuantity: -item.quantity } }, { session, runValidators: true });
            }
        }

        await session.commitTransaction();
        const populatedNewJob = await Job.findById(newJob._id)
            .populate('customer', 'contactPersonName email phone address')
            .populate('staff', 'contactPersonName email phone role');

        res.status(201).json({ message: 'Job created successfully.', job: populatedNewJob });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating job:', error);
        // Check for specific Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: error.message || 'Failed to create job.' });
    } finally {
        session.endSession();
    }
});

const updateJob = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company._id;
    const data = req.body;

    const updateFields = {};

    const allowedDirectFields = [
        'serviceType', 'description', 'date', 'time', 'priority',    
        'price', 'status', 'notes', 'duration',
        // --- ADDED NEW DEPOSIT FIELDS FOR UPDATE ---
        'depositRequired', 'depositPaid', 'depositPaymentIntentId', 'depositStatus'
    ];

    allowedDirectFields.forEach(field => {
        if (data[field] !== undefined) {
            updateFields[field] = data[field];
        }
    });

    if (data.address) {
        updateFields.address = data.address;
    }

    if (data.formTemplate !== undefined) {
        updateFields.formTemplate = data.formTemplate === '' ? null : data.formTemplate;
    }

    if (data.staff !== undefined && Array.isArray(data.staff)) {
        // Ensure staff IDs are valid ObjectIds or objects with _id
        updateFields.staff = data.staff.map(s => (typeof s === 'object' && s !== null) ? s._id : s).filter(Boolean);
        // Optional: Add validation to ensure updated staff belong to the company if needed
    }

    if (data.usedStockItems !== undefined && Array.isArray(data.usedStockItems)) {
        updateFields.usedStock = data.usedStockItems.map(item => ({
             stockId: item.stockItem || item.stockId,
             name: item.name,
             quantity: item.quantityUsed || item.quantity
        }));
    }

    // Validate depositRequired vs price on update
    // Fetch the current job to get its original price if not provided in update
    const currentJob = await Job.findById(id);
    if (!currentJob || currentJob.company.toString() !== companyId.toString()) {
        return res.status(404).json({ message: 'Job not found or not authorized.'});
    }

    const newPrice = updateFields.price !== undefined ? updateFields.price : currentJob.price;
    const newDepositRequired = updateFields.depositRequired !== undefined ? updateFields.depositRequired : currentJob.depositRequired;

    if (newDepositRequired > newPrice) {
        res.status(400);
        throw new Error('Deposit required cannot exceed the total job price.');
    }

    const job = await Job.findOneAndUpdate(
        { _id: id, company: companyId },
        { $set: updateFields },    // Use $set for updating fields
        { new: true, runValidators: true } // `new: true` returns the updated document, `runValidators: true` runs schema validators
    )
    .populate('customer', 'contactPersonName email phone address')
    .populate('staff', 'contactPersonName email phone role');

    if (!job) { // This check is redundant due to currentJob check above, but doesn't hurt.
        return res.status(404).json({ message: 'Job not found or not authorized.'});
    }

    res.status(200).json({ message: "Job updated successfully.", job: job });
});

const deleteJob = asyncHandler(async (req, res) => {
    const job = await Job.findOne({ _id: req.params.id, company: req.user.company._id });
    if (!job) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }
    await job.deleteOne();
    res.status(200).json({ message: 'Job deleted successfully.' });
});

const getInvoiceableJobs = asyncHandler(async (req, res) => {
    try {
        if (!req.user || !req.user.company || !req.user.company._id) {
            res.status(400);
            throw new Error('Authentication error: User or company information is missing.');
        }
        const companyId = req.user.company._id;
        const invoicedJobIds = await Invoice.find({ company: companyId }).distinct('job');
        const invoiceableJobs = await Job.find({ company: companyId, status: 'Completed', _id: { $nin: invoicedJobIds } }).populate('customer', 'contactPersonName');
        res.status(200).json(invoiceableJobs);
    } catch (error) {
        console.error('Error fetching invoiceable jobs:', error);
        res.status(500).json({ message: 'Server error while fetching invoiceable jobs.' });
    }
});

const clockInJob = asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job || job.company.toString() !== req.user.company._id.toString()) {
        res.status(404);
        throw new Error('Job not found');
    }
    if (req.user.role === 'staff' && !(job.staff || []).some(s => s.equals(req.user.staff._id))) { // Use staff._id for comparison
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }
    if (job.clockInTime) {
        res.status(400);
        throw new Error('Already clocked in for this job.');
    }
    job.clockInTime = new Date();
    job.status = 'In Progress';
    const updatedJob = await job.save();

    const populatedJobForResponse = await Job.findById(updatedJob._id)
        .populate('customer', 'contactPersonName email phone address')
        .populate('staff', 'contactPersonName email phone role');

    res.status(200).json(populatedJobForResponse);
});

const clockOutJob = asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job || job.company.toString() !== req.user.company._id.toString()) {
        res.status(404);
        throw new Error('Job not found');
    }
    if (req.user.role === 'staff' && !(job.staff || []).some(s => s.equals(req.user.staff._id))) { // Use staff._id for comparison
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }
    if (!job.clockInTime) {
        res.status(400);
        throw new Error('Cannot clock out, not clocked in yet.');
    }
    if (job.clockOutTime) {
        res.status(400);
        throw new Error('Already clocked out for this job.');
    }
    job.clockOutTime = new Date();
    job.status = 'Pending Completion';
    const updatedJob = await job.save();

    const populatedJobForResponse = await Job.findById(updatedJob._id)
        .populate('customer', 'contactPersonName email phone address')
        .populate('staff', 'contactPersonName email phone role');

    res.status(200).json(populatedJobForResponse);
});

const updateJobTask = asyncHandler(async (req, res) => {
    res.status(501).json({ message: 'Not Implemented' });
});

const uploadJobPhoto = asyncHandler(async (req, res) => {
    res.status(501).json({ message: 'Not Implemented' });
});

const returnJobStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { returnedStockItems, newStatus } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    let populatedJobForResponse;

    try {
        const job = await Job.findById(id).session(session);

        if (!job) {
            throw new Error('Job not found.');
        }
        if (job.company.toString() !== req.user.company._id.toString()) {
            throw new Error('Not authorized to modify this job.');

        }

        if (returnedStockItems && Array.isArray(returnedStockItems) && returnedStockItems.length > 0) {
            for (const item of returnedStockItems) {
                const { stockId, quantity } = item;
                if (!mongoose.Types.ObjectId.isValid(stockId) || typeof quantity !== 'number' || quantity < 0) {
                    console.warn(`Invalid stock return data for stockId ${stockId}. Skipping.`);
                    continue;
                }
                if (quantity > 0) {
                    await StockItem.findByIdAndUpdate(stockId, { $inc: { stockQuantity: quantity } }, { session });
                }
            }
        }

        job.status = newStatus;
        if (newStatus === 'Completed' && !job.completedAt) {
            job.completedAt = new Date();
        }

        const updatedJobDoc = await job.save({ session });

        populatedJobForResponse = await Job.findById(updatedJobDoc._id)
            .populate('customer', 'contactPersonName email phone address')
            .populate('staff', 'contactPersonName email phone role')
            .session(session);

        await session.commitTransaction();

    } catch (error) {
        await session.abortTransaction();
        console.error("Error in returnJobStock:", error);
        res.status(500).json({ message: error.message || 'Failed to complete job.' });
    } finally {
        session.endSession(); // Ensure session is always ended
    }

    if (newStatus === 'Completed') {
        console.log(`[Job Complete] Triggering background invoice processing for job ${id}.`);
        generateAndProcessInvoiceForJob(id, req.user).catch(err => {
            console.error(`[BACKGROUND_INVOICE_ERROR] Failed to auto-generate invoice for job ${id}:`, err.message);
        });
    }

    res.status(200).json({
        message: `Job marked as ${newStatus} and stock updated!`,
        job: populatedJobForResponse
    });
});

module.exports = {
    getJobs, getJobById, createJob, updateJob, deleteJob, getInvoiceableJobs,
    clockInJob, clockOutJob, updateJobTask, uploadJobPhoto, returnJobStock,
};