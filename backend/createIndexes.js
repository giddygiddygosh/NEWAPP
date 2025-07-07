// backend/createIndexes.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User'); // Import the User model

dotenv.config(); // Load environment variables

const runIndexCreation = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL, {
            // autoIndex: false, // Ensure this is not set if you're directly connecting here without main app.js
        });
        console.log('MongoDB connection for index script established.');

        // Ensure our schema is loaded
        User.schema; // Load schema if not already loaded

        // Delete any existing conflicting indexes explicitly before creating new ones
        await User.collection.dropIndexes().catch(err => console.warn('Could not drop all indexes:', err.message));
        console.log('Attempted to drop all existing indexes on User collection.');


        // Explicitly create non-unique, sparse indexes for customer and staff
        // This is the CRITICAL part: it explicitly tells MongoDB they are NOT unique.
        await User.collection.createIndex({ customer: 1 }, { unique: false, sparse: true });
        console.log('Created non-unique index on User.customer.');

        await User.collection.createIndex({ staff: 1 }, { unique: false, sparse: true });
        console.log('Created non-unique index on User.staff.');

        console.log('Indexes created successfully!');

    } catch (error) {
        console.error('Error during index creation script:', error);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runIndexCreation();