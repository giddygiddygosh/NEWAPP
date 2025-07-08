// File: src/components/staff/StaffAbsencePage.js (FINAL SIMPLIFIED VERSION)

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import Loader from '../common/Loader';
import StaffAbsenceView from './StaffAbsenceView'; // Your existing view component
import StaffAbsenceFormModal from './StaffAbsenceFormModal'; // Your existing form component

const StaffAbsencePage = () => {
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAbsence, setEditingAbsence] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState(null);

    // This function now gets everything in ONE go!
    const fetchAllStaffAndAbsences = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            // SINGLE API CALL to get staff and their embedded absences
            const res = await api.get('/staff');
            setStaffList(res.data || []);
        } catch (err) {
            const errorMessage = err.response?.data?.message || "An unknown error occurred.";
            setError(errorMessage);
            toast.error(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial data load
    useEffect(() => {
        fetchAllStaffAndAbsences();
    }, [fetchAllStaffAndAbsences]);
    
    // --- Modal and Action Handlers ---

    const handleOpenModalForNew = () => {
        setEditingAbsence(null);
        setSelectedStaff(null);
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (absence, staff) => {
        setEditingAbsence(absence);
        setSelectedStaff(staff);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleSave = async (formData) => {
        try {
            const { staffId, _id: absenceId, ...data } = formData;
            let updatedAbsences;

            if (absenceId) {
                // UPDATE: Call the new staff route for updating an absence
                const res = await api.put(`/staff/${staffId}/absences/${absenceId}`, data);
                updatedAbsences = res.data;
                toast.success("Absence updated successfully!");
            } else {
                // CREATE: Call the new staff route for adding an absence
                const res = await api.post(`/staff/${staffId}/absences`, data);
                updatedAbsences = res.data;
                toast.success("Absence added successfully!");
            }
            
            // Update the state for the specific staff member with the new list of absences
            setStaffList(currentStaffList =>
                currentStaffList.map(staff =>
                    staff._id === staffId
                        ? { ...staff, unavailabilityPeriods: updatedAbsences }
                        : staff
                )
            );
            handleCloseModal();

        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save absence.");
        }
    };

    const handleDelete = async (absenceId, staffId) => {
        if (window.confirm("Are you sure you want to delete this absence period?")) {
            try {
                // DELETE: Call the new staff route for deleting an absence
                const res = await api.delete(`/staff/${staffId}/absences/${absenceId}`);
                const updatedAbsences = res.data;
                
                setStaffList(currentStaffList =>
                    currentStaffList.map(staff =>
                        staff._id === staffId
                            ? { ...staff, unavailabilityPeriods: updatedAbsences }
                            : staff
                    )
                );
                toast.success("Absence deleted successfully!");

            } catch (err) {
                toast.error(err.response?.data?.message || "Failed to delete absence.");
            }
        }
    };
    
    // Create the 'staffAbsencesMap' on the fly for the view component
    const staffAbsencesMap = React.useMemo(() => {
        return staffList.reduce((acc, staff) => {
            acc[staff._id] = staff.unavailabilityPeriods || [];
            return acc;
        }, {});
    }, [staffList]);


    if (isLoading) return <Loader />;
    if (error) return <div className="text-center p-8 text-red-600 bg-red-50 rounded-lg">{error}</div>;

    return (
        <div className="p-8">
            <StaffAbsenceView
                staffList={staffList}
                staffAbsencesMap={staffAbsencesMap}
                onAddNew={handleOpenModalForNew}
                onEdit={handleOpenModalForEdit}
                onDelete={handleDelete}
            />
            
            {isModalOpen && (
                <StaffAbsenceFormModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    staffMembers={staffList}
                    editingAbsence={editingAbsence}
                    selectedStaff={selectedStaff}
                />
            )}
        </div>
    );
};

export default StaffAbsencePage;



