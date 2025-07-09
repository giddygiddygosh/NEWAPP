// File: src/components/staff/StaffAbsenceView.js

import React, { useState } from 'react';
import Modal from '../common/Modal';
import { UserX, Plus, Edit, Trash2, Calendar, BriefcaseMedical, Loader as LoaderIcon, CheckCircle2, XCircle } from 'lucide-react';

const StaffAbsenceView = ({
    staffList,
    isLoading,
    onAddNew,
    onEdit,
    onDelete,
    onUpdateStatus,
}) => {
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [absenceToDelete, setAbsenceToDelete] = useState(null);

    // NEW STATES for rejection reason modal
    const [isRejectReasonModalOpen, setIsRejectReasonModalOpen] = useState(false);
    const [rejectionDetails, setRejectionDetails] = useState({ absenceId: null, staffId: null, reason: '' });

    const handleDeleteAbsenceClick = (absenceId, staffId) => {
        setAbsenceToDelete({ absenceId, staffId });
        setIsConfirmModalOpen(true);
    };

    const confirmDeleteAbsence = () => {
        if (absenceToDelete) {
            onDelete(absenceToDelete.absenceId, absenceToDelete.staffId);
        }
        setIsConfirmModalOpen(false);
        setAbsenceToDelete(null);
    };

    const cancelDeleteAbsence = () => {
        setIsConfirmModalOpen(false);
        setAbsenceToDelete(null);
    };

    // NEW: Handle Reject click to open reason modal
    const handleRejectClick = (absenceId, staffId) => {
        setRejectionDetails({ absenceId, staffId, reason: '' });
        setIsRejectReasonModalOpen(true);
    };

    // NEW: Submit rejection with reason
    const submitRejection = () => {
        if (rejectionDetails.absenceId && rejectionDetails.staffId) {
            onUpdateStatus(rejectionDetails.absenceId, rejectionDetails.staffId, 'Rejected', rejectionDetails.reason);
        }
        setIsRejectReasonModalOpen(false);
        setRejectionDetails({ absenceId: null, staffId: null, reason: '' });
    };

    // Helper to get status styling
    const getStatusClasses = (status) => {
        switch (status) {
            case 'Pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Approved':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'Rejected':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'Cancelled':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    return (
        <div>
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <UserX className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Staff Absence</h1>
                </div>
                <button
                    onClick={onAddNew}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center gap-2"
                >
                    <Plus size={20} /> Add New Absence
                </button>
            </header>

            <div className="bg-white rounded-xl shadow-lg p-4">
                <ul className="divide-y divide-gray-200">
                    {isLoading ? (
                        <li className="p-8 text-center text-gray-500 text-lg">
                            <LoaderIcon className="animate-spin inline-block mr-2" />Loading staff data...
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
                                            const key = period._id || period.id;
                                            const isPending = period.status === 'Pending';
                                            const isRejected = period.status === 'Rejected';

                                            return (
                                                <span key={key} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mr-2 mb-1 sm:mb-0 whitespace-nowrap ${getStatusClasses(period.status)}`}>
                                                    {period.type === 'Holiday' ? <Calendar size={12} className="mr-1" /> : <BriefcaseMedical size={12} className="mr-1" />}
                                                    {new Date(period.start).toLocaleDateString()} to {new Date(period.end).toLocaleDateString()} ({period.type}) - {period.status}
                                                    {period.reason && <span className="ml-1 text-gray-600 italic"> (Req: {period.reason})</span>}
                                                    {isRejected && period.resolutionReason && <span className="ml-1 text-red-700 italic font-semibold"> (Reason: {period.resolutionReason})</span>}
                                                    
                                                    {isPending && (
                                                        <span className="flex items-center ml-2">
                                                            <button
                                                                onClick={() => onUpdateStatus(period._id, staffMember._id, 'Approved')}
                                                                className="ml-1 text-green-600 hover:text-green-800 focus:outline-none"
                                                                title="Approve Absence"
                                                            >
                                                                <CheckCircle2 size={12} />
                                                            </button>
                                                            <button // Corrected button syntax
                                                                onClick={() => handleRejectClick(period._id, staffMember._id)}
                                                                className="ml-1 text-red-600 hover:text-red-800 focus:outline-none"
                                                                title="Reject Absence"
                                                            >
                                                                <XCircle size={12} />
                                                            </button>
                                                        </span>
                                                    )}
                                                    
                                                    <button
                                                        onClick={() => onEdit(period, staffMember)}
                                                        className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                                                        title="Edit Absence"
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAbsenceClick(key, staffMember._id)}
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

            {/* NEW: Rejection Reason Modal */}
            <Modal isOpen={isRejectReasonModalOpen} onClose={() => setIsRejectReasonModalOpen(false)} title="Reason for Rejection" maxWidthClass="max-w-md">
                <div className="p-6 space-y-4">
                    <p className="text-gray-700">Please provide a brief reason for rejecting this absence request.</p>
                    <textarea
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows="4"
                        value={rejectionDetails.reason}
                        onChange={(e) => setRejectionDetails(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="e.g., Not enough coverage, conflicting holiday, etc."
                    ></textarea>
                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => setIsRejectReasonModalOpen(false)} className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                            Cancel
                        </button>
                        <button onClick={submitRejection} className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">
                            Submit Rejection
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default StaffAbsenceView;