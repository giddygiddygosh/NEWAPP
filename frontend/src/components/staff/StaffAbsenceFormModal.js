// ServiceOS/frontend/src/components/staff/StaffAbsenceFormModal.js

import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { Calendar, BriefcaseMedical, Text, User } from 'lucide-react';

const StaffAbsenceFormModal = ({ isOpen, onClose, onSave, staffMember, editingPeriod, staffMembers }) => {
    const [absenceData, setAbsenceData] = useState({
        staffId: staffMember?._id || '',
        start: '',
        end: '',
        type: 'Holiday',
        reason: ''
    });
    const [error, setError] = useState(null);

    const absenceTypeOptions = [
        { value: 'Holiday', label: 'Holiday' },
        { value: 'Sick', label: 'Sick' },
        { value: 'Training', label: 'Training' },
        { value: 'Emergency Holiday', label: 'Emergency Holiday' },
        { value: 'Other', label: 'Other' },
    ];

    const staffSelectOptions = staffMembers ? staffMembers.map(s => ({
        value: s._id,
        label: s.contactPersonName
    })) : [];

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (editingPeriod) {
                setAbsenceData({
                    _id: editingPeriod._id,
                    staffId: staffMember._id,
                    start: new Date(editingPeriod.start).toISOString().split('T')[0],
                    end: new Date(editingPeriod.end).toISOString().split('T')[0],
                    type: editingPeriod.type,
                    reason: editingPeriod.reason || ''
                });
            } else {
                const initialStaffId = staffMember?._id || (staffMembers.length > 0 ? staffMembers[0]._id : '');
                const today = new Date().toISOString().split('T')[0];
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setAbsenceData({
                    staffId: initialStaffId,
                    start: today,
                    end: nextWeek.toISOString().split('T')[0],
                    type: 'Holiday',
                    reason: ''
                });
            }
        }
    }, [isOpen, editingPeriod, staffMember, staffMembers]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setAbsenceData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);

        if (!editingPeriod && !absenceData.staffId) {
            setError('Please select a staff member.');
            return;
        }
        if (!absenceData.start || !absenceData.end || !absenceData.type) {
            setError('Please fill in start date, end date, and type.');
            return;
        }
        if (new Date(absenceData.start) > new Date(absenceData.end)) {
            setError('End date cannot be before start date.');
            return;
        }

        const dataToSend = { ...absenceData };
        if (!editingPeriod) {
            delete dataToSend._id;
        }

        onSave(dataToSend.staffId, dataToSend);
    };

    if (!isOpen) {
        return null;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingPeriod ? 'Edit Absence Period' : 'Add New Absence'} maxWidthClass="max-w-md">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                {!editingPeriod && (
                    <ModernSelect
                        label="Select Staff Member"
                        name="staffId"
                        value={absenceData.staffId}
                        onChange={handleChange}
                        icon={<User />}
                        options={staffSelectOptions}
                        required
                        disabled={staffMembers.length === 0}
                    >
                        {staffMembers.length === 0 && <option value="" disabled>No staff available</option>}
                    </ModernSelect>
                )}

                {editingPeriod && (
                    <p className="text-md text-gray-700">For Staff: <span className="font-semibold">{staffMember?.contactPersonName || staffMember?.name || 'N/A'}</span></p>
                )}

                <ModernSelect
                    label="Absence Type"
                    name="type"
                    value={absenceData.type}
                    onChange={handleChange}
                    icon={<BriefcaseMedical />}
                    options={absenceTypeOptions}
                    required
                />

                <ModernInput
                    label="Start Date"
                    name="start"
                    type="date"
                    value={absenceData.start}
                    onChange={handleChange}
                    icon={<Calendar />}
                    required
                />
                <ModernInput
                    label="End Date"
                    name="end"
                    type="date"
                    value={absenceData.end}
                    onChange={handleChange}
                    icon={<Calendar />}
                    required
                />
                <ModernInput
                    label="Reason (Optional)"
                    name="reason"
                    type="text"
                    value={absenceData.reason}
                    onChange={handleChange}
                    icon={<Text />}
                    placeholder="e.g., Annual leave, Flu, Training"
                    textarea
                    rows={3}
                />

                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                        Cancel
                    </button>
                    <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                        {editingPeriod ? 'Save Changes' : 'Add Absence'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default StaffAbsenceFormModal;