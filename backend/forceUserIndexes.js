// backend/forceUserIndexes.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User'); // Import the User model

dotenv.config(); // Load environment variables

const runForceIndexManagement = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.DATABASE_URL, {
            autoIndex: false, // Ensure this is false for the script's direct connection
        });
        console.log('MongoDB connection for force index management script established.');

        // Get the 'users' collection directly for aggressive index management
        const userCollection = mongoose.connection.collection('users');

        // 1. Drop ALL custom indexes on the 'users' collection
        console.log('Dropping all existing custom indexes on users collection...');
        const existingIndexes = await userCollection.listIndexes().toArray();
        for (const index of existingIndexes) {
            if (index.name !== '_id_') { // Do NOT drop the default _id index
                try {
                    await userCollection.dropIndex(index.name);
                    console.log(`Dropped index: ${index.name}`);
                } catch (err) {
                    console.warn(`Failed to drop index ${index.name} (may not exist or permission issue):`, err.message);
                }
            }
        }
        console.log('Finished dropping custom indexes on users collection.');


        // 2. Explicitly create the required indexes with correct uniqueness
        console.log('Creating required indexes with correct uniqueness...');

        // Must be unique (Firebase and system requirements)
        await userCollection.createIndex({ email: 1 }, { unique: true });
        console.log('Created unique index on User.email.');

        await userCollection.createIndex({ firebaseUid: 1 }, { unique: true });
        console.log('Created unique index on User.firebaseUid.');

        // Must NOT be unique (multiple users can have null customer/staff links)
        await userCollection.createIndex({ customer: 1 }, { unique: false, sparse: true });
        console.log('Created NON-UNIQUE index on User.customer.');

        await userCollection.createIndex({ staff: 1 }, { unique: false, sparse: true });
        console.log('Created NON-UNIQUE index on User.staff.');

        console.log('All specified indexes managed successfully for User collection!');

    } catch (error) {
        console.error('CRITICAL Error during force index management script:', error);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runForceIndexManagement();