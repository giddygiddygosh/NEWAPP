// File: src/components/staff/StaffAbsenceView.js (REVISED - SINGLE GLOBAL MODAL)
import React, { useState } from 'react';
// Removed: StaffAbsenceFormModal (now managed by parent StaffAbsencePage)
import Modal from '../common/Modal'; // For the confirmation modal
import { UserX, Plus, Edit, Trash2, Calendar, BriefcaseMedical, Loader } from 'lucide-react';

const StaffAbsenceView = ({
    staffList,
    isLoading,
    onAddNew,   // This is for the main "Add New Absence" button
    onEdit,     // This is for editing an existing absence (passes period and staff to parent)
    onDelete,   // This is for deleting an existing absence (passes periodId and staffId to parent)
}) => {
    // These states are only for the *local* confirmation modal within StaffAbsenceView
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [absenceToDelete, setAbsenceToDelete] = useState(null);

    const handleDeleteAbsenceClick = (absenceId, staffId) => {
        setAbsenceToDelete({ absenceId, staffId }); // Store details for confirmation
        setIsConfirmModalOpen(true);
    };

    const confirmDeleteAbsence = () => {
        if (absenceToDelete) {
            onDelete(absenceToDelete.absenceId, absenceToDelete.staffId); // Call parent's onDelete
        }
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
                    onClick={onAddNew} // Calls handleOpenModalForNew in StaffAbsencePage
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center gap-2"
                >
                    <Plus size={20} /> Add New Absence
                </button>
            </header>

            <div className="bg-white rounded-xl shadow-lg p-4">
                <ul className="divide-y divide-gray-200">
                    {isLoading ? (
                        <li className="p-8 text-center text-gray-500 text-lg">
                            <Loader className="animate-spin inline-block mr-2" />Loading staff data...
                        </li>
                    ) : (staffList || []).length > 0 ? (
                        (staffList || []).map(staffMember => (
                            <li key={staffMember._id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-blue-50 rounded-lg">
                                <div className="flex items-center flex-1 min-w-0 mb-2 sm:mb-0">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-lg text-gray-800">{staffMember.contactPersonName}</p>
                                        <p className="text-sm text-gray-500">{staffMember.role || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col flex-grow sm:flex-row sm:items-center sm:ml-4 overflow-x-auto custom-scrollbar">
                                    {(staffMember.unavailabilityPeriods || []).length > 0 ? (
                                        staffMember.unavailabilityPeriods.map(period => {
                                            const key = period._id || period.id; // Use _id from DB or temp id
                                            return (
                                                <span key={key} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mr-2 mb-1 sm:mb-0 bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                                                    {period.type === 'Holiday' ? <Calendar size={12} className="mr-1" /> : <BriefcaseMedical size={12} className="mr-1" />}
                                                    {new Date(period.start).toLocaleDateString()} to {new Date(period.end).toLocaleDateString()} ({period.type})
                                                    <button
                                                        onClick={() => onEdit(period, staffMember)} // Call parent's onEdit
                                                        className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                                                        title="Edit Absence"
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAbsenceClick(key, staffMember._id)} // Call local handler for confirmation
                                                        className="ml-1 text-red-600 hover:text-red-800 focus:outline-none"
                                                        title="Delete Absence"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </span>
                                            );
                                        })
                                    ) : (
                                        <span className="text-sm text-gray-500 italic mr-2">No absences recorded.</span>
                                    )}
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

            {/* The Confirmation Modal */}
            <Modal isOpen={isConfirmModalOpen} onClose={cancelDeleteAbsence} title="Confirm Deletion" maxWidthClass="max-w-sm">
                <div className="p-6 text-center">
                    <p className="text-lg text-gray-700 mb-4">Are you sure you want to delete this absence period?</p>
                    <div className="flex justify-center gap-4 mt-6">
                        <button onClick={cancelDeleteAbsence} className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                            Cancel
                        </button>
                        <button onClick={confirmDeleteAbsence} className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default StaffAbsenceView;
