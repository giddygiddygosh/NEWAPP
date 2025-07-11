import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import FormRenderer from '../../components/forms/FormRenderer'; // Corrected the path
import Loader from '../../components/common/Loader'; // Corrected the path
import { toast } from 'react-toastify';

const QuoteRequestPage = () => {
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchQuoteForm = async () => {
            try {
                const res = await api.get('/public/forms/purpose/customer_quote');
                if (res.data && res.data.formSchema) {
                    setForm(res.data);
                } else {
                    setError('The Quote Request form has not been configured with any fields yet.');
                }
            } catch (err) {
                console.error("Error fetching quote form:", err);
                const errorMessage = err.response?.data?.message || 'The Quote Request form could not be loaded.';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchQuoteForm();
    }, []);

    // ================== THIS IS THE NEW FUNCTION ==================
    // This function handles the actual form submission to the backend.
    const handleFormSubmit = async (submissionData) => {
        if (!form) {
            toast.error("Form definition is not loaded.");
            return;
        }
        setSubmitting(true);
        try {
            // This is the API call that sends the data to your backend
            const res = await api.post(`/public/forms/${form._id}/submit`, submissionData);
            toast.success(res.data.message || 'Your request has been received!');
            return true; // Indicate success
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred during submission.';
            toast.error(errorMessage);
            console.error("Submission Error:", err);
            return false; // Indicate failure
        } finally {
            setSubmitting(false);
        }
    };
    // =============================================================

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader /></div>;
    }

    if (error) {
        return (
            <div className="container mx-auto p-8">
                <h1 className="text-3xl font-bold text-red-600 mb-4">Error</h1>
                <p className="text-red-500 bg-red-100 p-4 rounded-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-2">Request a Quote</h1>
            <p className="text-gray-600 mb-6">Please fill out the form below to request a personalized quote for our services.</p>
            
            {form ? (
                // We now pass the new handler function and loading state to the renderer
                <FormRenderer 
                    formDefinition={form}
                    onSubmit={handleFormSubmit}
                    isLoading={submitting}
                    submitButtonText="Submit Quote Request"
                />
            ) : (
                <div className="text-center p-8 bg-gray-100 rounded-md">
                    <p className="text-gray-500">No form is available to display.</p>
                </div>
            )}
        </div>
    );
};

export default QuoteRequestPage;