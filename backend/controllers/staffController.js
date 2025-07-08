// backend/controllers/staffController.js

const Staff = require('../models/Staff');
const User = require('../models/User'); // Import User model for Firebase user mapping
const Company = require('../models/Company'); // Assuming Company model for company name
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const admin = require('firebase-admin'); // Import Firebase Admin SDK
const sendTemplatedEmail = require('../utils/emailTriggerService'); // Import your email service

/**
 * @desc    Create a new staff member
 * @route   POST /api/staff
 * @access  Private (Admin, Manager)
 */
const createStaff = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession(); // Start transaction
    session.startTransaction();

    try {
        const { contactPersonName, email, phone, role, address, employeeId } = req.body;
        const companyId = req.user.company;
        
        // --- FETCH COMPANY NAME RELIABLY ---
        const company = await Company.findById(companyId).session(session);
        if (!company) {
            res.status(404);
            throw new Error('Company not found for the authenticated user.');
        }
        const companyName = company.name; // Get the company name from the fetched company document

        if (!contactPersonName || !email || !role) {
            res.status(400);
            throw new Error('Please provide name, email, and role for the staff member.');
        }

        const staffExists = await Staff.findOne({ email, company: companyId }).session(session);
        if (staffExists) {
            res.status(400);
            throw new Error('A staff member with this email already exists in your company.');
        }

        // Check if a User (Firebase-linked Mongoose User) with this email already exists
        const existingMongooseUser = await User.findOne({
            email: email,
            company: companyId,
        }).session(session);

        if (existingMongooseUser) {
            res.status(400);
            throw new Error('A user (admin/manager/staff/customer) with this email already exists in your company. Cannot create new staff with this email.');
        }

        // --- Create Staff Document ---
        const staff = await Staff.create([{
            company: companyId,
            contactPersonName,
            email, // Store the email directly
            phone,
            role,
            address,
            employeeId // Include employeeId if available
        }], { session }); // Pass session to creation

        const newStaff = staff[0]; // Access the created document from the array

        // --- Create Firebase User and Mongoose User for Staff ---
        let firebaseUserRecord;
        const tempPassword = Math.random().toString(36).slice(-8); // Generate temporary password

        try {
            firebaseUserRecord = await admin.auth().createUser({
                email: email,
                password: tempPassword,
                emailVerified: false,
                displayName: contactPersonName,
            });

            // Create the corresponding Mongoose User document for the staff member
            const staffUserMongoose = await User.create([{
                firebaseUid: firebaseUserRecord.uid,
                email: email,
                role: role, // Use the role defined for the staff (admin, manager, staff)
                company: companyId,
                contactPersonName: contactPersonName,
                staff: newStaff._id, // Link to the newly created Staff document
            }], { session });

            // Send Welcome Email with login details
            sendTemplatedEmail(
                'staff_welcome_email', // New templateType for staff
                companyId,             // companyId
                email,                 // recipientEmail
                {                      // placeholderData
                    userName: contactPersonName,      // Generic placeholder for any user type
                    companyName: companyName,         // Use fetched companyName
                    loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`, // Login link for staff
                    temporaryPassword: tempPassword,
                    email: email,                     // Pass email for template
                },
                'Staff Creation' // triggerSource
            );

        } catch (fbError) {
            // If Firebase user creation fails, abort transaction and report
            await session.abortTransaction();
            session.endSession();
            console.error(`[createStaff] Firebase user creation failed for ${email}:`, fbError.message);
            // Catch specific Firebase errors, e.g., email-already-exists for a user outside this company
            if (fbError.code === 'auth/email-already-in-use') {
                return res.status(400).json({ message: 'Email is already in use by another Firebase user. Please use a different email or log in with existing credentials.' });
            }
            throw new Error(`Failed to create user account: ${fbError.message}`); // Generic error for other Firebase issues
        }

        await session.commitTransaction(); // Commit if all successful
        session.endSession();

        res.status(201).json({
            message: 'Staff member created successfully and login details sent.',
            staff: newStaff // Return the single staff object
        });

    } catch (error) {
        await session.abortTransaction(); // Abort on any error
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
    // FIX: Explicitly select 'unavailabilityPeriods' because it's set to select: false in the model
    const staff = await Staff.find({ company: req.user.company }).select('+unavailabilityPeriods');
    res.status(200).json(staff);
});

/**
 * @desc    Get a single staff member by ID
 * @route   GET /api/staff/:id
 * @access  Private (Admin, Manager, Staff - self)
 */
const getStaffById = asyncHandler(async (req, res) => {
    // FIX: Explicitly select 'unavailabilityPeriods' if needed for single staff view
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
    staff.employeeId = employeeId || staff.employeeId; // Update employeeId
    
    // Specifically handle unavailability periods if provided in the main staff update
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

        // Find and delete the associated Mongoose User document
        const staffUserMongoose = await User.findOne({ staff: staff._id, company: req.user.company }).session(session);
        if (staffUserMongoose) {
            // Delete Firebase user
            try {
                await admin.auth().deleteUser(staffUserMongoose.firebaseUid);
                console.log(`[deleteStaff] Firebase user ${staffUserMongoose.email} deleted.`);
            } catch (fbError) {
                if (fbError.code === 'auth/user-not-found') {
                    console.warn(`[deleteStaff] Firebase user ${staffUserMongoose.email} not found, proceeding with Mongoose delete.`);
                } else {
                    console.error(`[deleteStaff] Error deleting Firebase user ${staffUserMongoose.email}:`, fbError.message);
                    // Decide if you want to throw here or just log and continue
                    // For now, allow deletion of Mongoose user even if Firebase fails
                }
            }
            await User.deleteOne({ _id: staffUserMongoose._id }).session(session); // Delete Mongoose User document
        }

        await Staff.deleteOne({ _id: req.params.id }).session(session); // Delete Staff document

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

// --- ABSENCE CONTROLLER FUNCTIONS (Already existed) ---

/**
 * @desc    Add an absence period for a staff member
 * @route   POST /api/staff/:staffId/absences
 * @access  Private/Admin/Manager
 */
const addStaffAbsence = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const { start, end, type, reason } = req.body; 

    try {
        const staff = await Staff.findById(staffId);

        if (!staff || staff.company.toString() !== req.user.company.toString()) {
            res.status(404);
            throw new Error('Staff member not found or not authorized for this company.');
        }

        const newAbsence = { start, end, type, reason };

        staff.unavailabilityPeriods.push(newAbsence);
        await staff.save();

        res.status(201).json(staff.unavailabilityPeriods);

    } catch (error) {
        console.error('Error adding staff absence:', error);
        res.status(500).json({ message: 'Server error: Could not add absence.', error: error.message });
    }
});

/**
 * @desc    Update an absence period for a staff member
 * @route   PUT /api/staff/:staffId/absences/:absenceId
 * @access  Private/Admin/Manager
 */
const updateStaffAbsence = asyncHandler(async (req, res) => {
    const { staffId, absenceId } = req.params;
    const { start, end, type, reason } = req.body;

    try {
        const staff = await Staff.findById(staffId);

        if (!staff || staff.company.toString() !== req.user.company.toString()) {
            res.status(404);
            throw new Error('Staff member not found or not authorized for this company.');
        }

        const absenceIndex = staff.unavailabilityPeriods.findIndex(
            (p) => p._id && p._id.toString() === absenceId
        );

        if (absenceIndex === -1) {
            res.status(404);
            throw new Error('Absence period not found.');
        }

        staff.unavailabilityPeriods[absenceIndex].start = start;
        staff.unavailabilityPeriods[absenceIndex].end = end;
        staff.unavailabilityPeriods[absenceIndex].type = type;
        staff.unavailabilityPeriods[absenceIndex].reason = reason || '';

        await staff.save();
        res.status(200).json(staff.unavailabilityPeriods);

    } catch (error) {
        console.error('Error updating staff absence:', error);
        res.status(500).json({ message: 'Server error: Could not update absence.', error: error.message });
    }
});

/**
 * @desc    Delete an absence period for a staff member
 * @route   DELETE /api/staff/:staffId/absences/:absenceId
 * @access  Private/Admin/Manager
 */
const deleteStaffAbsence = asyncHandler(async (req, res) => {
    const { staffId, absenceId } = req.params;

    try {
        const staff = await Staff.findById(staffId);

        if (!staff || staff.company.toString() !== req.user.company.toString()) {
            res.status(404);
            throw new Error('Staff member not found or not authorized for this company.');
        }

        staff.unavailabilityPeriods = staff.unavailabilityPeriods.filter(
            (p) => p._id && p._id.toString() !== absenceId
        );

        await staff.save();
        res.status(200).json(staff.unavailabilityPeriods);

    } catch (error) {
        console.error('Error deleting staff absence:', error);
        res.status(500).json({ message: 'Server error: Could not delete absence.', error: error.message });
    }
});

// --- NEW FUNCTION: Send Route to Staff ---

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

    // Example: Sending a simple notification (you'd replace this with your actual notification logic)
    // if (staffMember.email) {
    //    await sendNotification(staffMember.email, 'New Route Assignment', `You have a new route assigned for ${date}. Jobs: ${jobIds.length}`);
    // }

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
    deleteStaffAbsence, // Corrected export
    sendRouteToStaff,
};
