// File: src/components/staff/StaffAbsencePage.js

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import Loader from '../common/Loader';
import StaffAbsenceView from './StaffAbsenceView';
import StaffAbsenceFormModal from './StaffAbsenceFormModal';

const StaffAbsencePage = () => {
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAbsence, setEditingAbsence] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState(null);

    const fetchAllStaffAndAbsences = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await api.get('/staff'); // This should now bring back populated absences
            setStaffList(res.data || []);
            console.log("Fetched Staff with Absences:", res.data);
        } catch (err) {
            const errorMessage = err.response?.data?.message || "An unknown error occurred.";
            setError(errorMessage);
            toast.error(`Error: ${errorMessage}`);
            console.error("Error fetching all staff and absences:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllStaffAndAbsences();
    }, [fetchAllStaffAndAbsences]);
    
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
            let updatedAbsences = [];

            if (absenceId) {
                const res = await api.put(`/staff/${staffId}/absences/${absenceId}`, data);
                updatedAbsences = res.data;
                toast.success("Absence updated successfully!");
            } else {
                const res = await api.post(`/staff/${staffId}/absences`, data);
                updatedAbsences = res.data;
                toast.success("Absence added successfully!");
            }
            
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
            console.error("Error saving absence:", err);
        }
    };

    const handleDelete = async (absenceId, staffId) => {
        if (window.confirm("Are you sure you want to delete this absence period?")) {
            try {
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
                console.error("Error deleting absence:", err);
            }
        }
    };

    // NEW: Handler for updating absence status (Approve/Reject)
    const handleUpdateAbsenceStatus = useCallback(async (absenceId, staffId, newStatus, resolutionReason = '') => { // Added resolutionReason
        if (window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this absence request?`)) {
            try {
                // Pass resolutionReason to the API call
                const res = await api.put(`/staff/${staffId}/absences/${absenceId}`, { status: newStatus, resolutionReason: resolutionReason });
                const updatedAbsences = res.data;

                setStaffList(currentStaffList =>
                    currentStaffList.map(staff =>
                        staff._id === staffId
                            ? { ...staff, unavailabilityPeriods: updatedAbsences }
                            : staff
                    )
                );
                toast.success(`Absence request ${newStatus.toLowerCase()} successfully!`);
            } catch (err) {
                toast.error(err.response?.data?.message || `Failed to ${newStatus.toLowerCase()} absence request.`);
                console.error("Error updating absence status:", err);
            }
        }
    }, []);

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
                onUpdateStatus={handleUpdateAbsenceStatus} // NEW: Pass the status update handler
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


