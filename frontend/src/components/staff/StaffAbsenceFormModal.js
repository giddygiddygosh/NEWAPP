import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { User, Calendar, BriefcaseMedical, MessageSquare } from 'lucide-react';

const StaffAbsenceFormModal = ({
    isOpen,
    onClose,
    onSave,
    staffMembers = [],
    editingAbsence,
    selectedStaff,
}) => {
    const [formData, setFormData] = useState({});
    const [error, setError] = useState('');

    const absenceTypeOptions = [
        { value: 'Holiday', label: 'Holiday' },
        { value: 'Sick', label: 'Sick' },
        { value: 'Training', label: 'Training' },
        { value: 'Appointment', label: 'Appointment' },
        { value: 'Other', label: 'Other' },
    ];

    // This effect runs when the modal opens or when editingAbsence changes
    useEffect(() => {
        if (!isOpen) {
            // If modal is closed, do nothing or reset form if needed
            return;
        }

        setError(''); // Reset errors when modal opens

        if (editingAbsence) {
            // Editing an existing absence
            setFormData({
                _id: editingAbsence._id,
                staffId: selectedStaff?._id || '', // Added optional chaining for safety
                start: new Date(editingAbsence.start).toISOString().split('T')[0],
                end: new Date(editingAbsence.end).toISOString().split('T')[0],
                type: editingAbsence.type,
                reason: editingAbsence.reason || '',
            });
        } else {
            // Adding a new absence
            setFormData({
                // Default to the first staff member's ID if available, otherwise empty string
                staffId: staffMembers[0]?._id || '',
                start: new Date().toISOString().split('T')[0],
                end: '',
                type: 'Holiday',
                reason: '',
            });
        }
    }, [isOpen, editingAbsence, selectedStaff, staffMembers]); // Dependencies

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Simple Validation
        if (!formData.staffId || !formData.start || !formData.end || !formData.type) {
            setError('Please fill out all required fields.');
            return;
        }
        if (new Date(formData.end) < new Date(formData.start)) {
            setError('End date cannot be before the start date.');
            return;
        }
        onSave(formData);
    };

    const staffOptions = staffMembers.map(s => ({ value: s._id, label: s.contactPersonName }));
    const isEditing = !!editingAbsence;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Absence' : 'Add New Absence'}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</div>}

                {isEditing ? (
                    <div className="p-3 bg-gray-100 rounded-md">
                        <p className="text-sm font-semibold text-gray-700">Staff Member: {selectedStaff?.contactPersonName}</p>
                    </div>
                ) : (
                    <ModernSelect
                        label="Staff Member"
                        name="staffId"
                        value={formData.staffId || ''}
                        onChange={handleChange}
                        options={staffOptions}
                        icon={<User />}
                        required
                    />
                )}
                
                <ModernSelect
                    label="Absence Type"
                    name="type"
                    value={formData.type || 'Holiday'}
                    onChange={handleChange}
                    options={absenceTypeOptions}
                    icon={<BriefcaseMedical />}
                    required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModernInput
                        label="Start Date"
                        name="start"
                        type="date"
                        value={formData.start || ''}
                        onChange={handleChange}
                        icon={<Calendar />}
                        required
                    />
                    <ModernInput
                        label="End Date"
                        name="end"
                        type="date"
                        value={formData.end || ''}
                        onChange={handleChange}
                        icon={<Calendar />}
                        required
                    />
                </div>

                <ModernInput
                    label="Reason (Optional)"
                    name="reason"
                    type="text"
                    value={formData.reason || ''}
                    onChange={handleChange}
                    icon={<MessageSquare />}
                    placeholder="e.g., Annual leave booking"
                />

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                        Cancel
                    </button>
                    <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                        {isEditing ? 'Save Changes' : 'Add Absence'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default StaffAbsenceFormModal;