const Form = require('../models/Form');
const Submission = require('../models/Submission');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

const isValueEmpty = (value) => {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
};


exports.createForm = asyncHandler(async (req, res) => {
    const { name, formSchema, settings, purpose } = req.body;
    const adminId = req.user.id;

    if (!name || !formSchema || !purpose) {
        return res.status(400).json({ message: 'Form name, schema, and purpose are required.' });
    }

    const newForm = new Form({
        name,
        formSchema,
        settings,
        purpose,
        adminId: adminId,
        isActive: false
    });

    await newForm.save();
    res.status(201).json({ message: 'Form created successfully', form: newForm });
});

// ================== THIS IS THE CORRECTED FUNCTION ==================
exports.getForms = asyncHandler(async (req, res) => {
    // Start with the base query to get forms for the current user's company
    const query = { adminId: req.user.id };

    // If the request URL includes a 'purpose' (like 'reminder_task_list'),
    // add it to the database search criteria.
    if (req.query.purpose) {
        query.purpose = req.query.purpose;
    }

    const forms = await Form.find(query).sort({ updatedAt: -1 });
    res.status(200).json(forms);
});
// ====================================================================

exports.getFormById = asyncHandler(async (req, res) => {
    const formId = req.params.id;
    const adminId = req.user.id;
    const form = await Form.findOne({ _id: formId, adminId: adminId });
    if (!form) {
        return res.status(404).json({ message: 'Form not found or you are not authorized to view it.' });
    }
    res.status(200).json(form);
});

exports.updateForm = asyncHandler(async (req, res) => {
    const formId = req.params.id;
    const adminId = req.user.id;
    const { name, formSchema, settings, purpose } = req.body;

    const form = await Form.findOne({ _id: formId, adminId: adminId });
    if (!form) {
        return res.status(404).json({ message: 'Form not found or not authorized.' });
    }

    form.name = name || form.name;
    form.formSchema = formSchema || form.formSchema;
    form.settings = settings || form.settings;
    form.purpose = purpose || form.purpose;

    const updatedForm = await form.save();
    res.status(200).json({ message: 'Form updated successfully', form: updatedForm });
});

exports.activateForm = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const formIdToActivate = req.params.id;
        const adminId = req.user.id;

        const formToActivate = await Form.findOne({ _id: formIdToActivate, adminId: adminId }).session(session);
        if (!formToActivate) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Form not found or not authorized.' });
        }

        await Form.updateMany(
            { adminId: adminId, purpose: formToActivate.purpose, _id: { $ne: formIdToActivate } },
            { $set: { isActive: false } },
            { session }
        );

        formToActivate.isActive = true;
        await formToActivate.save({ session });

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: `Form '${formToActivate.name}' is now the active ${formToActivate.purpose} form.` });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Failed to activate form.', error: error.message });
    }
});

exports.deactivateForm = asyncHandler(async (req, res) => {
    const formIdToDeactivate = req.params.id;
    const adminId = req.user.id;

    const formToDeactivate = await Form.findOne({ _id: formIdToDeactivate, adminId: adminId });

    if (!formToDeactivate) {
        return res.status(404).json({ message: 'Form not found or not authorized.' });
    }

    formToDeactivate.isActive = false;
    await formToDeactivate.save();

    res.status(200).json({ message: `Form '${formToDeactivate.name}' deactivated successfully.` });
});

exports.deleteForm = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const formId = req.params.id;
        const adminId = req.user.id;
        const deletedForm = await Form.findOneAndDelete({ _id: formId, adminId: adminId }).session(session);
        if (!deletedForm) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Form not found or not authorized.' });
        }
        await Submission.deleteMany({ form: formId }).session(session);
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: 'Form and associated submissions deleted successfully.' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Failed to delete form.', error: error.message });
    }
});