const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found in DB.');
            }

            // Your app requires the companyId to be attached to the user object
            if (req.user.company) {
                req.user.companyId = req.user.company.toString();
            } else {
                req.user.companyId = null;
            }

            next();

        } catch (error) {
            console.error('Token verification or user fetching failed in protect middleware:', error);
            res.status(401);
            throw new Error('Not authorized, token validation failed.');
        }
    } else {
        res.status(401);
        throw new Error('Not authorized, no token provided.');
    }
});

// This function creates middleware that checks for specific roles.
const authorize = (...roles) => {
    const allowedRoles = roles.flat().map(role => role.trim().toLowerCase());

    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Forbidden: User role not found.' });
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

// --- FIX: LINE 1 ---
// Create the 'adminManager' middleware by calling authorize with the correct roles.
const adminManager = authorize('admin', 'manager');


// --- FIX: LINE 2 ---
// Export 'adminManager' along with the other functions.
module.exports = { protect, authorize, adminManager };


