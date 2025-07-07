// backend/finalUserIndexFix.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
// Only import User model, as we're focusing solely on its indexes
const User = require('./models/User'); 

dotenv.config();

const runFinalIndexFix = async () => {
    try {
        // Connect to MongoDB without autoIndex
        await mongoose.connect(process.env.DATABASE_URL, {
            autoIndex: false, // Essential for this script to control indexing
        });
        console.log('MongoDB connection for final index fix script established.');

        const userCollection = mongoose.connection.collection('users');

        // 1. Drop ALL custom indexes aggressively
        console.log('Dropping all custom indexes on users collection...');
        const existingIndexes = await userCollection.listIndexes().toArray();
        for (const index of existingIndexes) {
            if (index.name !== '_id_') { // Do NOT drop the default _id index
                try {
                    await userCollection.dropIndex(index.name);
                    console.log(`Dropped index: ${index.name}`);
                } catch (err) {
                    // Ignore "index not found" errors (code 27), but warn for others
                    if (err.code !== 27) console.warn(`Could not drop index ${index.name} (may not exist):`, err.message);
                }
            }
        }
        console.log('All custom indexes on users collection dropped.');

        // 2. Explicitly recreate ONLY the truly UNIQUE indexes (email, firebaseUid)
        console.log('Recreating essential unique indexes...');

        await userCollection.createIndex({ email: 1 }, { unique: true });
        console.log('Recreated unique index on User.email.');

        await userCollection.createIndex({ firebaseUid: 1 }, { unique: true });
        console.log('Recreated unique index on User.firebaseUid.');

        // WE ARE INTENTIONALLY *NOT* RECREATING INDEXES FOR 'customer' OR 'staff' HERE.
        // Mongoose's behavior with `sparse: true` (without `unique: true`) should handle it.

        console.log('Final User collection indexes managed successfully!');

    } catch (error) {
        console.error('CRITICAL Error during final index fix script:', error);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runFinalIndexFix();