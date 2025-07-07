import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api'; // Your API utility
import { useAuth } from '../context/AuthContext'; // To get user's company ID
import StaffAbsenceView from './StaffAbsenceView'; // The view component
import Loader from '../common/Loader'; // For a full-page loader

const StaffAbsencePage = () => {
    const { user } = useAuth();
    const [staff, setStaff] = useState([]);
    const [isLoadingStaff, setIsLoadingStaff] = useState(true); // Initialize as true to show loader on first load
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Function to fetch staff data
    const fetchStaff = useCallback(async () => {
        setIsLoadingStaff(true); // Set to true when starting fetch
        setErrorMessage(null);
        try {
            if (!user?.company) {
                setErrorMessage("User company information not available.");
                setStaff([]);
                return;
            }
            const res = await api.get('/staff');
            setStaff(res.data);
            console.log("Fetched Staff with Absences:", res.data);
        } catch (err) {
            console.error("Error fetching staff for absence view:", err);
            setErrorMessage(err.response?.data?.message || "Failed to load staff data.");
        } finally {
            setIsLoadingStaff(false); // <--- THIS IS THE CRITICAL FIX: Always set to false
        }
    }, [user]);

    // Initial fetch on component mount
    useEffect(() => {
        if (user?.company) {
            fetchStaff();
        }
    }, [user, fetchStaff]);

    // Handler to save staff unavailability periods to the backend
    const handleSaveStaffUnavailability = useCallback(async (staffId, updatedPeriods) => {
        setIsLoadingStaff(true); // Set to true when saving
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await api.put(`/staff/${staffId}`, { unavailabilityPeriods: updatedPeriods });
            
            // Update state directly with the response from the API.
            setStaff(prevStaff => 
                prevStaff.map(s => s._id === staffId ? res.data.staff : s)
            );
            
            setSuccessMessage(`Absence periods for ${res.data.staff.contactPersonName} saved successfully!`);

        } catch (err) {
            console.error("Error saving staff unavailability:", err);
            setErrorMessage(err.response?.data?.message || "Failed to save staff absence. Please try again.");
        } finally {
            setIsLoadingStaff(false); // <--- Always set to false after save attempt
        }
    }, []);

    return (
        <div className="p-8">
            {errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {errorMessage}
                </div>
            )}
            {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {successMessage}
                </div>
            )}

            <StaffAbsenceView
                staff={staff}
                onSaveStaffUnavailability={handleSaveStaffUnavailability}
                isLoadingStaff={isLoadingStaff}
            />
        </div>
    );
};

export default StaffAbsencePage;
