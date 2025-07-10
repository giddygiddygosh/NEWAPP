// src/components/chat/AdminChatPage.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase'; // Path to src/firebase.js
import { useAuth } from '../context/AuthContext'; // Path to src/components/context/AuthContext.jsx
import api from '../../utils/api'; // Path to src/utils/api.js

// Components
import Loader from '../common/Loader'; // Path to src/components/common/Loader.jsx
import AdminChatView from './AdminChatView'; // Path to src/components/chat/AdminChatView.jsx


const AdminChatPage = () => {
    const { currentUser, user } = useAuth(); // Assuming useAuth provides Firebase currentUser and Mongoose user data
    const [staffList, setStaffList] = useState([]);
    const [loadingStaff, setLoadingStaff] = useState(true);

    // Fetch the list of staff members (including their Firebase UID)
    useEffect(() => {
        const fetchStaffData = async () => {
            // Only fetch if admin is logged in and currentUser is available
            if (!currentUser || !user || user.role !== 'admin') {
                setLoadingStaff(false);
                return;
            }
            try {
                // Your /api/staff endpoint needs to return staff members with their Firebase UIDs.
                // (We'll update backend/controllers/staffController.js for this in a later step)
                const response = await api.get('/staff');
                const formattedStaff = response.data.map(s => ({
                    id: s.firebaseUid, // CRITICAL: This must be the Firebase UID
                    name: s.contactPersonName
                })).filter(s => s.id); // Filter out staff without Firebase UIDs if any

                setStaffList(formattedStaff);
            } catch (err) {
                console.error("Error fetching staff for chat in AdminChatPage:", err);
                // You might want to display a user-friendly error message
            } finally {
                setLoadingStaff(false);
            }
        };

        fetchStaffData();
    }, [currentUser, user]); // Dependencies: currentUser (for auth) and user (for role)

    // Handle initial loading or unauthorized access
    if (!currentUser || !user || loadingStaff) {
        // Show loader if still loading, or if user/currentUser isn't fully loaded yet
        return <Loader />; 
    }
    
    // Ensure only admins can access this page
    if (user.role !== 'admin') {
        return <p>Access Denied: You must be an Admin to view this page.</p>; // Or redirect('/dashboard')
    }

    const firebaseAppId = process.env.REACT_APP_FIREBASE_APP_ID; 
    if (!firebaseAppId) {
        console.error("REACT_APP_FIREBASE_APP_ID is not set in environment variables!");
        return <p>Configuration Error: Firebase App ID is missing. Check your .env file.</p>;
    }

    return (
        <AdminChatView
            db={db} // Firebase Firestore instance
            appId={firebaseAppId} // Your Firebase Web App ID
            adminUserId={currentUser.firebaseUid} // The Firebase UID of the logged-in admin
            staff={staffList} // List of staff for recipient dropdown and display
        />
    );
};

export default AdminChatPage;