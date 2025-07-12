const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const morgan = require('morgan');

dotenv.config();

// Firebase Admin SDK Initialization
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

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(morgan('dev'));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/forms', require('./routes/formRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/email-templates', require('./routes/emailTemplateRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/daily-time', require('./routes/dailyTimeRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/customer-portal', require('./routes/customerPortalRoutes'));
app.use('/api/mail', require('./routes/mailRoutes'));
app.use('/api/routes', require('./routes/routePlannerRoutes'));
app.use('/api/reports', require('./routes/commissionReportRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/stripe', require('./routes/stripeRoutes'));

// Home route for API testing
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error Handlers (These must come last)
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5004;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});