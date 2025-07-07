// ServiceOS/backend/utils/emailService.js

const nodemailer = require('nodemailer');

// Create a transporter using Ethereal's SMTP details
// It's best practice to use environment variables for sensitive info,
// but for immediate testing, you can hardcode them here temporarily if you prefer,
// just remember to move them back to .env for production.
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email', // Ethereal Host (remains the same)
    port: 587,                   // Ethereal Port (remains the same)
    secure: false,               // false for STARTTLS (port 587) (remains the same)
    auth: {
        user: 'obie.monahan@ethereal.email', // UPDATED Ethereal Username
        pass: 'Htq2P1M6dVCSFU6Jfm'           // UPDATED Ethereal Password
    },
    tls: {
        rejectUnauthorized: false // Needed for Ethereal over STARTTLS (remains the same)
    }
});

const sendEmail = async (to, subject, text, html) => {
    const mailOptions = {
        from: 'ServiceOS <obie.monahan@ethereal.email>', // UPDATED Sender address to match new Ethereal user
        to, // list of receivers
        subject, // Subject line
        text, // plain text body
        html, // html body
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        // Preview URL is only available when sending through an Ethereal account
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return info; // Return info for logging or further processing
    } catch (error) {
        console.error('Error sending email:', error);
        throw error; // Re-throw the error so it can be caught by the calling function (e.g., authController)
    }
};

module.exports = sendEmail;