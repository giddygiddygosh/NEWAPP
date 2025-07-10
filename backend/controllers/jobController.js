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
// --- NEW: Import the invoice service ---
const { generateAndProcessInvoiceForJob } = require('../services/invoiceService');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- (All functions before returnJobStock remain the same) ---

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
    const { customer, staff, serviceType, description, address, date, time, priority, price, usedStockItems, formTemplate } = req.body;
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
        
        const formattedUsedStock = (usedStockItems || []).map(item => ({
            stockId: item.stockItem,
            name: item.name,
            quantity: item.quantityUsed
        }));

        const jobData = {
            company: companyId, customer, staff, serviceType, description, address: jobAddress, date, time,
            priority, price, 
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
        'price', 'status', 'notes', 'duration'
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
        updateFields.staff = data.staff.map(s => (typeof s === 'object' && s !== null) ? s._id : s).filter(Boolean);
    }
    
    if (data.usedStockItems !== undefined && Array.isArray(data.usedStockItems)) {
        updateFields.usedStock = data.usedStockItems.map(item => ({
             stockId: item.stockItem || item.stockId,
             name: item.name,
             quantity: item.quantityUsed || item.quantity
        }));
    }

    const job = await Job.findOneAndUpdate(
        { _id: id, company: companyId },
        { $set: updateFields }, 
        { new: true, runValidators: true }
    )
    .populate('customer', 'contactPersonName email phone address')
    .populate('staff', 'contactPersonName email phone role');
    
    if (!job) {
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


// --- THIS IS THE UPDATED FUNCTION ---
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
        session.endSession();
        return;
    } finally {
        session.endSession();
    }

    // --- AUTOMATION TRIGGER ---
    // After the transaction is successful, trigger invoice generation in the background.
    if (newStatus === 'Completed') {
        console.log(`[Job Complete] Triggering background invoice processing for job ${id}.`);
        // We do NOT 'await' this, so the user gets an immediate response.
        generateAndProcessInvoiceForJob(id, req.user).catch(err => {
            // Log any errors from the background process.
            console.error(`[BACKGROUND_INVOICE_ERROR] Failed to auto-generate invoice for job ${id}:`, err.message);
        });
    }

    // Respond to the user immediately.
    res.status(200).json({
        message: `Job marked as ${newStatus} and stock updated!`,
        job: populatedJobForResponse
    });
});

module.exports = {
    getJobs, getJobById, createJob, updateJob, deleteJob, getInvoiceableJobs,
    clockInJob, clockOutJob, updateJobTask, uploadJobPhoto, returnJobStock,
};
