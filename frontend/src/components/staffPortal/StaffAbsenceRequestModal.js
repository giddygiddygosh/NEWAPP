import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { Calendar, BriefcaseMedical, MessageSquare, Loader as LoaderIcon } from 'lucide-react';

const StaffAbsenceRequestModal = ({
    isOpen,
    onClose,
    onSave, // This function will handle calling the API
    initialType = 'Holiday', // Can be 'Holiday' or 'Sick'
    staffId, // The ID of the logged-in staff member
}) => {
    const [formData, setFormData] = useState({
        staff: staffId, // Pre-fill with the current staff's ID
        start: '',
        end: '',
        type: initialType,
        reason: '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const absenceTypeOptions = [
        { value: 'Holiday', label: 'Holiday' },
        { value: 'Sick', label: 'Sick' },
        { value: 'Other', label: 'Other' },
        { value: 'Training', label: 'Training' },
        { value: 'Emergency Holiday', label: 'Emergency Holiday' }, // Added from your model
    ];

    // Ensure form resets and initialType/staffId are applied when modal opens or props change
    useEffect(() => {
        if (isOpen) {
            setError('');
            setFormData({
                staff: staffId,
                start: new Date().toISOString().split('T')[0], // Default to today
                end: '',
                type: initialType,
                reason: '',
            });
        }
    }, [isOpen, initialType, staffId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Client-side validation
        if (!formData.staff || !formData.start || !formData.end || !formData.type) {
            setError('Please fill out all required fields.');
            setIsLoading(false);
            return;
        }
        if (new Date(formData.end) < new Date(formData.start)) {
            setError('End date cannot be before the start date.');
            setIsLoading(false);
            return;
        }

        try {
            await onSave(formData); // Call the onSave prop provided by StaffDashboard
            onClose(); // Close modal on success
        } catch (err) {
            setError(err.message || 'Failed to submit absence request.');
            console.error('Error submitting absence request from modal:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Request ${initialType} Absence`}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</div>}

                {/* Staff ID is hidden and pre-filled */}
                {/* <input type="hidden" name="staff" value={formData.staff} /> */}

                <ModernSelect
                    label="Absence Type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    options={absenceTypeOptions.filter(opt => ['Holiday', 'Sick', 'Emergency Holiday'].includes(opt.value))} // Limit staff options
                    icon={<BriefcaseMedical />}
                    required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModernInput
                        label="Start Date"
                        name="start"
                        type="date"
                        value={formData.start}
                        onChange={handleChange}
                        icon={<Calendar />}
                        required
                    />
                    <ModernInput
                        label="End Date"
                        name="end"
                        type="date"
                        value={formData.end}
                        onChange={handleChange}
                        icon={<Calendar />}
                        required
                    />
                </div>

                <ModernInput
                    label="Reason (Optional)"
                    name="reason"
                    type="textarea" // Changed to textarea for more space
                    value={formData.reason}
                    onChange={handleChange}
                    icon={<MessageSquare />}
                    placeholder={initialType === 'Holiday' ? "e.g., Annual leave booking for family trip" : "e.g., Flu symptoms, doctor's appointment"}
                />

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <LoaderIcon size={20} className="animate-spin mr-2" /> Submitting...
                            </>
                        ) : (
                            `Submit ${initialType} Request`
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default StaffAbsenceRequestModal;