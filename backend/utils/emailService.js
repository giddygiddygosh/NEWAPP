// backend/utils/emailService.js

const nodemailer = require('nodemailer');

// Create a transporter using Ethereal's SMTP details
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // false for STARTTLS (port 587)
    auth: {
        // --- UPDATED CREDENTIALS ---
        user: 'torrance.eichmann@ethereal.email',
        pass: 'J6J2xTbmZ3UhFTqrZT'
        // --- END UPDATED CREDENTIALS ---
    },
    tls: {
        rejectUnauthorized: false // Needed for Ethereal over STARTTLS
    }
});

// Modified to accept an 'attachments' parameter
const sendEmail = async (to, subject, text, html, attachments = []) => {
    const mailOptions = {
        // The 'from' address MUST match the 'user' in the 'auth' block above
        from: '"ServiceOS" <torrance.eichmann@ethereal.email>', // --- UPDATED 'FROM' ADDRESS ---
        to,
        subject,
        text,
        html,
        attachments, // Include attachments in the mail options
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        // Preview URL is available when sending through an Ethereal account
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = sendEmail;
