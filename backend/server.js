const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

dotenv.config();

try {
    const serviceAccount = require('./config/serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase Admin] Firebase Admin SDK initialized successfully.');
} catch (error) {
    console.error('[Firebase Admin] Failed to initialize Firebase Admin SDK:', error.message);
    process.exit(1);
}

connectDB();

const app = express();

app.use((req, res, next) => {
    console.log(`GLOBAL REQUEST DEBUG: Method: ${req.method}, Path: ${req.originalUrl}, Time: ${new Date().toISOString()}`);
    next();
});

app.use(cors({
    origin: '*', // Adjust this for production to be more specific
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const leadRoutes = require('./routes/leadRoutes');
const formRoutes = require('./routes/formRoutes');
const publicRoutes = require('./routes/publicRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const staffRoutes = require('./routes/staffRoutes');
const jobRoutes = require('./routes/jobRoutes');
const stockRoutes = require('./routes/stockRoutes');
const emailTemplateRoutes = require('./routes/emailTemplateRoutes');
const absenceRoutes = require('./routes/absenceRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dailyTimeRoutes = require('./routes/dailyTimeRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const customerPortalRoutes = require('./routes/customerPortalRoutes');
const mailRoutes = require('./routes/mailRoutes'); // <<< 1. ADD THIS LINE

// Make the 'uploads' folder static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/daily-time', dailyTimeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customer-portal', customerPortalRoutes);
app.use('/api/mail', mailRoutes); // <<< 2. ADD THIS LINE

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Handler for 404 Not Found (if no other route matches)
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

// Main Error Handler (catches all errors)
const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

// Use the error middleware AFTER all your API routes
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5004;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});