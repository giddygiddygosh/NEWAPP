// ServiceOS/backend/utils/generateToken.js

const jwt = require('jsonwebtoken');

// Generates a JWT token containing user ID, company ID, and role
const generateToken = (id, companyId, role) => {
    return jwt.sign(
        { id, companyId, role }, // Payload
        process.env.JWT_SECRET,  // Secret key from .env
        { expiresIn: '30d' }     // Token expiration
    );
};

module.exports = generateToken;