// backend/controllers/absenceController.js

const Absence = require('../models/Absence');
const Staff = require('../models/Staff'); // Needed for some checks/linking
const mongoose = require('mongoose');

/**
 * @desc Create a new absence period
 * @route POST /api/absences
 * @access Private (Admin, Manager, Staff)
 */
const createAbsence = async (req, res) => {
    try {
        const { staff: staffId, start, end, type, reason } = req.body;
        const companyId = req.user.company;
        const requestingUserRole = req.user.role;
        const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

        if (!staffId || !start || !end || !type) {
            return res.status(400).json({ message: 'Staff ID, start date, end date, and type are required.' });
        }

        // Authorization: A staff member can only create absence for themselves
        if (requestingUserRole === 'staff' && staffId !== requestingUserStaffId) {
            return res.status(403).json({ message: 'Staff can only create absence periods for themselves.' });
        }

        // Validate staff member belongs to the user's company
        const staffMember = await Staff.findOne({ _id: staffId, company: companyId });
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found or not authorized for your company.' });
        }

        // Basic date validation
        if (new Date(start) >= new Date(end)) {
            return res.status(400).json({ message: 'End date must be after start date.' });
        }

        const newAbsence = new Absence({
            staff: staffId,
            company: companyId,
            start,
            end,
            type,
            reason
        });

        await newAbsence.save();
        res.status(201).json({ message: 'Absence period created successfully', absence: newAbsence });

    } catch (error) {
        console.error('Error creating absence period:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to create absence period.', error: error.message });
    }
};

/**
 * @desc Get all absence periods for the company (Admin/Manager only)
 * @route GET /api/absences
 * @access Private (Admin, Manager)
 */
const getAbsences = async (req, res) => {
    try {
        const companyId = req.user.company;
        const { startDate, endDate, staffId, type } = req.query;

        let query = { company: companyId };

        if (startDate && endDate) {
            query.start = { $lte: new Date(endDate) }; // Absences ending after or on endDate
            query.end = { $gte: new Date(startDate) };  // Absences starting before or on startDate
        }
        if (staffId) {
            query.staff = staffId;
        }
        if (type) {
            query.type = type;
        }

        const absences = await Absence.find(query)
            .populate('staff', 'contactPersonName email') // Get staff details for each absence
            .sort({ start: 1, staff: 1 });

        res.status(200).json(absences);
    } catch (error) {
        console.error('Error fetching absence periods:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Get a single absence period by ID
 * @route GET /api/absences/:id
 * @access Private (Admin, Manager, Staff - if owner)
 */
const getAbsenceById = async (req, res) => {
    try {
        const absenceId = req.params.id;
        const companyId = req.user.company;
        const requestingUserRole = req.user.role;
        const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

        const absence = await Absence.findOne({ _id: absenceId, company: companyId })
            .populate('staff', 'contactPersonName email');

        if (!absence) {
            return res.status(404).json({ message: 'Absence period not found or not authorized.' });
        }

        // Authorization: Staff can only view their own absence
        if (requestingUserRole === 'staff' && absence.staff._id.toString() !== requestingUserStaffId) {
            return res.status(403).json({ message: 'Not authorized to view this absence period.' });
        }

        res.status(200).json(absence);
    } catch (error) {
        console.error('Error fetching absence period:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Update an existing absence period
 * @route PUT /api/absences/:id
 * @access Private (Admin, Manager, Staff - if owner)
 */
const updateAbsence = async (req, res) => {
    try {
        const absenceId = req.params.id;
        const companyId = req.user.company;
        const requestingUserRole = req.user.role;
        const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

        const { start, end, type, reason } = req.body;

        let absence = await Absence.findOne({ _id: absenceId, company: companyId });

        if (!absence) {
            return res.status(404).json({ message: 'Absence period not found or not authorized.' });
        }

        // Authorization: Staff can only update their own absence
        if (requestingUserRole === 'staff' && absence.staff.toString() !== requestingUserStaffId) {
            return res.status(403).json({ message: 'Not authorized to update this absence period.' });
        }

        // Apply updates
        absence.start = start || absence.start;
        absence.end = end || absence.end;
        absence.type = type || absence.type;
        absence.reason = reason !== undefined ? reason : absence.reason;
        absence.updatedAt = Date.now();

        // Basic date validation after applying updates
        if (new Date(absence.start) >= new Date(absence.end)) {
            return res.status(400).json({ message: 'End date must be after start date.' });
        }

        await absence.save();
        res.status(200).json({ message: 'Absence period updated successfully', absence });

    } catch (error) {
        console.error('Error updating absence period:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Failed to update absence period.', error: error.message });
    }
};

/**
 * @desc Delete an absence period
 * @route DELETE /api/absences/:id
 * @access Private (Admin, Manager, Staff - if owner)
 */
const deleteAbsence = async (req, res) => {
    try {
        const absenceId = req.params.id;
        const companyId = req.user.company;
        const requestingUserRole = req.user.role;
        const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

        const absence = await Absence.findOne({ _id: absenceId, company: companyId });

        if (!absence) {
            return res.status(404).json({ message: 'Absence period not found or not authorized.' });
        }

        // Authorization: Staff can only delete their own absence
        if (requestingUserRole === 'staff' && absence.staff.toString() !== requestingUserStaffId) {
            return res.status(403).json({ message: 'Not authorized to delete this absence period.' });
        }

        await Absence.deleteOne({ _id: absenceId });
        res.status(200).json({ message: 'Absence period deleted successfully.' });

    } catch (error) {
        console.error('Error deleting absence period:', error);
        res.status(500).json({ message: 'Failed to delete absence period.', error: error.message });
    }
};

/**
 * @desc Get all absence periods for a specific staff member
 * @route GET /api/absences/staff/:staffId
 * @access Private (Admin, Manager, Staff - if owner)
 */
const getStaffAbsences = async (req, res) => {
    // --- TEMPORARY DEBUG HANDLER ---
    console.log("DEBUG (Controller): getStaffAbsences route HIT!");
    console.log("DEBUG (Controller): staffId from params:", req.params.staffId);
    res.status(200).json({ message: "Absences staff route hit successfully (temp response)." });
    // --- END TEMPORARY DEBUG HANDLER ---

    // IMPORTANT: Keep your original getStaffAbsences code commented out below for easy revert
    /*
    try {
        const staffId = req.params.staffId;
        const companyId = req.user.company;
        const requestingUserRole = req.user.role;
        const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

        // Authorization: Staff can only view their own absences
        if (requestingUserRole === 'staff' && staffId !== requestingUserStaffId) {
            return res.status(403).json({ message: 'Not authorized to view absences for this staff member.' });
        }

        // Validate staff member belongs to the user's company
        const staffMember = await Staff.findOne({ _id: staffId, company: companyId });
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found or not authorized for your company.' });
        }

        const absences = await Absence.find({ staff: staffId, company: companyId }).sort({ start: 1 });

        res.status(200).json(absences);
    } catch (error) {
        console.error('Error fetching staff absences:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
    */
};


module.exports = {
    createAbsence,
    getAbsences,
    getAbsenceById,
    updateAbsence,
    deleteAbsence,
    getStaffAbsences
};