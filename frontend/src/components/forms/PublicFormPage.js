// ServiceOS/frontend/src/components/forms/PublicFormPage.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import FormRenderer from './FormRenderer';
import Loader from '../common/Loader';

const PublicFormPage = () => {
    const { id } = useParams();
    const [formDefinition, setFormDefinition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchForm = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get(`/public/forms/${id}`);
                setFormDefinition(res.data);
            } catch (err) {
                console.error('Error fetching public form:', err);
                setError(err.response?.data?.message || 'Failed to load form.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchForm();
        } else {
            setLoading(false);
            setError('No form ID provided.');
        }
    }, [id]);

    const handleFormSubmission = async (formData) => {
        try {
            const response = await api.post(`/public/forms/${id}/submit`, formData);
            return { success: true, message: response.data.message };
        } catch (err) {
            console.error('Public form submission failed:', err);
            throw new Error(err.response?.data?.message || 'Submission failed.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg max-w-md text-center">
                    <p className="font-bold">Error Loading Form</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-4xl bg-white shadow-lg rounded-lg">
                <FormRenderer formDefinition={formDefinition} onSubmit={handleFormSubmission} isPreview={false} />
            </div>
        </div>
    );
};

export default PublicFormPage;