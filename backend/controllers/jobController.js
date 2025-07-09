// backend/controllers/jobController.js

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

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const extractTasksFromFormSchema = (formSchema) => {
    const tasks = [];
    if (!formSchema || !Array.isArray(formSchema)) return tasks;
    formSchema.forEach(row => {
        if (row.columns && Array.isArray(row.columns)) {
            row.columns.forEach(col => {
                if (col.fields && Array.isArray(col.fields)) {
                    col.fields.forEach(field => {
                        if (field.label && field.name) {
                            tasks.push({ taskId: field.name, description: field.label, isCompleted: false });
                        }
                    });
                }
            });
        }
    });
    return tasks;
};

const getJobs = asyncHandler(async (req, res) => {
    const companyId = req.user.company._id;
    const { staffId, startDate, endDate, status } = req.query;
    let query = { company: companyId };
    if (staffId) query.staff = staffId;
    if (startDate && endDate) query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    if (status) query.status = status;
    const jobs = await Job.find(query).populate('customer', 'contactPersonName email phone address').populate('staff', 'contactPersonName email phone role');
    res.status(200).json(jobs);
});

const getJobById = asyncHandler(async (req, res) => {
    const companyId = req.user.company._id;
    const job = await Job.findById(req.params.id).populate('customer', 'contactPersonName email phone address').populate('staff', 'contactPersonName email phone role');
    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }
    res.status(200).json(job);
});

const createJob = asyncHandler(async (req, res) => {
    const { customer, staff, serviceType, description, address, date, time, priority, price, usedStock, formTemplate } = req.body;
    const companyId = req.user.company._id;

    if (!customer || !staff || !Array.isArray(staff) || staff.length === 0 || !serviceType || !address || !date || typeof price !== 'number') {
        res.status(400);
        throw new Error('Missing or invalid required job fields.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const customerDoc = await Customer.findById(customer).session(session);
        if (!customerDoc) throw new Error('Customer not found.');

        const serviceAddress = customerDoc.serviceAddresses.find(sa => sa.street === address.street && sa.postcode === address.postcode) || customerDoc.address;
        const jobAddress = { ...address, payType: serviceAddress?.payType || 'Fixed', amount: serviceAddress?.amount || price };

        let jobTasks = [];
        if (formTemplate) {
            const form = await Form.findById(formTemplate).session(session);
            if (form) jobTasks = extractTasksFromFormSchema(form.schema);
        }

        const jobData = {
            company: companyId, customer, staff, serviceType, description, address: jobAddress, date, time,
            priority, price, usedStock: usedStock || [], formTemplate: formTemplate || null, tasks: jobTasks,
        };
        const newJobArray = await Job.create([jobData], { session });
        const newJob = newJobArray[0];

        if (usedStock && usedStock.length > 0) {
            for (const item of usedStock) {
                await StockItem.findByIdAndUpdate(item.stockId, { $inc: { stockQuantity: -item.quantity } }, { session, runValidators: true });
            }
        }
        await session.commitTransaction();
        // Populate the new job before sending it back
        const populatedNewJob = await Job.findById(newJob._id)
            .populate('customer', 'contactPersonName email phone address')
            .populate('staff', 'contactPersonName email phone role');

        res.status(201).json({ message: 'Job created successfully.', job: populatedNewJob });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating job:', error);
        res.status(500).json({ message: error.message || 'Failed to create job.' });
    } finally {
        session.endSession();
    }
});

const updateJob = asyncHandler(async (req, res) => {
    const job = await Job.findOneAndUpdate({ _id: req.params.id, company: req.user.company._id }, req.body, { new: true, runValidators: true })
        .populate('customer', 'contactPersonName email phone address') // Add population here
        .populate('staff', 'contactPersonName email phone role'); // Add population here
    if (!job) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }
    res.status(200).json(job);
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
    if (req.user.role === 'staff' && !job.staff.some(s => s.equals(req.user.staff))) {
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

    // Populate the updated job before sending it back
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
    if (req.user.role === 'staff' && !job.staff.some(s => s.equals(req.user.staff))) {
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }
    if (!job.clockInTime) {
        console.log(`DEBUG: Job ${req.params.id} clock-out failed: Not clocked in yet.`); // Debug log added
        res.status(400);
        throw new Error('Cannot clock out, not clocked in yet.');
    }
    if (job.clockOutTime) {
        console.log(`DEBUG: Job ${req.params.id} clock-out failed: Already clocked out.`); // Debug log added
        res.status(400);
        throw new Error('Already clocked out for this job.');
    }
    job.clockOutTime = new Date();
    job.status = 'Pending Completion';
    const updatedJob = await job.save();

    // Populate the updated job before sending it back
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
    const { id } = req.params; // Job ID
    const { returnedStockItems, newStatus } = req.body; // Data from the frontend
    const companyId = req.user.company._id; // Get company ID from authenticated user

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Find the job and ensure it belongs to the user's company
        const job = await Job.findById(id).session(session);

        if (!job || job.company.toString() !== companyId.toString()) {
            res.status(404);
            throw new Error('Job not found or not authorized for this company.');
        }

        // Optional: Check if the user is assigned to this job if role is 'staff'
        if (req.user.role === 'staff' && !job.staff.some(s => s.equals(req.user.staff))) {
            res.status(403);
            throw new Error('You are not assigned to this job and cannot complete it.');
        }

        // 2. Update stock quantities (only if returnedStockItems exists and has items)
        if (returnedStockItems && Array.isArray(returnedStockItems) && returnedStockItems.length > 0) {
            for (const item of returnedStockItems) {
                const { stockId, quantity } = item;

                if (!mongoose.Types.ObjectId.isValid(stockId)) {
                    console.warn(`Invalid stockId: ${stockId}. Skipping stock update for this item.`);
                    continue;
                }
                if (typeof quantity !== 'number' || quantity <= 0) {
                    console.warn(`Invalid quantity for stockId ${stockId}: ${quantity}. Skipping stock update.`);
                    continue;
                }

                const updatedStock = await StockItem.findOneAndUpdate(
                    { _id: stockId, company: companyId },
                    { $inc: { stockQuantity: quantity } },
                    { new: true, session: session, runValidators: true }
                );

                if (!updatedStock) {
                    console.warn(`Stock item ${stockId} not found or not authorized for company ${companyId}.`);
                }
            }
        }

        // 3. Update job status
        if (!newStatus) {
            res.status(400);
            throw new Error('New status is required to complete the job.');
        }
        job.status = newStatus;

        if (!job.completedAt && newStatus === 'Completed') {
            job.completedAt = new Date();
        }

        const updatedJobDoc = await job.save({ session }); // Save job changes within the transaction

        // Perform population *before* committing the transaction
        const populatedJobForResponse = await Job.findById(updatedJobDoc._id)
            .populate('customer', 'contactPersonName email phone address')
            .populate('staff', 'contactPersonName email phone role')
            .session(session); // Use the current session for this query

        await session.commitTransaction(); // Now commit the transaction

        // 4. Send back the populated job
        res.status(200).json({
            message: `Job marked as ${newStatus} and stock updated!`,
            job: populatedJobForResponse // Send the populated document
        });

    } catch (error) {
        await session.abortTransaction(); // Rollback any changes if an error occurs
        console.error("Error in returnJobStock:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Job ID or Stock Item ID.' });
        }
        if (res.statusCode === 200) {
            res.status(500);
        }
        res.json({ message: error.message || 'Server error: Failed to complete job or return stock.' });
    } finally {
        session.endSession(); // Ensure session is always closed
    }
});

module.exports = {
    getJobs, getJobById, createJob, updateJob, deleteJob, getInvoiceableJobs,
    clockInJob, clockOutJob, updateJobTask, uploadJobPhoto, returnJobStock,
};