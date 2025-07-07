// ServiceOS/backend/routes/uploadRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware'); // Assuming this path is correct

const router = express.Router();

// --- Multer Storage Configuration ---

// Define the path for uploads
const uploadDir = 'uploads/';

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Save files to the 'uploads/' directory
    },
    filename: (req, file, cb) => {
        // Create a unique filename to avoid conflicts: fieldname-timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

// --- Multer File Filter ---

function checkFileType(file, cb) {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif/;
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime type
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Images only! (jpeg, jpg, png, gif)'));
    }
}

// --- Initialize Multer Upload Middleware ---

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    },
});


// --- Define the Upload Route ---

/**
 * @desc    Upload a company logo
 * @route   POST /api/uploads/upload-logo
 * @access  Private
 */
router.post('/upload-logo', protect, upload.single('logo'), (req, res) => {
    // 'logo' in upload.single('logo') must match the key in your FormData on the frontend

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Return the URL path to the uploaded file
    // The path should be constructed to be a valid URL fragment
    const filePath = `/uploads/${req.file.filename}`;

    res.status(201).json({
        message: 'Image uploaded successfully!',
        logoUrl: filePath,
    });
});

module.exports = router;