// backend/controllers/formController.js

const Form = require('../models/Form'); // Assuming you have a Form model
const Submission = require('../models/Submission'); // Assuming you have a Submission model
const Customer = require('../models/Customer'); // Assuming you have a Customer model
const Lead = require('../models/Lead'); // Assuming you have a Lead model
const mongoose = require('mongoose');

/**
 * @desc Create a new form
 * @route POST /api/forms
 * @access Private (Admin)
 */
exports.createForm = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { name, schema, purpose, companySpecific } = req.body;
        const companyId = req.user.company; // Company from authenticated user

        if (!name || !schema || !purpose) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Form name, schema, and purpose are required.' });
        }

        const newForm = new Form({
            name,
            schema,
            purpose,
            company: companyId,
            companySpecific: companySpecific !== undefined ? companySpecific : true, // Default to company specific
        });

        await newForm.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ message: 'Form created successfully', form: newForm });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating form:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A form with this name already exists for your company.' });
        }
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to create form.', error: error.message });
    }
};

/**
 * @desc Get all forms for a company
 * @route GET /api/forms
 * @access Private (Admin, Manager)
 */
exports.getForms = async (req, res) => {
    try {
        const companyId = req.user.company;
        const forms = await Form.find({
            $or: [
                { company: companyId },
                { companySpecific: false } // Include global forms if any
            ]
        }).sort({ createdAt: -1 });
        res.status(200).json(forms);
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Get a single form by ID
 * @route GET /api/forms/:id
 * @access Private (Admin, Manager)
 */
exports.getFormById = async (req, res) => {
    try {
        const formId = req.params.id;
        const companyId = req.user.company;

        const form = await Form.findOne({
            _id: formId,
            $or: [
                { company: companyId },
                { companySpecific: false }
            ]
        });

        if (!form) {
            return res.status(404).json({ message: 'Form not found or not authorized.' });
        }
        res.status(200).json(form);
    } catch (error) {
        console.error('Error fetching form:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Update a form by ID
 * @route PUT /api/forms/:id
 * @access Private (Admin)
 */
exports.updateForm = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const formId = req.params.id;
        const companyId = req.user.company;
        const { name, schema, purpose, companySpecific } = req.body;

        const form = await Form.findOne({ _id: formId, company: companyId }).session(session);

        if (!form) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Form not found or not authorized.' });
        }

        form.name = name || form.name;
        form.schema = schema || form.schema;
        form.purpose = purpose || form.purpose;
        form.companySpecific = companySpecific !== undefined ? companySpecific : form.companySpecific;
        form.updatedAt = Date.now();

        await form.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Form updated successfully', form });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error updating form:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A form with this name already exists for your company.' });
        }
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to update form.', error: error.message });
    }
};

/**
 * @desc Delete a form by ID
 * @route DELETE /api/forms/:id
 * @access Private (Admin)
 */
exports.deleteForm = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const formId = req.params.id;
        const companyId = req.user.company;

        const deletedForm = await Form.findOneAndDelete({ _id: formId, company: companyId }).session(session);

        if (!deletedForm) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Form not found or not authorized.' });
        }

        // Also delete any submissions linked to this form
        await Submission.deleteMany({ form: formId }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Form and associated submissions deleted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting form:', error);
        res.status(500).json({ message: 'Failed to delete form.', error: error.message });
    }
};