const asyncHandler = require('express-async-handler');
const Staff = require('../models/Staff');
const Job = require('../models/Job');
const sendEmail = require('../utils/emailService'); // Assuming you have an email service

/**
 * @desc    Receive a calculated route and send it to a staff member
 * @route   POST /api/routes/send-to-staff
 * @access  Private (Admin/Manager)
 */
const sendRouteToStaff = asyncHandler(async (req, res) => {
    const { staffId, date, jobIds } = req.body;

    if (!staffId || !date || !Array.isArray(jobIds) || jobIds.length === 0) {
        return res.status(400).json({ message: 'Staff ID, date, and a list of job IDs are required.' });
    }

    const staffMember = await Staff.findById(staffId);
    if (!staffMember) {
        return res.status(404).json({ message: 'Staff member not found.' });
    }

    // You could save this route to the database here if you wanted to.
    // For now, we will just send a notification.

    // Fetch job details to create a nice email/notification
    const jobs = await Job.find({ '_id': { $in: jobIds } }).populate('customer', 'contactPersonName address');
    
    // The jobIds are not yet sorted according to the optimized route.
    // We will re-order them based on the `jobIds` array from the frontend.
    const orderedJobs = jobIds.map(id => jobs.find(job => job._id.toString() === id));

    // Create the email content
    const subject = `Your Route for ${new Date(date).toLocaleDateString()}`;
    let emailText = `Hi ${staffMember.contactPersonName},\n\nHere is your optimized route for the day:\n\n`;
    orderedJobs.forEach((job, index) => {
        if(job) {
            emailText += `${index + 1}. ${job.serviceType} for ${job.customer.contactPersonName} at ${job.address.street}, ${job.address.city}\n`;
        }
    });

    // Send the email (or push notification, SMS, etc.)
    await sendEmail(staffMember.email, subject, emailText);

    res.status(200).json({ message: `Route successfully sent to ${staffMember.contactPersonName}.` });
});

module.exports = {
    sendRouteToStaff,
};