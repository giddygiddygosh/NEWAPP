// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();

// Import middleware for protecting routes
const { protect } = require('../middleware/authMiddleware');

// Import controller functions for authentication
const {
    registerWithFirebase,
    firebaseLogin,
    getMe,
    forgotPassword,
    updateProfile
} = require('../controllers/authController');

// Public routes for registration and login
router.post('/register-with-firebase', registerWithFirebase);
router.post('/firebase-login', firebaseLogin);
router.post('/forgot-password', forgotPassword);

// Protected routes that require a valid token
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
 
