// src/embed.js

import React from 'react';
import ReactDOM from 'react-dom/client'; // Use createRoot for React 18+
import FormRenderer from './components/forms/FormRenderer';
import api from './utils/api'; // Assuming your api utility is generic enough for public endpoints
import './index.css'; // Include your main CSS, or create a separate minimal CSS for embeds if needed

/**
 * Global function to render a ServiceOS form into a specified HTML element.
 * This function is exposed globally for use in embed snippets.
 *
 * @param {string} formId The unique ID of the form to render.
 * @param {string} containerId The ID of the HTML element where the form should be mounted.
 */
window.renderServiceOSForm = async (formId, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`ServiceOS Embed Error: Container with ID '${containerId}' not found for form embed (Form ID: ${formId}).`);
        return;
    }

    // Create a new React root for this container
    const root = ReactDOM.createRoot(container);

    try {
        // Fetch the form definition from your public API
        const response = await api.get(`/public/forms/${formId}`);
        const formDefinition = response.data;

        // Define the submission handler for the embedded form
        const handleFormSubmission = async (formData) => {
            try {
                // Submit form data to your public submission API endpoint
                const submitResponse = await api.post(`/public/forms/${formId}/submit`, formData);
                return { success: true, message: submitResponse.data.message };
            } catch (err) {
                console.error('ServiceOS Embedded form submission failed:', err.response?.data || err.message);
                throw new Error(err.response?.data?.message || 'Submission failed. Please try again.');
            }
        };

        // Render the FormRenderer component into the container
        root.render(
            <React.StrictMode>
                <FormRenderer formDefinition={formDefinition} onSubmit={handleFormSubmission} isPreview={false} />
            </React.StrictMode>
        );
    } catch (error) {
        console.error('ServiceOS Embed Error: Failed to load form definition for embed:', error);
        // Display a user-friendly error message within the container
        root.render(
            <div style={{ padding: '20px', color: 'red', border: '1px solid #ffcccc', borderRadius: '8px', backgroundColor: '#fff0f0' }}>
                <p style={{ fontWeight: 'bold' }}>Error loading form.</p>
                <p style={{ fontSize: '0.9em' }}>Please ensure the form ID is correct or contact support.</p>
            </div>
        );
    }
};

// Optional: Auto-render forms based on data attributes if the script is loaded.
// This allows a simpler snippet: <div data-serviceos-form-id="YOUR_FORM_ID"></div>
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-serviceos-form-id]').forEach(async (element) => {
        const formId = element.getAttribute('data-serviceos-form-id');
        // Generate a unique ID if the element doesn't have one
        const containerId = element.id || `serviceos-form-embed-${formId}-${Math.random().toString(36).substring(2, 9)}`;
        if (!element.id) {
            element.id = containerId;
        }

        // Delay execution slightly to ensure window.renderServiceOSForm is available
        setTimeout(() => {
            if (window.renderServiceOSForm) {
                window.renderServiceOSForm(formId, containerId);
            } else {
                console.warn(`ServiceOS Embed: window.renderServiceOSForm not available for auto-render of form ${formId}.`);
            }
        }, 0);
    });
});