// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('express-async-handler'); // <--- ADD THIS IMPORT
const mongoose = require('mongoose'); // Only needed if you use mongoose directly, not for this fix

const protect = asyncHandler(async (req, res, next) => { // <--- WRAP 'protect' WITH asyncHandler and make it async
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Populate the user object from the database and attach to req.user
            // Ensure 'role' is included in the fetched user data
            req.user = await User.findById(decoded.id).select('-password'); // .select('-password') is fine, role is usually included by default

            if (!req.user) {
                // If user not found in DB after token verification
                res.status(401);
                throw new Error('Not authorized, user not found in DB.');
            }

            // Optional: If you need to populate staff details for req.user for other middleware/controllers
            // req.user = await User.findById(decoded.id).select('-password').populate('staff');

            // Add companyId and companyName to req.user for convenience in controllers
            // This assumes your User model has a 'company' field that is populated
            if (req.user.company && typeof req.user.company !== 'string') { // Check if company is already populated
                req.user.companyId = req.user.company._id;
                req.user.companyName = req.user.company.name;
            } else if (req.user.company) { // If company is just an ID, fetch it (less efficient here)
                const companyDoc = await mongoose.model('Company').findById(req.user.company); // Assuming Company model exists
                req.user.companyId = companyDoc?._id;
                req.user.companyName = companyDoc?.name;
            } else {
                req.user.companyId = null;
                req.user.companyName = 'N/A';
            }

            next(); // Proceed to the next middleware/route
        } catch (error) {
            console.error('Token verification or user fetching failed in protect middleware:', error);
            res.status(401);
            // Provide more specific error messages for debugging
            if (error.name === 'TokenExpiredError') {
                throw new Error('Not authorized, token expired.');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Not authorized, invalid token.');
            } else {
                throw new Error('Not authorized, token validation failed.');
            }
        }
    } else {
        // No token provided in headers
        res.status(401);
        throw new Error('Not authorized, no token provided.');
    }
});

const authorize = (...roles) => {
    const allowedRoles = roles.flat().map(role => role.trim().toLowerCase()); // Ensure roles are trimmed and lowercased

    return (req, res, next) => {
        // --- DEBUG LOGS (Keep these for now to confirm) ---
        console.log(`[AUTHORIZE_DEBUG] User role from req.user: ${req.user ? req.user.role : 'N/A (req.user missing)'}`);
        console.log(`[AUTHORIZE_DEBUG] Allowed roles for this route: ${allowedRoles.join(', ')}`);
        // --- END DEBUG LOGS ---

        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Forbidden: User role not found in authentication context.' });
        }

        const userRole = req.user.role.trim().toLowerCase();
        
        const isAuthorized = allowedRoles.includes(userRole);

        if (!isAuthorized) {
            return res.status(403).json({
                message: `Forbidden: User role '${req.user.role}' is not authorized to access this route.`
            });
        }
        
        next();
    };
};

module.exports = { protect, authorize };
