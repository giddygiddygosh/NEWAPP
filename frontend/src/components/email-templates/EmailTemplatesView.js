import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import { Mail, Edit, Save, Upload, X } from 'lucide-react';
import ModernInput from '../common/ModernInput';
import Modal from '../common/Modal';
import Loader from '../common/Loader';

const TEMPLATE_TYPES = [
    { id: 'welcome_email', defaultName: 'Welcome Email', description: 'Sent to new customers upon signup.' },
    { id: 'appointment_reminder', defaultName: 'Appointment Reminder', description: 'Reminds customers about upcoming jobs.' },
    { id: 'job_completion', defaultName: 'Job Completion', description: 'Notifies customer that a job is complete.' },
    { id: 'invoice_email', defaultName: 'Invoice Email', description: 'Sends the invoice link or PDF.' },
    { id: 'invoice_reminder', defaultName: 'Invoice Reminder', description: 'Reminds customers about outstanding invoices.' },
    { id: 'review_request', defaultName: 'Review Request', description: 'Asks customers to leave a review after a job.' },
    { id: 'invoice_template', defaultName: 'Invoice Template', description: 'Template for general invoice display/email.' },
    // NEW: Staff Welcome Email Template Type
    { id: 'staff_welcome_email', defaultName: 'Staff Welcome Email', description: 'Sent to new staff members to set up their account.' }, // <--- ADD THIS LINE
];

const EmailTemplatesView = () => {
    const [templates, setTemplates] = useState([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [templateSubject, setTemplateSubject] = useState('');
    const [templateBody, setTemplateBody] = useState('');
    const [headerImageFile, setHeaderImageFile] = useState(null);
    const [headerImageUrl, setHeaderImageUrl] = useState('');
    const fileInputRef = useRef(null);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const fetchTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        setErrorMessage(null);
        try {
            const res = await api.get('/email-templates');
            const dbTemplatesMap = new Map(res.data.map(t => [t.templateType, t]));
            const finalTemplates = TEMPLATE_TYPES.map(defaultType => {
                const dbTemplate = dbTemplatesMap.get(defaultType.id);
                return dbTemplate ? { ...dbTemplate, description: defaultType.description } : {
                    id: defaultType.id,
                    templateType: defaultType.id,
                    name: defaultType.defaultName,
                    subject: `Default ${defaultType.defaultName} Subject`,
                    body: `Hello {customerName},\n\nThis is a default ${defaultType.defaultName} body.\n\nThanks,\n{companyName}`,
                    headerImageUrl: '',
                    description: defaultType.description,
                };
            });
            setTemplates(finalTemplates);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || "Failed to load templates.");
        } finally {
            setLoadingTemplates(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleEditTemplate = useCallback((template) => {
        setEditingTemplate(template);
        setTemplateName(template.name);
        setTemplateSubject(template.subject);
        setTemplateBody(template.body);
        setHeaderImageUrl(template.headerImageUrl || '');
        setHeaderImageFile(null);
        setIsEditModalOpen(true);
    }, []);

    const handleFileChange = useCallback((e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setHeaderImageFile(file);
            setHeaderImageUrl(URL.createObjectURL(file));
        }
    }, []);

    const handleRemoveImage = useCallback(() => {
        setHeaderImageFile(null);
        setHeaderImageUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
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
            formData.append('headerImageAction', 'upload');
        } else if (editingTemplate.headerImageUrl && !headerImageUrl) {
            formData.append('headerImageAction', 'remove');
        } else {
            formData.append('headerImageAction', 'keep');
        }

        try {
            await api.put(`/email-templates/${editingTemplate.templateType}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await fetchTemplates(); // Refetch all templates to get the latest data
            setIsEditModalOpen(false);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Failed to save template.');
        } finally {
            setSavingTemplate(false);
        }
    }, [editingTemplate, templateName, templateSubject, templateBody, headerImageFile, headerImageUrl, fetchTemplates]);

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
                    <Loader />
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {templates.map(template => (
                            <li key={template.id || template.templateType} className="p-4 flex justify-between items-center hover:bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-semibold text-lg text-gray-800">{template.name}</p>
                                    <p className="text-sm text-gray-500">{template.description}</p>
                                    {template.updatedAt && (
                                        <p className="text-xs text-gray-400">Last updated: {new Date(template.updatedAt).toLocaleDateString()}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleEditTemplate(template)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 font-semibold rounded-lg hover:bg-blue-200"
                                >
                                    <Edit size={16}/> Edit
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit ${editingTemplate?.name || ''}`}>
                <div className="p-6 space-y-4">
                    {/* Add content of your modal form fields here if not already */}
                    <ModernInput
                        label="Template Name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        required
                    />
                    <ModernInput
                        label="Subject Line"
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                        required
                    />
                    {/* For the body, consider a textarea or rich text editor */}
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
                    <textarea
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                        required
                        rows="10"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Use {placeholder} for dynamic content, e.g., {customerName}, {companyName}, {passwordResetLink}."
                    />

                    {/* Header Image Upload */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Header Image</label>
                        <div className="flex items-center space-x-4">
                            {headerImageUrl && (
                                <div className="relative w-32 h-32 border border-gray-300 rounded-lg overflow-hidden flex items-center justify-center bg-gray-100">
                                    <img src={headerImageUrl} alt="Header Preview" className="max-w-full max-h-full object-contain" />
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                        aria-label="Remove image"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                ref={fileInputRef}
                                className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-md file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100"
                            />
                        </div>
                        <p className="mt-1 text-sm text-gray-500">Upload an image to display at the top of the email (optional).</p>
                    </div>

                </div>
                <footer className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" disabled={savingTemplate}>Cancel</button>
                    <button onClick={handleSaveTemplate} className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700" disabled={savingTemplate}>
                        <Save size={16} className="inline-block mr-2" /> {savingTemplate ? 'Saving...' : 'Save Changes'}
                    </button>
                </footer>
            </Modal>
        </div>
    );
};

export default EmailTemplatesView;