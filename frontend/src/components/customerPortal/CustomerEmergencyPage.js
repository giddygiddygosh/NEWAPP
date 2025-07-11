// src/components/customerPortal/CustomerEmergencyPage.jsx

import React, { useState } from 'react';
import api from '../../utils/api'; // Assuming your API utility is located here
import { toast } from 'react-toastify';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import Loader from '../common/Loader';

const CustomerEmergencyPage = () => {
    const [formData, setFormData] = useState({
        serviceNeeded: '',
        description: '',
        contactPhone: '',
        preferredTime: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const serviceOptions = [
        { value: '', label: 'Select Service Type' },
        { value: 'Plumbing Emergency', label: 'Plumbing Emergency' },
        { value: 'Electrical Fault', label: 'Electrical Fault' },
        { value: 'Heating System Failure', label: 'Heating System Failure' },
        { value: 'Other', label: 'Other (Please describe)' },
    ];

    const timeOptions = [
        { value: '', label: 'Any Time' },
        { value: 'ASAP', label: 'As Soon As Possible' },
        { value: 'Morning (8-12)', label: 'Morning (8am - 12pm)' },
        { value: 'Afternoon (12-5)', label: 'Afternoon (12pm - 5pm)' },
        { value: 'Evening (5-9)', label: 'Evening (5pm - 9pm)' },
    ];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(false);

        if (!formData.serviceNeeded || formData.serviceNeeded === '') {
            setSubmitError('Please select a service type.');
            setSubmitting(false);
            return;
        }
        if (!formData.contactPhone || formData.contactPhone.trim() === '') {
            setSubmitError('A contact phone number is required.');
            setSubmitting(false);
            return;
        }
        if (formData.serviceNeeded === 'Other' && (!formData.description || formData.description.trim() === '')) {
            setSubmitError('Please provide a description for "Other" service type.');
            setSubmitting(false);
            return;
        }

        try {
            // === FIX HERE: REMOVE THE LEADING '/api/' ===
            const res = await api.post('/customer-portal/emergency-request', formData);
            // ===========================================
            
            toast.success(res.data.message || 'Emergency request submitted successfully! We will contact you shortly.');
            setSubmitSuccess(true);
            setFormData({ serviceNeeded: '', description: '', contactPhone: '', preferredTime: '' });
        } catch (err) {
            console.error('Error submitting emergency request:', err.response?.data || err.message);
            setSubmitError(err.response?.data?.message || 'Failed to submit emergency request.');
            toast.error(err.response?.data?.message || 'Failed to submit emergency request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="emergency-booking-page p-8 bg-white rounded-lg shadow-md min-h-[calc(100vh-80px)]">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6 pb-4 border-b border-gray-200">Book Emergency Service</h2>
            <p className="text-gray-700 mb-6">If you have an urgent issue requiring immediate attention, please fill out this form. We will prioritize your request.</p>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto p-6 border border-red-200 rounded-lg bg-red-50">
                {submitError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{submitError}</div>}
                {submitSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">Your emergency request has been received!</div>}

                <ModernSelect
                    label="Type of Service Needed"
                    name="serviceNeeded"
                    value={formData.serviceNeeded}
                    onChange={handleChange}
                    options={serviceOptions}
                    required
                />
                {formData.serviceNeeded === 'Other' && (
                    <ModernInput
                        label="Please Describe Your Emergency"
                        name="description"
                        textarea
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="e.g., Boiler completely shut down, no hot water or heating."
                        required
                    />
                )}
                <ModernInput
                    label="Contact Phone Number"
                    name="contactPhone"
                    type="tel"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="e.g., +447912345678"
                    required
                />
                <ModernSelect
                    label="Preferred Contact Time"
                    name="preferredTime"
                    value={formData.preferredTime}
                    onChange={handleChange}
                    options={timeOptions}
                />

                <button
                    type="submit"
                    className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md"
                    disabled={submitting}
                >
                    {submitting ? <Loader size={20} className="inline mr-2" /> : null}
                    {submitting ? 'Submitting...' : 'Submit Emergency Request'}
                </button>
            </form>
        </div>
    );
};

export default CustomerEmergencyPage;