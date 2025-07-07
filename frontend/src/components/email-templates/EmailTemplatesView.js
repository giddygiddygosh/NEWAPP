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
];

const EmailTemplatesView = () => {
    const [templates, setTemplates] = useState([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [templateSubject, setTemplateSubject] = useState('');
    const [templateBody, setTemplateBody] = useState('');
    const [headerImageFile, setHeaderImageFile] = useState(null);
    const [headerImageUrl, setHeaderImageUrl] = useState(''); // ✅ FIX: Corrected useState declaration
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
                            // CONFIRMED: Key prop is present and unique
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
                    {/* Form fields... */}
                </div>
                <footer className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={() => setIsEditModalOpen(false)} className="btn-secondary" disabled={savingTemplate}>Cancel</button>
                    <button onClick={handleSaveTemplate} className="btn-primary" disabled={savingTemplate}>
                        {savingTemplate ? 'Saving...' : 'Save Changes'}
                    </button>
                </footer>
            </Modal>
        </div>
    );
};

export default EmailTemplatesView;