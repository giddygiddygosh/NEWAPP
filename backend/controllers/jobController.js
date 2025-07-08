// backend/controllers/jobController.js

const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const StockItem = require('../models/StockItem'); // Corrected to StockItem
const CompanySetting = require('../models/CompanySetting'); // For email automation checks
const sendTemplatedEmail = require('../utils/emailTriggerService'); // Your templated email service
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Form = require('../models/Form'); // NEW: Import Form model

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Helper function to extract tasks from a form schema.
 * Assumes tasks are defined as fields with a specific type or mapping.
 * This needs to match how your form builder defines "tasks".
 * For simplicity, let's assume tasks are fields with a 'type' of 'checkbox' or 'task'
 * that have a 'label' which becomes the 'description'.
 * Or, if your form builder has a dedicated 'task list' component, you'd parse that.
 *
 * A more robust solution might involve a specific field property in your form builder schema
 * like { name: "task1", label: "Inspect wiring", isTask: true, defaultCompleted: false }
 *
 * For now, let's assume any field with a 'task' purpose or 'checkbox' type in the schema
 * can be considered a task. Or, more simply, if the form purpose is 'reminder_task_list',
 * then all fields in its schema are tasks.
 */
const extractTasksFromFormSchema = (formSchema) => {
    const tasks = [];
    if (!formSchema || !Array.isArray(formSchema)) {
        return tasks;
    }

    // Assuming formSchema is an array of rows, each with columns and fields
    formSchema.forEach(row => {
        if (row.columns && Array.isArray(row.columns)) {
            row.columns.forEach(col => {
                if (col.fields && Array.isArray(col.fields)) {
                    col.fields.forEach(field => {
                        // If the form is a 'reminder_task_list', assume all fields are tasks.
                        // Or, if a field has a specific 'isTask' property set by your builder.
                        // For demonstration, let's just take label/name as description.
                        if (field.label && field.name) { // Ensure it has a label and a name
                            tasks.push({
                                taskId: field.name, // Use field.name as a unique ID for the task
                                description: field.label, // Use field.label as the task description
                                isCompleted: false, // Default to not completed
                            });
                        }
                    });
                }
            });
        }
    });
    return tasks;
};


/**
 * @desc Get all jobs for a company (with optional filters for staff)
 * @route GET /api/jobs
 * @access Private
 */
const getJobs = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const { staffId, startDate, endDate, status } = req.query;

    let query = { company: companyId };

    if (staffId) {
        query.staff = staffId;
    }
    if (startDate && endDate) {
        query.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }
    if (status) {
        query.status = status;
    }

    // Populate customer and staff details
    const jobs = await Job.find(query)
        .populate('customer', 'contactPersonName email phone address')
        .populate('staff', 'contactPersonName email phone role');

    res.status(200).json(jobs);
});

/**
 * @desc Get a single job by ID
 * @route GET /api/jobs/:id
 * @access Private
 */
const getJobById = asyncHandler(async (req, res) => {
    const companyId = req.user.company;

    const job = await Job.findById(req.params.id)
        .populate('customer', 'contactPersonName email phone address')
        .populate('staff', 'contactPersonName email phone role');

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    res.status(200).json(job);
});

/**
 * @desc Create a new job
 * @route POST /api/jobs
 * @access Private (Admin, Manager)
 */
const createJob = asyncHandler(async (req, res) => {
    console.log('Backend received job creation request with body (req.body):', JSON.stringify(req.body, null, 2));
    const { customer, staff, serviceType, description, address, date, time, priority, price, usedStock, formTemplate } = req.body; // NEW: Receive formTemplate
    const companyId = req.user.company;

    let missingFields = [];

    if (!customer) missingFields.push('customer');
    if (!staff || !Array.isArray(staff) || staff.length === 0) missingFields.push('staff');
    if (!serviceType) missingFields.push('serviceType');
    if (!address || (Object.keys(address).length === 0 && !address.street && !address.city && !address.postcode && !address.country)) missingFields.push('address');
    if (!date) missingFields.push('date');
    if (typeof price !== 'number') missingFields.push('price');

    if (missingFields.length > 0) {
        res.status(400);
        const errorMessage = `Missing or invalid required job fields: ${missingFields.join(', ')}.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let jobTasks = [];
        // NEW: If a formTemplate is provided, extract tasks from its schema
        if (formTemplate) {
            const form = await Form.findById(formTemplate).session(session);
            if (!form) {
                await session.abortTransaction();
                session.endSession();
                res.status(404);
                throw new Error(`Task list form with ID ${formTemplate} not found.`);
            }
            // Only extract tasks if the form's purpose is 'reminder_task_list'
            if (form.purpose === 'reminder_task_list') {
                jobTasks = extractTasksFromFormSchema(form.schema);
                console.log(`Extracted ${jobTasks.length} tasks from form template ${form.name}.`);
            } else {
                console.warn(`Form template ${form.name} (ID: ${formTemplate}) is not a 'reminder_task_list' purpose. Tasks will not be initialized from it.`);
            }
        }

        // Create the job
        const job = await Job.create([{
            company: companyId,
            customer,
            staff: staff,
            serviceType,
            description,
            address,
            date,
            time,
            priority,
            price,
            usedStock: usedStock || [],
            formTemplate: formTemplate || null, // NEW: Save the formTemplate ID
            tasks: jobTasks, // NEW: Initialize tasks from the template
        }], { session });

        const newJob = job[0];

        // Deduct used stock quantities from inventory
        if (usedStock && usedStock.length > 0) {
            for (const item of usedStock) {
                const stockItem = await StockItem.findById(item.stockId).session(session);
                if (!stockItem || stockItem.company.toString() !== companyId.toString()) {
                    await session.abortTransaction();
                    session.endSession();
                    res.status(404);
                    throw new Error(`Stock item with ID ${item.stockId} not found or not authorized.`);
                }
                if (stockItem.stockQuantity < item.quantity) {
                    await session.abortTransaction();
                    session.endSession();
                    res.status(400);
                    throw new Error(`Not enough ${stockItem.name} in stock. Available: ${stockItem.stockQuantity}, Requested: ${item.quantity}`);
                }
                stockItem.stockQuantity -= item.quantity;
                await stockItem.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: 'Job created successfully and stock deducted.',
            job: newJob,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            console.error('Mongoose Validation Error:', errors.join(', '));
            res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        } else {
            console.error('Error creating job or deducting stock (catch block):', error);
            res.status(500).json({ message: error.message || 'Failed to create job.' });
        }
    }
});

/**
 * @desc Update a job
 * @route PUT /api/jobs/:id
 * @access Private (Admin, Manager)
 */
const updateJob = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const { usedStock, formTemplate, tasks, ...updateData } = req.body; // NEW: Receive formTemplate and tasks for update
    const job = await Job.findById(req.params.id);

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Handle stock changes if usedStock is provided
        if (usedStock) {
            console.warn("Stock update logic in updateJob is not fully implemented. Consider separate endpoints for stock adjustments.");
            job.usedStock = usedStock; // Directly assign for now, but advise caution
        }

        // NEW: Handle formTemplate and tasks update
        if (formTemplate !== undefined) { // Check if formTemplate was sent
            job.formTemplate = formTemplate;
            // If formTemplate is changed, re-initialize tasks from new template
            if (formTemplate && job.formTemplate?.toString() !== formTemplate) { // If changed to a new template
                const form = await Form.findById(formTemplate).session(session);
                if (form && form.purpose === 'reminder_task_list') {
                    job.tasks = extractTasksFromFormSchema(form.schema);
                    console.log(`Re-initialized tasks from new template ${form.name} for job ${job._id}.`);
                } else {
                    job.tasks = []; // Clear tasks if template is removed or not a task list
                    console.warn(`Form template ${formTemplate} is not a 'reminder_task_list' purpose or not found. Tasks for job ${job._id} cleared.`);
                }
            } else if (!formTemplate) { // If formTemplate is being cleared
                job.tasks = [];
            }
        }
        // If tasks are sent directly (e.g., from JobDetailsModal updates), merge them
        if (tasks && Array.isArray(tasks)) {
            // This logic allows partial updates to tasks (e.g., just changing isCompleted)
            // It iterates through incoming tasks and updates matching ones in job.tasks
            // For new tasks in the incoming 'tasks' array, they would be added.
            // For simplicity, let's assume tasks array from frontend is the source of truth for updates
            job.tasks = tasks; // Overwrite with frontend's task list for now
        }


        // Update other job fields
        Object.assign(job, updateData);

        const updatedJob = await job.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: 'Job updated successfully.',
            job: updatedJob,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error updating job:', error);
        res.status(500).json({ message: error.message || 'Failed to update job.' });
    }
});

/**
 * @desc Delete a job
 * @route DELETE /api/jobs/:id
 * @access Private (Admin, Manager)
 */
const deleteJob = asyncHandler(async (req, res) => {
    const companyId = req.user.company;

    const job = await Job.findById(req.params.id);

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Revert used stock quantities back to inventory if job is deleted
        if (job.usedStock && job.usedStock.length > 0) {
            for (const item of job.usedStock) {
                const stockItem = await StockItem.findById(item.stockId).session(session);
                if (stockItem) {
                    stockItem.stockQuantity += item.quantity;
                    await stockItem.save({ session });
                } else {
                    console.warn(`Stock item with ID ${item.stockId} not found during job deletion. Cannot revert stock.`);
                }
            }
        }

        // Revert returned stock quantities if job is deleted (e.g., if job was marked complete and then deleted)
        if (job.returnedStock && job.returnedStock.length > 0) {
            for (const item of job.returnedStock) {
                const stockItem = await StockItem.findById(item.stockId).session(session);
                if (stockItem) {
                    stockItem.stockQuantity -= item.quantity; // Deduct returned stock if it was added back
                    await stockItem.save({ session });
                } else {
                    console.warn(`Returned stock item with ID ${item.stockId} not found during job deletion. Cannot revert returned stock.`);
                }
            }
        }

        await Job.deleteOne({ _id: req.params.id }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Job deleted successfully and stock reverted.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting job:', error);
        res.status(500).json({ message: error.message || 'Failed to delete job.' });
    }
});

// --- NEW STAFF JOB ACTION ENDPOINTS ---

/**
 * @desc Staff clocks in for a job
 * @route PUT /api/jobs/:id/clock-in
 * @access Private (Staff)
 */
const clockInJob = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const staffId = req.user.staff._id; // Get staff ID from authenticated user

    const job = await Job.findById(req.params.id);

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    if (job.staff.toString() !== staffId.toString()) {
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }

    if (job.clockInTime) {
        res.status(400);
        throw new Error('Already clocked in for this job.');
    }

    job.clockInTime = new Date();
    // Optionally change status to 'In Progress' upon clock-in
    if (job.status === 'Booked' || job.status === 'On Route') {
        job.status = 'In Progress';
    }

    const updatedJob = await job.save();
    res.status(200).json({ message: 'Clocked in successfully.', job: updatedJob });
});

/**
 * @desc Staff clocks out from a job
 * @route PUT /api/jobs/:id/clock-out
 * @access Private (Staff)
 */
const clockOutJob = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const staffId = req.user.staff._id;

    const job = await Job.findById(req.params.id);

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    if (job.staff.toString() !== staffId.toString()) {
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }

    if (!job.clockInTime) {
        res.status(400);
        throw new Error('Cannot clock out: not clocked in for this job.');
    }

    if (job.clockOutTime) {
        res.status(400);
        throw new new Error('Already clocked out for this job.');
    }

    job.clockOutTime = new Date();
    // Optionally change status to 'Pending Completion' upon clock-out
    if (job.status === 'In Progress') {
        job.status = 'Pending Completion';
    }

    const updatedJob = await job.save();
    res.status(200).json({ message: 'Clocked out successfully.', job: updatedJob });
});

/**
 * @desc Staff updates task completion status for a job
 * @route PUT /api/jobs/:id/tasks/:taskId
 * @access Private (Staff)
 */
const updateJobTask = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const staffId = req.user.staff._id;
    const { id: jobId, taskId } = req.params;
    const { isCompleted } = req.body;

    const job = await Job.findById(jobId);

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    if (job.staff.toString() !== staffId.toString()) {
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }

    const task = job.tasks.find(t => t.taskId === taskId);

    if (!task) {
        res.status(404);
        throw new Error('Task not found for this job.');
    }

    task.isCompleted = isCompleted;
    task.completedAt = isCompleted ? new Date() : null;

    const updatedJob = await job.save();
    res.status(200).json({ message: 'Task updated successfully.', job: updatedJob });
});

/**
 * @desc Staff uploads photos for a job
 * @route POST /api/jobs/:id/photos
 * @access Private (Staff)
 * @body {string} url - URL of the uploaded photo
 * @body {string} label - Description of the photo
 */
const uploadJobPhoto = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const staffId = req.user.staff._id;
    const { id: jobId } = req.params;
    const { url, label, type } = req.body; // Assuming 'url' is provided by a separate file upload service

    if (!url || !label) {
        res.status(400);
        throw new Error('Photo URL and label are required.');
    }

    const job = await Job.findById(jobId);

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    if (job.staff.toString() !== staffId.toString()) {
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }

    job.photos.push({ url, label, type: type || 'other' });

    const updatedJob = await job.save();
    res.status(201).json({ message: 'Photo uploaded successfully.', job: updatedJob });
});

/**
 * @desc Staff returns unused stock items for a job
 * @route POST /api/jobs/:id/return-stock
 * @access Private (Staff)
 * @body {Object[]} returnedStockItems - Array of { stockId, quantity }
 * @body {string} [newStatus] - Optional new status for the job (e.g., 'Completed')
 */
const returnJobStock = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const staffId = req.user.staff._id;
    const { id: jobId } = req.params;
    const { returnedStockItems, newStatus } = req.body; // newStatus is optional

    if (!Array.isArray(returnedStockItems)) {
        res.status(400);
        throw new Error('Returned stock items must be an array.');
    }

    const job = await Job.findById(jobId);

    if (!job || job.company.toString() !== companyId.toString()) {
        res.status(404);
        throw new Error('Job not found or not authorized.');
    }

    if (job.staff.toString() !== staffId.toString()) {
        res.status(403);
        throw new Error('You are not assigned to this job.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const companySettings = await CompanySetting.findOne({ company: companyId }).session(session);

        for (const item of returnedStockItems) {
            const { stockId, quantity } = item;
            if (quantity <= 0) continue; // Only process positive quantities

            const stockItem = await StockItem.findById(stockId).session(session);
            if (!stockItem || stockItem.company.toString() !== companyId.toString()) {
                await session.abortTransaction();
                session.endSession();
                res.status(404);
                throw new Error(`Stock item with ID ${stockId} not found or not authorized.`);
            }

            // Add quantity back to stock inventory
            stockItem.stockQuantity += quantity;
            await stockItem.save({ session });

            // Record the returned stock on the job
            job.returnedStock.push({ stockId, name: stockItem.name, quantity, returnedAt: new Date() });
        }

        // Update job status if provided
        if (newStatus && job.status !== newStatus) {
            job.status = newStatus;

            // If job is being marked 'Completed', trigger job_completion email
            if (newStatus === 'Completed') {
                const customer = await mongoose.model('Customer').findById(job.customer).session(session);
                if (customer) {
                    await sendTemplatedEmail(
                        'job_completion',
                        companyId,
                        customer.email,
                        {
                            customerName: customer.contactPersonName,
                            serviceType: job.serviceType,
                            jobId: job._id.toString(),
                            companyName: companySettings?.companyName || 'Your Company', // Assuming companySettings has companyName
                            // Add other job details for the template
                        },
                        'Job Completion'
                    );
                }
            }
        }

        const updatedJob = await job.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Stock returned and job updated successfully.', job: updatedJob });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error returning stock or updating job:', error);
        res.status(500).json({ message: error.message || 'Failed to return stock.' });
    }
});


module.exports = {
    getJobs,
    getJobById,
    createJob,
    updateJob,
    deleteJob,
    // Export new staff job actions
    clockInJob,
    clockOutJob,
    updateJobTask,
    uploadJobPhoto,
    returnJobStock,
};
