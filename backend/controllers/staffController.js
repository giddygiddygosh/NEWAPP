// File: backend/controllers/staffController.js

const Staff = require('../models/Staff');
const User = require('../models/User');
const admin = require('firebase-admin');
const mongoose = require('mongoose');

// --- STAFF MANAGEMENT ---

/**
 * @desc    Get all staff members for a company (including their absences)
 * @route   GET /api/staff
 */
const getStaff = async (req, res) => {
    try {
        const companyId = req.user.company;
        const staffMembers = await Staff.find({ company: companyId })
            .sort({ contactPersonName: 1 })
            .select('+unavailabilityPeriods');
        res.status(200).json(staffMembers);
    } catch (error) {
        res.status(500).json({ message: 'Server Error getting staff' });
    }
};

/**
 * @desc    Get a single staff member by ID
 * @route   GET /api/staff/:id
 */
const getStaffById = async (req, res) => {
    try {
        const staffMember = await Staff.findOne({ _id: req.params.id, company: req.user.company })
            .select('+unavailabilityPeriods');
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }
        res.status(200).json(staffMember);
    } catch (error) {
        res.status(500).json({ message: 'Server Error getting staff member by ID' });
    }
};

/**
 * @desc    Add a new staff member
 * @route   POST /api/staff
 */
const createStaff = async (req, res) => {
    // Placeholder for your full working createStaff logic
    try {
        const newStaff = new Staff({ ...req.body, company: req.user.company });
        await newStaff.save();
        res.status(201).json({ message: 'Staff member created.', staff: newStaff });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create staff.' });
    }
};

/**
 * @desc    Update a staff member
 * @route   PUT /api/staff/:id
 */
const updateStaff = async (req, res) => {
    // Placeholder for your existing update logic
    try {
        const updatedStaff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ message: 'Staff member updated.', staff: updatedStaff });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update staff.' });
    }
};

/**
 * @desc    Delete a staff member
 * @route   DELETE /api/staff/:id
 */
const deleteStaff = async (req, res) => {
    // Placeholder for your existing delete logic
    try {
        await Staff.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Staff member deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete staff.' });
    }
};

// --- ABSENCE MANAGEMENT FUNCTIONS ---

/**
 * @desc    Get all absences for a single staff member
 * @route   GET /api/staff/:staffId/absences
 */
const getStaffAbsences = async (req, res) => {
    try {
        const { staffId } = req.params;
        if (req.user.role === 'staff' && req.user.staff.toString() !== staffId) {
            return res.status(403).json({ message: 'You are not authorized to view these absences.' });
        }
        const staffMember = await Staff.findOne({ _id: staffId, company: req.user.company })
            .select('+unavailabilityPeriods');
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }
        res.status(200).json(staffMember.unavailabilityPeriods);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching absences.' });
    }
};

/**
 * @desc    Add a new absence period to a staff member
 * @route   POST /api/staff/:staffId/absences
 */
const addStaffAbsence = async (req, res) => {
    try {
        const { staffId } = req.params;
        if (req.user.role === 'staff' && req.user.staff.toString() !== staffId) {
            return res.status(403).json({ message: 'You can only add absences for yourself.' });
        }
        const staffMember = await Staff.findOne({ _id: staffId, company: req.user.company });
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }
        staffMember.unavailabilityPeriods.push(req.body);
        await staffMember.save();
        const updatedStaff = await Staff.findById(staffId).select('+unavailabilityPeriods');
        res.status(201).json(updatedStaff.unavailabilityPeriods);
    } catch (error) {
        res.status(400).json({ message: 'Failed to add absence.', error: error.message });
    }
};

/**
 * @desc    Update an existing absence period
 * @route   PUT /api/staff/:staffId/absences/:absenceId
 */
const updateStaffAbsence = async (req, res) => {
    try {
        const { staffId, absenceId } = req.params;
        if (req.user.role === 'staff' && req.user.staff.toString() !== staffId) {
            return res.status(403).json({ message: 'You can only update your own absences.' });
        }
        const staffMember = await Staff.findOne({ _id: staffId, company: req.user.company }).select('+unavailabilityPeriods');
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }
        const absence = staffMember.unavailabilityPeriods.id(absenceId);
        if (!absence) {
            return res.status(404).json({ message: 'Absence period not found.' });
        }
        absence.set(req.body);
        await staffMember.save();
        res.status(200).json(staffMember.unavailabilityPeriods);
    } catch (error) {
        res.status(400).json({ message: 'Failed to update absence.', error: error.message });
    }
};

/**
 * @desc    Delete an absence period
 * @route   DELETE /api/staff/:staffId/absences/:absenceId
 */
const deleteStaffAbsence = async (req, res) => {
    try {
        const { staffId, absenceId } = req.params;
        if (req.user.role === 'staff' && req.user.staff.toString() !== staffId) {
            return res.status(403).json({ message: 'You can only delete your own absences.' });
        }
        const staffMember = await Staff.findOne({ _id: staffId, company: req.user.company }).select('+unavailabilityPeriods');
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }
        const absence = staffMember.unavailabilityPeriods.id(absenceId);
        if (!absence) {
            return res.status(404).json({ message: 'Absence period not found.' });
        }
        absence.remove();
        await staffMember.save();
        res.status(200).json(staffMember.unavailabilityPeriods);
    } catch (error) {
        res.status(500).json({ message: 'Server error while deleting absence.' });
    }
};

// Final, corrected export block including all functions
module.exports = {
    createStaff,
    getStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
    addStaffAbsence,
    updateStaffAbsence,
    deleteStaffAbsence,
    getStaffAbsences,
};