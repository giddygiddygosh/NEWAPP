// ServiceOS/frontend/src/components/staff/StaffAbsenceView.js

import React, { useState } from 'react';
import StaffAbsenceFormModal from './StaffAbsenceFormModal';
import Modal from '../common/Modal';
import { Users, UserX, Plus, Edit, Trash2, Calendar, BriefcaseMedical, Loader } from 'lucide-react';

const StaffAbsenceView = ({ staff, staffAbsencesMap, onSaveAbsence, onDeleteAbsence }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedStaffForAbsence, setSelectedStaffForAbsence] = useState(null);
    const [editingAbsencePeriod, setEditingAbsencePeriod] = useState(null);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [absenceToDelete, setAbsenceToDelete] = useState(null);

    const handleOpenFormModal = (staffMember = null, period = null) => {
        setSelectedStaffForAbsence(staffMember);
        setEditingAbsencePeriod(period);
        setIsFormModalOpen(true);
    };

    const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
        setSelectedStaffForAbsence(null);
        setEditingAbsencePeriod(null);
    };

    // --- FIX IS HERE: Correctly receive staffId and absenceData from the modal ---
    const handleSaveAbsenceSubmit = async (staffIdFromModal, absenceDataFromModal) => {
        // The modal passes (staffId, absenceData). We need to ensure absenceDataFromModal has staff property.
        // If it's a new absence, the staffId will come from the modal's dropdown.
        // If it's an edit, absenceDataFromModal._id will exist, and its .staff property should be correct.
        const finalAbsenceData = { ...absenceDataFromModal, staff: staffIdFromModal };

        const staffMemberName = staff.find(s => s._id === staffIdFromModal)?.contactPersonName || 'Unknown Staff';
        
        // Now pass the correctly structured absenceData and staff name to the parent handler
        await onSaveAbsence(finalAbsenceData, staffMemberName); 
        handleCloseFormModal();
    };
    // --- END FIX ---

    const handleDeleteAbsenceClick = (absenceId, staffId, staffContactName) => {
        setAbsenceToDelete({ absenceId, staffId, staffContactName });
        setIsConfirmModalOpen(true);
    };

    const confirmDeleteAbsence = async () => {
        if (!absenceToDelete) return;

        const { absenceId, staffId, staffContactName } = absenceToDelete;
        await onDeleteAbsence(absenceId, staffId, staffContactName);

        setIsConfirmModalOpen(false);
        setAbsenceToDelete(null);
    };

    const cancelDeleteAbsence = () => {
        setIsConfirmModalOpen(false);
        setAbsenceToDelete(null);
    };

    return (
        <div>
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <UserX className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Staff Absence</h1>
                </div>
                <button
                    onClick={() => {
                        if (!staff || staff.length === 0) {
                            alert("Please add staff members first.");
                            return;
                        }
                        handleOpenFormModal(null);
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center gap-2"
                    disabled={staff && staff.length === 0}
                >
                    <Plus size={20} /> Add New Absence
                </button>
            </header>

            <div className="bg-white rounded-xl shadow-lg p-4">
                <ul className="divide-y divide-gray-200">
                    {staff && staff.length > 0 ? (
                        staff.map(staffMember => (
                            <li key={staffMember._id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-blue-50 rounded-lg">
                                <div className="flex items-center flex-1 min-w-0 mb-2 sm:mb-0">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-lg text-gray-800">{staffMember.contactPersonName}</p>
                                        <p className="text-sm text-gray-500">{staffMember.role || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col flex-grow sm:flex-row sm:items-center sm:ml-4 overflow-x-auto custom-scrollbar">
                                    {(staffAbsencesMap[staffMember._id] || []).length > 0 ? (
                                        (staffAbsencesMap[staffMember._id] || []).map(period => (
                                            <span key={period._id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mr-2 mb-1 sm:mb-0
                                                bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                                                {period.type === 'Holiday' || period.type === 'Emergency Holiday' ? <Calendar size={12} className="mr-1" /> : <BriefcaseMedical size={12} className="mr-1" />}
                                                {new Date(period.start).toLocaleDateString()} to {new Date(period.end).toLocaleDateString()} ({period.type}{period.reason ? `: ${period.reason}` : ''})
                                                <button
                                                    onClick={() => handleOpenFormModal(staffMember, period)}
                                                    className="ml-2 text-red-600 hover:text-red-800 focus:outline-none"
                                                    title="Edit Absence"
                                                >
                                                    <Edit size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAbsenceClick(period._id, staffMember._id, staffMember.contactPersonName)}
                                                    className="ml-1 text-red-600 hover:text-red-800 focus:outline-none"
                                                    title="Delete Absence"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-500 italic mr-2">No absences recorded.</span>
                                    )}
                                </div>
                                <div className="flex-shrink-0 mt-2 sm:mt-0 sm:ml-4">
                                </div>
                            </li>
                        ))
                    ) : (
                        <li className="p-8 text-center text-gray-500 text-lg">
                            No staff members found. Please add staff to manage their absences.
                        </li>
                    )}
                </ul>
            </div>

            {isFormModalOpen && (
                <StaffAbsenceFormModal
                    isOpen={isFormModalOpen}
                    onClose={handleCloseFormModal}
                    onSave={handleSaveAbsenceSubmit}
                    staffMember={selectedStaffForAbsence}
                    editingPeriod={editingAbsencePeriod}
                    staffMembers={staff}
                />
            )}

            <Modal
                isOpen={isConfirmModalOpen}
                onClose={cancelDeleteAbsence}
                title="Confirm Deletion"
                maxWidthClass="max-w-sm"
            >
                <div className="p-6 text-center">
                    <p className="text-lg text-gray-700 mb-4">Are you sure you want to delete this absence period?</p>
                    <div className="flex justify-center gap-4 mt-6">
                        <button
                            onClick={cancelDeleteAbsence}
                            className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteAbsence}
                            className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default StaffAbsenceView;

