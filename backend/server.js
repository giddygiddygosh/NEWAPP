// backend/server.js

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

// --- GLOBAL DEBUG LOG - This should log EVERY request hitting Express ---
app.use((req, res, next) => {
    console.log(`GLOBAL REQUEST DEBUG: Method: ${req.method}, Path: ${req.originalUrl}, Time: ${new Date().toISOString()}`);
    next(); // IMPORTANT: Call next() to pass the request to other middleware/routes
});
// --- END GLOBAL DEBUG LOG ---

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

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
const absenceRoutes = require('./routes/absenceRoutes'); // <--- ABSENCE ROUTES IMPORTED

// Make the 'uploads' folder static (where uploaded images will be stored)
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

// --- /api/absences SPECIFIC DEBUG LOG and ROUTE MOUNTING ---
app.use('/api/absences', (req, res, next) => {
    console.log(`DEBUG (Server.js): Request received for /api/absences${req.url}. Method: ${req.method}`);
    next();
});

app.use('/api/absences', absenceRoutes); // <--- ABSENCE ROUTES MOUNTED

app.use('/api/public/forms', publicRoutes);


app.get('/', (req, res) => {
    res.send('API is running...');
});

// --- /test-ping ROUTE ---
app.get('/test-ping', (req, res) => {
    console.log("TEST PING ROUTE HIT! SERVER IS RESPONDING.");
    res.status(200).send("Server Test Ping OK.");
});
// --- END /test-ping ROUTE ---

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});