// backend/controllers/staffController.js

const Staff = require('../models/Staff');
const User = require('../models/User');
const admin = require('firebase-admin'); // For Firebase Auth integration
const sendEmail = require('../utils/emailService');
const mongoose = require('mongoose');

/**
 * @desc    Add a new staff member (creates Mongoose Staff and Firebase User)
 * @route   POST /api/staff
 * @access  Private (Admin)
 */
const createStaff = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { contactPersonName, email, phone, address, role, employeeId, unavailabilityPeriods } = req.body;
        const companyId = req.user.company;

        if (!contactPersonName || !email) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Name and email are required for staff.' });
        }
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'User is not associated with a company.' });
        }

        const existingStaff = await Staff.findOne({ email }).session(session);
        if (existingStaff) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'A staff member with this email already exists.' });
        }

        const existingUser = await User.findOne({ email }).session(session);
        if (existingUser) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'A user account with this email already exists (might be a customer or another admin). Cannot create staff profile.' });
        }

        let firebaseUid;
        const tempPassword = Math.random().toString(36).slice(-8);
        try {
            const userRecord = await admin.auth().createUser({
                email: email,
                password: tempPassword,
                emailVerified: false,
                displayName: contactPersonName,
            });
            firebaseUid = userRecord.uid;
        } catch (firebaseError) {
            await session.abortTransaction();
            session.endSession();
            console.error('[createStaff] Firebase user creation failed:', firebaseError);
            if (firebaseError.code === 'auth/email-already-in-use') {
                return res.status(400).json({ message: 'Firebase: This email is already in use by another account.' });
            }
            return res.status(500).json({ message: `Failed to create Firebase user: ${firebaseError.message}` });
        }

        const staffData = {
            company: companyId,
            contactPersonName,
            email,
            phone,
            address,
            role: role || 'staff',
            unavailabilityPeriods: unavailabilityPeriods || []
        };

        if (employeeId && employeeId.trim() !== '') {
            staffData.employeeId = employeeId.trim();
        }

        const newStaff = new Staff(staffData);
        await newStaff.save({ session });

        const newUser = new User({
            firebaseUid: firebaseUid,
            email: email,
            role: role || 'staff',
            company: companyId,
            contactPersonName: contactPersonName,
            staff: newStaff._id,
        });
        await newUser.save({ session });

        const loginSubject = 'Welcome! Your ServiceOS Staff Portal Login Details';
        const loginText = `Dear ${contactPersonName},\n\n` +
            `Your ServiceOS Staff Portal account has been created. ` +
            `You can access it here: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard\n\n` +
            `Your email: ${email}\n` +
            `Your temporary password: ${tempPassword}\n\n` +
            `Please log in using these details and consider changing your password immediately for security.\n\n` +
            `The ServiceOS Team`;
        const loginHtml = `<p>Dear <strong>${contactPersonName}</strong>,</p>` +
            `<p>Your ServiceOS Staff Portal account has been created.</p>` +
            `<p>You can access it here: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard">ServiceOS Staff Portal</a></p>` +
            `<p>Your email: <strong>${email}</strong></p>` +
            `<p>Your temporary password: <strong>${tempPassword}</strong></p>` +
            `<p>Please log in using these details and consider changing your password immediately for security.</p>` +
            `<p>The ServiceOS Team</p>`;

        sendEmail(email, loginSubject, loginText, loginHtml).catch(err => {
            console.error("Failed to send welcome email:", err);
        });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ message: 'Staff member added successfully and login details sent.', staff: newStaff });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating staff:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        if (error.code === 11000 && error.keyPattern && error.keyPattern.employeeId) {
            return res.status(400).json({ message: 'A staff member with this Employee ID already exists.' });
        }
        res.status(500).json({ message: 'Failed to add staff member.', error: error.message });
    }
};

/**
 * @desc    Get all staff members for a company
 * @route   GET /api/staff
 * @access  Private (Admin, Manager)
 */
const getStaff = async (req, res) => {
    try {
        const companyId = req.user.company;
        const staffMembers = await Staff.find({ company: companyId })
                                         .sort({ contactPersonName: 1 })
                                         .select('+unavailabilityPeriods');

        // Debug log: This will show what the backend is fetching from MongoDB
        console.log("Backend: Staff fetched for frontend display (first staff member):", staffMembers[0]);

        res.status(200).json(staffMembers);
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Get a single staff member by ID
 * @route   GET /api/staff/:id
 * @access  Private (Admin, Manager, Staff - self)
 */
const getStaffById = async (req, res) => {
    try {
        const staffId = req.params.id;
        const companyId = req.user.company;

        const staffMember = await Staff.findOne({ _id: staffId, company: companyId })
                                       .select('+unavailabilityPeriods');

        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }
        if (req.user.role === 'staff' && req.user.staff.toString() !== staffId) {
            return res.status(403).json({ message: 'Not authorized to view this staff profile.' });
        }
        res.status(200).json(staffMember);
    } catch (error) {
        console.error('Error fetching staff member:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Update a staff member's profile
 * @route PUT /api/staff/:id
 * @access Private (Admin, Manager, Staff - self)
 */
const updateStaff = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const staffId = req.params.id;
        const companyId = req.user.company;
        const { contactPersonName, email, phone, address, role, employeeId, unavailabilityPeriods } = req.body;

        // Find the staff member
        let staffMember = await Staff.findOne({ _id: staffId, company: companyId }).session(session);

        if (!staffMember) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Staff member not found or not authorized.' });
        }

        // Authorization checks...
        if (req.user.role === 'staff' && req.user.staff.toString() !== staffId) {
            return res.status(403).json({ message: 'Not authorized to update this staff profile.' });
        }
        if (req.user.role === 'manager') {
            if ((staffMember.role === 'admin' || role === 'admin') && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Managers cannot modify or assign administrator roles.' });
            }
        }

        // Prepare updates for the main staff document fields
        const updateFields = {
            contactPersonName: contactPersonName || staffMember.contactPersonName,
            phone: phone !== undefined ? phone : staffMember.phone,
            address: address || staffMember.address,
            updatedAt: Date.now(),
        };

        if (employeeId !== undefined) {
            updateFields.employeeId = employeeId.trim() === '' ? undefined : employeeId;
        }

        if (role && role !== staffMember.role && req.user.role === 'admin') {
            updateFields.role = role;
        }

        // --- START OF UNUNAVAILABILITY PERIODS UPDATE LOGIC ---
        console.log("Backend Update: Incoming unavailabilityPeriods from frontend:", unavailabilityPeriods);

        let periodsToSave = [];
        if (unavailabilityPeriods !== undefined && Array.isArray(unavailabilityPeriods)) {
            periodsToSave = unavailabilityPeriods.map(period => ({
                // If _id exists, include it. For new periods, it will be undefined, and Mongoose will generate.
                ...(period._id && { _id: period._id }),
                start: new Date(period.start),
                end: new Date(period.end),
                type: period.type,
                reason: period.reason || ''
            }));

            for(const period of periodsToSave) { // Validate the mapped periods
                if (isNaN(period.start.getTime()) || isNaN(period.end.getTime()) || period.start > period.end) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: 'Invalid absence period: Start or end date is invalid or end date is before start date.' });
                }
                if (!period.type) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: 'Invalid absence period: Missing type.' });
                }
            }
        } else if (unavailabilityPeriods === null) {
            periodsToSave = []; // Clear all periods if null is explicitly sent
        }

        // Use findByIdAndUpdate to directly update the fields, including the array.
        // `new: true` returns the modified document.
        // `runValidators: true` ensures schema validation runs on the update.
        staffMember = await Staff.findByIdAndUpdate(
            staffId,
            { ...updateFields, unavailabilityPeriods: periodsToSave }, // Include unavailabilityPeriods here
            { new: true, runValidators: true, session: session }
        ).select('+unavailabilityPeriods'); // Ensure it's selected in the returned document

        console.log("Backend Update: staffMember AFTER findByIdAndUpdate (check unavailabilityPeriods):", staffMember.unavailabilityPeriods);


        // Update the linked User profile (role, contactPersonName)
        const linkedUser = await User.findOne({ staff: staffId, company: companyId }).session(session);
        if (linkedUser) {
            if (role && role !== linkedUser.role && req.user.role === 'admin') {
                linkedUser.role = role;
            }
            linkedUser.contactPersonName = contactPersonName || linkedUser.contactPersonName;
            await linkedUser.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        // Return the updated staff member, which should now include unavailabilityPeriods
        res.status(200).json({ message: 'Staff member updated successfully.', staff: staffMember });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error updating staff member:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A staff member with this employee ID or email already exists.' });
        }
        res.status(500).json({ message: 'Failed to update staff member.', error: error.message });
    }
};

/**
 * @desc    Delete a staff member by ID
 * @route   DELETE /api/staff/:id
 * @access  Private (Admin)
 */
const deleteStaff = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const staffId = req.params.id;
        const companyId = req.user.company;

        const staffMember = await Staff.findOne({ _id: staffId, company: companyId }).session(session);
        if (!staffMember) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Staff member not found or not authorized.' });
        }

        if (req.user.staff && req.user.staff.toString() === staffId.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'You cannot delete your own staff profile.' });
        }

        // 1. Delete associated Firebase Auth user
        const userAccount = await User.findOne({ staff: staffId, company: companyId }).session(session);
        if (userAccount && userAccount.firebaseUid) {
            try {
                await admin.auth().deleteUser(userAccount.firebaseUid);
            } catch (firebaseError) {
                console.warn(`Failed to delete Firebase user ${userAccount.email}:`, firebaseError.message);
            }
        }
        
        // 2. Delete Mongoose User document
        if (userAccount) {
            await User.deleteOne({ _id: userAccount._id }).session(session);
        }

        // 3. Delete Staff document
        await Staff.deleteOne({ _id: staffId }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Staff member deleted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error deleting staff member:', error);
        res.status(500).json({ message: 'Failed to delete staff member.', error: error.message });
    }
};

// Export all functions explicitly at the end
module.exports = {
    createStaff,
    getStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
};
