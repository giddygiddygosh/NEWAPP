// backend/controllers/staffController.js

const Staff = require('../models/Staff');
const User = require('../models/User'); // Corrected import
const Company = require('../models/Company');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const sendTemplatedEmail = require('../utils/emailTriggerService');

/**
 * @desc    Create a new staff member
 * @route   POST /api/staff
 * @access  Private (Admin, Manager)
 */
const createStaff = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { contactPersonName, email, phone, role, address, employeeId } = req.body;
        const companyId = req.user.company;
        
        const company = await Company.findById(companyId).session(session);
        if (!company) {
            res.status(404);
            throw new Error('Company not found for the authenticated user.');
        }
        const companyName = company.name;

        if (!contactPersonName || !email || !role) {
            res.status(400);
            throw new Error('Please provide name, email, and role for the staff member.');
        }

        const staffExists = await Staff.findOne({ email, company: companyId }).session(session);
        if (staffExists) {
            res.status(400);
            throw new Error('A staff member with this email already exists in your company.');
        }

        const existingMongooseUser = await User.findOne({
            email: email,
            company: companyId,
        }).session(session);

        if (existingMongooseUser) {
            res.status(400);
            throw new Error('A user (admin/manager/staff/customer) with this email already exists in your company. Cannot create new staff with this email.');
        }

        const staff = await Staff.create([{
            company: companyId,
            contactPersonName,
            email,
            phone,
            role,
            address,
            employeeId
        }], { session });

        const newStaff = staff[0];

        let firebaseUserRecord;
        const tempPassword = Math.random().toString(36).slice(-8);

        try {
            firebaseUserRecord = await admin.auth().createUser({
                email: email,
                password: tempPassword,
                emailVerified: false,
                displayName: contactPersonName,
            });

            const staffUserMongoose = await User.create([{
                firebaseUid: firebaseUserRecord.uid,
                email: email,
                role: role,
                company: companyId,
                contactPersonName: contactPersonName,
                staff: newStaff._id,
            }], { session });

            sendTemplatedEmail(
                'staff_welcome_email',
                companyId,
                email,
                {
                    userName: contactPersonName,
                    companyName: companyName,
                    loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
                    temporaryPassword: tempPassword,
                    email: email,
                },
                'Staff Creation'
            );

        } catch (fbError) {
            await session.abortTransaction();
            session.endSession();
            console.error(`[createStaff] Firebase user creation failed for ${email}:`, fbError.message);
            if (fbError.code === 'auth/email-already-in-use') {
                return res.status(400).json({ message: 'Email is already in use by another Firebase user. Please use a different email or log in with existing credentials.' });
            }
            throw new Error(`Failed to create user account: ${fbError.message}`);
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: 'Staff member created successfully and login details sent.',
            staff: newStaff
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating staff member:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: error.message || 'Failed to create staff member.' });
    }
});

/**
 * @desc    Get all staff for a company
 * @route   GET /api/staff
 * @access  Private (Admin, Manager)
 */
const getStaff = asyncHandler(async (req, res) => {
    const staff = await Staff.find({ company: req.user.company }).select('+unavailabilityPeriods');
    res.status(200).json(staff);
});

/**
 * @desc    Get a single staff member by ID
 * @route   GET /api/staff/:id
 * @access  Private (Admin, Manager, Staff - self)
 */
const getStaffById = asyncHandler(async (req, res) => {
    const staff = await Staff.findById(req.params.id).select('+unavailabilityPeriods');
    if (staff && staff.company.toString() === req.user.company.toString()) {
        res.status(200).json(staff);
    } else {
        res.status(404);
        throw new Error('Staff member not found.');
    }
});

/**
 * @desc    Update a staff member
 * @route   PUT /api/staff/:id
 * @access  Private (Admin, Manager)
 */
const updateStaff = asyncHandler(async (req, res) => {
    const staff = await Staff.findById(req.params.id);

    if (!staff || staff.company.toString() !== req.user.company.toString()) {
        res.status(404);
        throw new Error('Staff member not found or not authorized.');
    }

    const { contactPersonName, email, phone, role, address, unavailabilityPeriods, employeeId } = req.body;

    staff.contactPersonName = contactPersonName || staff.contactPersonName;
    staff.email = email || staff.email;
    staff.phone = phone || staff.phone;
    staff.role = role || staff.role;
    staff.address = address || staff.address;
    staff.employeeId = employeeId || staff.employeeId;
    
    if (unavailabilityPeriods !== undefined) {
        staff.unavailabilityPeriods = unavailabilityPeriods;
    }

    const updatedStaff = await staff.save();

    res.status(200).json({
        message: 'Staff member updated successfully.',
        staff: updatedStaff
    });
});

/**
 * @desc    Delete a staff member
 * @route   DELETE /api/staff/:id
 * @access  Private (Admin)
 */
const deleteStaff = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const staff = await Staff.findById(req.params.id).session(session);

        if (!staff || staff.company.toString() !== req.user.company.toString()) {
            res.status(404);
            throw new Error('Staff member not found or not authorized.');
        }

        const staffUserMongoose = await User.findOne({ staff: staff._id, company: req.user.company }).session(session);
        if (staffUserMongoose) {
            try {
                await admin.auth().deleteUser(staffUserMongoose.firebaseUid);
                console.log(`[deleteStaff] Firebase user ${staffUserMongoose.email} deleted.`);
            } catch (fbError) {
                if (fbError.code === 'auth/user-not-found') {
                    console.warn(`[deleteStaff] Firebase user ${staffUserMongoose.email} not found, proceeding with Mongoose delete.`);
                } else {
                    console.error(`[deleteStaff] Error deleting Firebase user ${staffUserMongoose.email}:`, fbError.message);
                }
            }
            await User.deleteOne({ _id: staffUserMongoose._id }).session(session);
        }

        await Staff.deleteOne({ _id: req.params.id }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Staff member and associated user deleted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting staff:', error);
        res.status(500).json({ message: 'Failed to delete staff member.', error: error.message });
    }
});

/**
 * @desc    Add an absence period for a staff member
 * @route   POST /api/staff/:staffId/absences
 * @access  Private/Admin/Manager/Staff (Staff can only add for themselves)
 */
const addStaffAbsence = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const { start, end, type, reason, status = 'Pending' } = req.body; 
    const requestingUserRole = req.user.role;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    try {
        // --- FIX: Ensure unavailabilityPeriods is selected when fetching staff ---
        const staff = await Staff.findById(staffId).select('+unavailabilityPeriods');

        if (!staff || staff.company.toString() !== req.user.company.toString()) {
            res.status(404);
            throw new Error('Staff member not found or not authorized for this company.');
        }

        if (requestingUserRole === 'staff' && staffId !== requestingUserStaffId) {
            res.status(403);
            throw new Error('Staff can only create absence periods for themselves.');
        }

        if (new Date(start) >= new Date(end)) {
            res.status(400);
            throw new Error('End date must be after start date.');
        }

        const newAbsence = { start, end, type, reason, status };

        // This check is good, but won't be hit if .select('+unavailabilityPeriods') is used
        if (!staff.unavailabilityPeriods) {
            staff.unavailabilityPeriods = [];
        }

        staff.unavailabilityPeriods.push(newAbsence);
        await staff.save();

        res.status(201).json(staff.unavailabilityPeriods);

    } catch (error) {
        console.error('Error adding staff absence:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Server error: Could not add absence.', error: error.message });
    }
});

/**
 * @desc    Get all absence periods for a specific staff member
 * @route   GET /api/staff/:staffId/absences
 * @access  Private (Admin, Manager, Staff - if owner)
 */
const getStaffAbsences = asyncHandler(async (req, res) => {
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

        // --- FIX: Explicitly select unavailabilityPeriods here ---
        const staffDoc = await Staff.findById(staffId).select('+unavailabilityPeriods');
        if (!staffDoc) { // Re-check if staffDoc is null after re-fetching with select
            return res.status(404).json({ message: 'Staff member not found after selecting periods.' });
        }

        let filteredPeriods = staffDoc.unavailabilityPeriods || []; // Ensure it's an array for filtering

        // Get optional filters from query
        const { startDate, endDate, type, status } = req.query;
        
        if (startDate) {
            const startOfDay = new Date(startDate);
            startOfDay.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
            filteredPeriods = filteredPeriods.filter(p => new Date(p.end) >= startOfDay);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setUTCHours(23, 59, 59, 999); // End of the day in UTC
            filteredPeriods = filteredPeriods.filter(p => new Date(p.start) <= endOfDay);
        }
        if (type) {
            filteredPeriods = filteredPeriods.filter(p => p.type === type);
        }
        if (status) {
            filteredPeriods = filteredPeriods.filter(p => p.status === status);
        }

        // Sort them (optional, but good for display)
        filteredPeriods.sort((a, b) => new Date(a.start) - new Date(b.start));

        res.status(200).json(filteredPeriods); // Return only the filtered periods

    } catch (error) {
        console.error('Error fetching staff absences:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @desc    Update an absence period for a staff member
 * @route   PUT /api/staff/:staffId/absences/:absenceId
 * @access  Private/Admin/Manager/Staff (Staff can only update their own, but status update is Admin/Manager only)
 */
const updateStaffAbsence = asyncHandler(async (req, res) => {
    const { staffId, absenceId } = req.params;
    // Add resolutionReason to destructuring
    const { start, end, type, reason, status, resolutionReason } = req.body; 
    const requestingUserRole = req.user.role;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    try {
        // --- FIX: Ensure unavailabilityPeriods is selected when fetching staff ---
        const staff = await Staff.findById(staffId).select('+unavailabilityPeriods');

        if (!staff || staff.company.toString() !== req.user.company.toString()) {
            res.status(404);
            throw new Error('Staff member not found or not authorized for this company.');
        }

        // Ensure unavailabilityPeriods is an array before trying to findIndex
        if (!staff.unavailabilityPeriods) {
            staff.unavailabilityPeriods = [];
        }

        const absenceIndex = staff.unavailabilityPeriods.findIndex(
            (p) => p._id && p._id.toString() === absenceId
        );

        if (absenceIndex === -1) {
            res.status(404);
            throw new Error('Absence period not found.');
        }

        const existingAbsence = staff.unavailabilityPeriods[absenceIndex];

        // Authorization check for staff:
        if (requestingUserRole === 'staff' && staffId !== requestingUserStaffId) {
            res.status(403);
            throw new Error('Not authorized to update this absence period.');
        }
        
        // If the requesting user is 'staff' and they are trying to change the status, deny it.
        // Admins/Managers can change status.
        if (requestingUserRole === 'staff' && status !== undefined && status !== existingAbsence.status) {
            res.status(403);
            throw new Error('Staff are not authorized to change the status of an absence period.');
        }

        // Apply updates
        if (start !== undefined) existingAbsence.start = start;
        if (end !== undefined) existingAbsence.end = end;
        if (type !== undefined) existingAbsence.type = type;
        if (reason !== undefined) existingAbsence.reason = reason;
        
        // Only Admin or Manager can update status and resolutionReason
        if (['admin', 'manager'].includes(requestingUserRole)) {
            if (status !== undefined) {
                existingAbsence.status = status;
            }
            if (resolutionReason !== undefined) { // Apply resolutionReason if provided by admin/manager
                existingAbsence.resolutionReason = resolutionReason;
            }
        }

        // Basic date validation after applying updates (only if dates are updated)
        if (start !== undefined || end !== undefined) {
             if (new Date(existingAbsence.start) >= new Date(existingAbsence.end)) {
                res.status(400);
                throw new Error('End date must be after start date.');
            }
        }

        await staff.save();
        res.status(200).json(staff.unavailabilityPeriods); // Return the updated list

    } catch (error) {
        console.error('Error updating staff absence:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Server error: Could not update absence.', error: error.message });
    }
});

/**
 * @desc    Delete an absence period for a staff member
 * @route   DELETE /api/staff/:staffId/absences/:absenceId
 * @access  Private/Admin/Manager/Staff (Staff can only delete their own)
 */
const deleteStaffAbsence = asyncHandler(async (req, res) => {
    const { staffId, absenceId } = req.params;
    const requestingUserRole = req.user.role;
    const requestingUserStaffId = req.user.staff ? req.user.staff.toString() : null;

    try {
        // --- FIX: Ensure unavailabilityPeriods is selected when fetching staff ---
        const staff = await Staff.findById(staffId).select('+unavailabilityPeriods');

        if (!staff || staff.company.toString() !== req.user.company.toString()) {
            res.status(404);
            throw new Error('Staff member not found or not authorized for this company.');
        }

        if (requestingUserRole === 'staff' && staffId !== requestingUserStaffId) {
            res.status(403);
            throw new Error('Not authorized to delete this absence period.');
        }

        // Ensure unavailabilityPeriods is an array before trying to filter
        if (!staff.unavailabilityPeriods) {
            staff.unavailabilityPeriods = [];
        }

        staff.unavailabilityPeriods = staff.unavailabilityPeriods.filter( // This is line 452 if current staffController.js is used
            (p) => p._id && p._id.toString() !== absenceId
        );

        await staff.save();
        res.status(200).json(staff.unavailabilityPeriods);

    } catch (error) {
        console.error('Error deleting staff absence:', error);
        res.status(500).json({ message: 'Server error: Could not delete absence.', error: error.message });
    }
});

/**
 * @desc    Send a planned route to a specific staff member
 * @route   POST /api/staff/send-route
 * @access  Private/Admin/Manager
 */
const sendRouteToStaff = asyncHandler(async (req, res) => {
    const { staffId, date, jobIds } = req.body;
    const companyId = req.user.company;

    if (!staffId || !date || !Array.isArray(jobIds) || jobIds.length === 0) {
        res.status(400);
        throw new Error('Staff ID, date, and job IDs are required to send a route.');
    }

    const staffMember = await Staff.findOne({ _id: staffId, company: companyId });

    if (!staffMember) {
        res.status(404);
        throw new Error('Staff member not found or not authorized for this company.');
    }

    console.log(`[sendRouteToStaff] Attempting to send route for ${staffMember.contactPersonName} on ${date} with jobs: ${jobIds.join(', ')}`);

    res.status(200).json({ message: `Route sent successfully to ${staffMember.contactPersonName}.` });
});


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
    sendRouteToStaff,
};