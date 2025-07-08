const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    // ✅ --- THE FINAL FIX IS HERE ---
    // This line "flattens" the array. It handles both authorize('admin', 'staff')
    // and authorize(['admin', 'staff']) without crashing.
    const allowedRoles = roles.flat();

    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Forbidden: User role not found.' });
        }

        const userRole = req.user.role.trim().toLowerCase();
        
        // Now we use the flattened 'allowedRoles' array for the check.
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

