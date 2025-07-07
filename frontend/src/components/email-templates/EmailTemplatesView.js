// src/components/email-templates/EmailTemplatesView.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api'; // Use your existing API utility for Node.js backend
import { Mail, Edit, Save, Upload, Image, X, XCircle } from 'lucide-react'; // XCircle added for consistency
import ModernInput from '../common/ModernInput';
import Modal from '../common/Modal';
import { toTitleCase } from '../../utils/helpers'; // Helper for formatting titles
import Loader from '../common/Loader'; // Assuming you have a Loader component

// Define the predefined template types (IDs are fixed, names will be editable)
// These IDs will be used as `templateType` in the Mongoose model on the backend
const TEMPLATE_TYPES = [
    { id: 'welcome_email', defaultName: 'Welcome Email', description: 'Sent to new customers upon signup.' },
    { id: 'appointment_reminder', defaultName: 'Appointment Reminder', description: 'Reminds customers about upcoming jobs.' },
    { id: 'job_completion', defaultName: 'Job Completion', description: 'Notifies customer that a job is complete.' },
    { id: 'invoice_email', defaultName: 'Invoice Email', description: 'Sends the invoice link or PDF.' },
    { id: 'invoice_reminder', defaultName: 'Invoice Reminder', description: 'Reminds customers about outstanding invoices.' },
    { id: 'review_request', defaultName: 'Review Request', description: 'Asks customers to leave a review after a job.' },
    // NEW: Invoice Template
    { id: 'invoice_template', defaultName: 'Invoice Template', description: 'Template for general invoice display/email.' },
];

// Removed Firebase-specific props (db, appId, adminUserId, storage, isAuthReady)
const EmailTemplatesView = () => {
    const [templates, setTemplates] = useState([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null); // The template object being edited
    const [templateName, setTemplateName] = useState('');
    const [templateSubject, setTemplateSubject] = useState('');
    const [templateBody, setTemplateBody] = useState('');
    const [headerImageFile, setHeaderImageFile] = useState(null); // File object for upload
    const [headerImageUrl, setHeaderImageUrl] = ''; // URL of the currently displayed/saved image
    const fileInputRef = useRef(null);
    const [loadingTemplates, setLoadingTemplates] = useState(true); // New loading state for initial fetch
    const [savingTemplate, setSavingTemplate] = useState(false); // New loading state for saving
    const [errorMessage, setErrorMessage] = useState(null); // For display error messages

    // Fetch all templates for the company from your backend API
    useEffect(() => {
        const fetchTemplates = async () => {
            setLoadingTemplates(true);
            setErrorMessage(null);
            try {
                const res = await api.get('/email-templates');
                // Backend returns saved templates. We need to merge them with default types
                // to show all possible template types, even if not yet customized.
                const dbTemplatesMap = new Map(res.data.map(t => [t.templateType, t]));

                const finalTemplates = TEMPLATE_TYPES.map(defaultType => {
                    const dbTemplate = dbTemplatesMap.get(defaultType.id);
                    if (dbTemplate) {
                        return {
                            id: dbTemplate._id, // Use DB's _id
                            templateType: dbTemplate.templateType,
                            name: dbTemplate.name,
                            subject: dbTemplate.subject,
                            body: dbTemplate.body,
                            headerImageUrl: dbTemplate.headerImageUrl,
                            description: defaultType.description, // Keep default description
                            createdAt: dbTemplate.createdAt,
                            updatedAt: dbTemplate.updatedAt,
                        };
                    } else {
                        // Provide a default structure for templates not yet saved to DB
                        return {
                            id: defaultType.id, // Use predefined ID for unsaved templates
                            templateType: defaultType.id,
                            name: defaultType.defaultName,
                            subject: `Default ${defaultType.defaultName} Subject`,
                            body: `Hello {customerName},\n\nThis is a default ${defaultType.defaultName} body.\n\nThanks,\n{companyName}`,
                            headerImageUrl: '',
                            description: defaultType.description,
                        };
                    }
                });
                setTemplates(finalTemplates);
            } catch (error) {
                console.error("Error fetching email templates from API:", error);
                setErrorMessage(error.response?.data?.message || "Failed to load email templates.");
            } finally {
                setLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }, []); // Empty dependency array means fetch once on component mount

    const handleEditTemplate = useCallback((template) => {
        setEditingTemplate(template);
        setTemplateName(template.name);
        setTemplateSubject(template.subject);
        setTemplateBody(template.body);
        setHeaderImageUrl(template.headerImageUrl || '');
        setHeaderImageFile(null); // Clear any previously selected file
        setIsEditModalOpen(true);
    }, []);

    const handleFileChange = useCallback((e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setHeaderImageFile(file);
            // Display local preview
            const reader = new FileReader();
            reader.onload = (event) => {
                setHeaderImageUrl(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleRemoveImage = useCallback(() => {
        setHeaderImageFile(null); // Mark for removal/no new file
        setHeaderImageUrl(''); // Clear current preview/URL
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Clear native file input
        }
    }, []);

    const handleSaveTemplate = useCallback(async () => {
        if (!editingTemplate) return;

        setSavingTemplate(true);
        setErrorMessage(null);

        const formData = new FormData();
        formData.append('name', templateName);
        formData.append('subject', templateSubject);
        formData.append('body', templateBody);

        if (headerImageFile) {
            formData.append('headerImage', headerImageFile);
            formData.append('headerImageAction', 'upload'); // Signal backend to upload
        } else if (editingTemplate.headerImageUrl && !headerImageUrl) {
            // If there was an image, and it's been cleared in UI, signal backend to remove
            formData.append('headerImageAction', 'remove');
        } else {
            // Otherwise, signal backend to keep existing image (or if no image, do nothing)
            formData.append('headerImageAction', 'keep');
        }

        try {
            // The backend endpoint is /api/email-templates/:typeId,
            // and it handles both creating (upsert) and updating.
            const res = await api.put(`/email-templates/${editingTemplate.templateType}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data', // Important for file uploads
                },
            });

            // Update local state: Replace the edited template with the fresh data from the backend
            setTemplates(prev => prev.map(t =>
                t.templateType === editingTemplate.templateType ? { ...t, ...res.data.template } : t
            ));
            setIsEditModalOpen(false);
            setEditingTemplate(null);
            // Show a success message briefly
            alert('Template saved successfully!'); // Consider a toast notification instead of alert
        } catch (error) {
            console.error("Error saving template:", error.response?.data || error);
            setErrorMessage(error.response?.data?.message || 'Failed to save template.');
        } finally {
            setSavingTemplate(false);
        }
    }, [editingTemplate, templateName, templateSubject, templateBody, headerImageFile, headerImageUrl, templates]);


    return (
        <div>
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Mail className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Email Templates</h1>
                </div>
            </header>

            {errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {errorMessage}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-lg p-4">
                {loadingTemplates ? (
                    <Loader /> // Show loader while templates are fetching
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {templates.length > 0 ? templates.map(template => (
                            <li key={template.id} className="p-4 flex justify-between items-center hover:bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-semibold text-lg text-gray-800">{template.name}</p>
                                    <p className="text-sm text-gray-500">{template.description}</p>
                                    {template.updatedAt && (
                                        <p className="text-xs text-gray-400">Last updated: {new Date(template.updatedAt).toLocaleDateString()}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleEditTemplate(template)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 font-semibold rounded-lg hover:bg-blue-200 transition-colors"
                                >
                                    <Edit size={16}/> Edit Template
                                </button>
                            </li>
                        )) : (
                            <p className="text-center text-gray-500 py-8">No templates found for your company. Start editing a default template!</p>
                        )}
                    </ul>
                )}
            </div>

            {/* Email Template Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit ${editingTemplate?.name || 'Template'}`} maxWidthClass="max-w-xl">
                <div className="p-6 space-y-4">
                    <ModernInput
                        label="Template Name"
                        name="templateName"
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        icon={<Mail size={16}/>}
                        required
                    />
                    {/* Header Image Upload */}
                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">Header Image (Optional)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                ref={fileInputRef}
                                style={{ display: 'none' }} // Hide native input
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current.click()} // Trigger hidden input
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 flex items-center gap-2"
                                disabled={savingTemplate}
                            >
                                <Upload size={16}/> Choose Image
                            </button>
                            {headerImageUrl && (
                                <>
                                    <img src={headerImageUrl} alt="Header Preview" className="h-20 w-auto rounded-md object-cover border border-gray-200" />
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="p-1 text-red-500 hover:text-red-700 rounded-full"
                                        title="Remove Image"
                                        disabled={savingTemplate}
                                    >
                                        <X size={20}/>
                                    </button>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Upload a banner image for the top of the email. Max file size: [e.g., 2MB].</p>
                    </div>

                    <ModernInput
                        label="Subject"
                        name="subject"
                        type="text"
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                        icon={<Mail size={16}/>}
                        required
                    />
                    <div>
                        <label htmlFor="templateBody" className="text-sm font-semibold text-gray-600 mb-1 block">Body (HTML allowed)</label>
                        <textarea
                            id="templateBody"
                            className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400
                                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm
                                       transition-all duration-200 ease-in-out min-h-[200px] resize-y"
                            value={templateBody}
                            onChange={(e) => setTemplateBody(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            You can use placeholders like <code className="bg-gray-200 p-0.5 rounded">{'{{customerName}}'}</code>, <code className="bg-gray-200 p-0.5 rounded">{'{{jobDate}}'}</code>, <code className="bg-gray-200 p-0.5 rounded">{'{{invoiceLink}}'}</code>.
                            Specific placeholders vary by template type.
                        </p>
                    </div>
                </div>
                <footer className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                        disabled={savingTemplate}
                    >
                        <XCircle size={16} className="inline-block mr-1"/> Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveTemplate}
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
                        disabled={savingTemplate}
                    >
                        {savingTemplate ? 'Saving...' : <><Save size={16} className="inline-block mr-1"/> Save Changes</>}
                    </button>
                </footer>
            </Modal>
        </div>
    );
};

export default EmailTemplatesView;