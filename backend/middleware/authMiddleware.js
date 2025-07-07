/// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose'); // IMPORT THIS LINE FOR THE FIX

const protect = async (req, res, next) => {
    let token;
    // --- ADDED LOGS ---
    console.log("DEBUG (Protect): Request received. Checking for authorization header.");
    // --- END ADDED LOGS ---
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            // --- ADDED LOGS ---
            console.log("DEBUG (Protect): Token decoded successfully. User ID:", decoded.id);
            console.log("DEBUG (Protect): Fetched user from DB:", req.user ? req.user.email : 'NOT FOUND');
            // --- END ADDED LOGS ---
            if (!req.user) {
                console.log("DEBUG (Protect): User not found in DB after token verify. Sending 401.");
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            // --- THE FIX STARTS HERE ---
            // Ensure req.user.company is a plain string ID for consistency in queries
            // It will be an ObjectId object if not populated, which needs conversion
            if (req.user.company && typeof req.user.company === 'object' && req.user.company instanceof mongoose.Types.ObjectId) {
                req.user.company = req.user.company.toString(); // Convert the ObjectId object to its string representation
            }
            // --- THE FIX ENDS HERE ---

            // --- ADDED LOGS ---
            console.log("DEBUG (Protect): Passed protect middleware. User role:", req.user.role, "Company ID:", req.user.company);
            console.log("DEBUG (Protect): Type of req.user.company:", typeof req.user.company); // Verify it's now a string
            // --- END ADDED LOGS ---
            next();
        } catch (error) {
            console.error("DEBUG (Protect): Token verification failed. Error:", error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        console.log("DEBUG (Protect): No token provided. Sending 401.");
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        // --- ADDED LOGS ---
        console.log("DEBUG (Authorize): Entered authorize middleware.");
        console.log("DEBUG (Authorize): User role from req.user:", req.user ? req.user.role : 'Undefined user/role');
        console.log("DEBUG (Authorize): Required roles for this route:", roles);
        // --- END ADDED LOGS ---

        if (!req.user || !roles.some(role => typeof role === 'string' && role.trim() === req.user.role.trim())) {
            console.log("DEBUG (Authorize): Authorization FAILED. Sending 403.");
            return res.status(403).json({
                message: `Forbidden: User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route.`
            });
        }
        console.log("DEBUG (Authorize): Authorization PASSED.");
        next();
    };
};

module.exports = { protect, authorize };