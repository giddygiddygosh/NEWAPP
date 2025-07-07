// ServiceOS/frontend/src/components/forms/FormBuilderPage.js

import React, { useState, useCallback, useEffect, Fragment, useRef } from 'react';
import { useDrop } from 'react-dnd';
import { v4 as uuidv4 } from 'uuid';
import api from '../../utils/api';
import Loader from '../common/Loader';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import Modal from '../common/Modal';

import FieldSettingsModal from './FieldSettingsModal';
import FormRenderer from './FormRenderer';
import DraggableFieldType from './DraggableFieldType';
import ColumnComponent from './ColumnComponent';
import RowComponent from './RowComponent';

import {
    PencilIcon, TrashIcon, Bars2Icon, CursorArrowRaysIcon, EnvelopeIcon, PhoneIcon, DocumentTextIcon, CheckIcon, CalendarIcon, ListBulletIcon, MapPinIcon,
    ClockIcon, QueueListIcon, ArrowUpTrayIcon, EyeIcon, PlusCircleIcon, CodeBracketIcon,
    ClipboardDocumentListIcon // CHANGED: Replaced ListChecksIcon with ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

const ItemTypes = {
    FORM_FIELD: 'formField',
    FIELD_TYPE: 'fieldType',
    ROW: 'row'
};

const defaultGlobalStyles = { // Renamed from defaultStyles for clarity (global vs field)
    logoUrl: '',
    backgroundColor: '#FFFFFF',
    primaryColor: '#2563EB',
    borderColor: '#D1D5DB', // Global border color for inputs/selects
    labelColor: '#111827',
    borderRadius: '0.375rem', // Default for rounded-md
    globalBorderWidth: 1,      // NEW: Default border thickness in px
    globalBorderStyle: 'solid', // NEW: Default border style
};

const defaultFieldStyles = { // Default styles for individual fields (used in FieldSettingsModal and when creating new fields)
    labelColor: '#111827',
    inputTextColor: '#111827',
    inputBackgroundColor: '#FFFFFF',
    inputBorderColor: '#D1D5DB',
    inputBorderRadius: '0.375rem',
    inputBorderWidth: 1,
    inputBorderStyle: 'solid',
};


const FormBuilderPage = () => {
    const [formName, setFormName] = useState('');
    const [formPurpose, setFormPurpose] = useState('general'); // NEW: State for form purpose
    const [formStyles, setFormStyles] = useState(defaultGlobalStyles); // Now formStyles refers to global styles
    const [formRows, setFormRows] = useState([]);
    const [editingField, setEditingField] = useState(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [formsList, setFormsList] = useState([]);
    const [selectedFormId, setSelectedFormId] = useState('');
    const [activeTab, setActiveTab] = useState('canvas');

    const [generatedEmbedSnippet, setGeneratedEmbedSnippet] = useState('');

    const borderStyleOptions = [
        { value: 'none', label: 'None' },
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' },
    ];

    // UPDATED: Options for Form Purpose
    const formPurposeOptions = [
        { value: 'general', label: 'General Form' },
        { value: 'customer_booking', label: 'Website Booking Form' },
        { value: 'customer_quote', label: 'Quote Request Form' },
        { value: 'reminder_task_list', label: 'Reminder Task List Form (Staff Only)' }, // NEW purpose
    ];


    useEffect(() => {
        fetchForms();
    }, []);

    const generateSnippet = useCallback((formId) => {
        if (!formId) {
            setGeneratedEmbedSnippet('');
            return;
        }
        const embedScriptUrl = `${window.location.origin}/static/js/form-embed.js`;
        
        // Ensure to include the form's company ID if needed for filtering forms
        // For public forms, the formId itself should be sufficient for the backend
        // to retrieve the form and thus the company ID it belongs to.
        // const companyId = user?.company?._id; // You might need user context here if generating snippet depends on company

        const containerId = `serviceos-form-${formId}`;

        const snippet = `
<div id="${containerId}" data-serviceos-form-id="${formId}" style="width: 100%; max-width: 800px; margin: 0 auto;">Loading your form...</div>
<script src="${embedScriptUrl}" async></script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        if (window.renderServiceOSForm) {
            window.renderServiceOSForm('${formId}', '${containerId}');
        } else {
            console.error('ServiceOS form embed script not loaded correctly. Please check the script URL.');
        }
    });
</script>
`.trim();

        setGeneratedEmbedSnippet(snippet);
    }, []);


    const fetchForms = async () => {
        setLoading(true);
        try {
            const res = await api.get('/forms');
            setFormsList(res.data);
        } catch (err) {
            console.error('Error fetching forms list:', err);
            setError('Failed to load forms list.');
        } finally {
            setLoading(false);
        }
    };

    const loadForm = useCallback(async (formId) => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const res = await api.get(`/forms/${formId}`);
            setFormName(res.data.name);
            setFormPurpose(res.data.purpose || 'general'); // Load form purpose
            setFormStyles({ ...defaultGlobalStyles, ...(res.data.settings?.styles || {}) });
            
            const loadedSchema = res.data.schema || [];
            const loadedRows = loadedSchema.map(row => ({
                ...row, id: row.id || uuidv4(), columns: row.columns.map(col => ({ // Ensure row/col IDs are retained or generated
                ...col, id: col.id || uuidv4(), fields: col.fields.map(f => ({
                    ...f,
                    id: f.id || uuidv4(), // Ensure field IDs are retained or generated
                    ref: React.createRef(),
                    styles: { ...defaultFieldStyles, ...(f.styles || {}) } // Load individual field styles
                }))
                }))
            }));
            setFormRows(loadedRows);
            setSelectedFormId(formId);
            setSuccessMessage('Form loaded successfully!');
            generateSnippet(formId);
        } catch (err) {
            console.error('Error loading form:', err);
            setError(err.response?.data?.message || 'Failed to load form.');
        } finally {
            setLoading(false);
        }
    }, [generateSnippet]);

    const handleNewForm = useCallback(() => {
        setFormName('');
        setFormPurpose('general'); // Reset purpose to default
        setFormRows([]);
        setSelectedFormId('');
        setFormStyles(defaultGlobalStyles);
        setEditingField(null);
        setIsSettingsModalOpen(false);
        setError(null);
        setSuccessMessage(null);
        setGeneratedEmbedSnippet('');
    }, []);
    
    const handleGlobalStyleChange = (e) => {
        const { name, value } = e.target;
        setFormStyles(prevStyles => ({
            ...prevStyles,
            [name]: value
        }));
    };

    const handleFormPurposeChange = (e) => {
        setFormPurpose(e.target.value);
    };
    
    const moveRow = useCallback((dragIndex, hoverIndex) => {
        setFormRows(prevRows => {
            const newRows = [...prevRows];
            const [draggedRow] = newRows.splice(dragIndex, 1);
            newRows.splice(hoverIndex, 0, draggedRow);
            return newRows;
        });
    }, []);

    const [, dropCanvas] = useDrop(() => ({
        accept: [ItemTypes.FIELD_TYPE, ItemTypes.ROW],
        drop: (item, monitor) => {
            if (monitor.didDrop()) {
                return;
            }
            if (item.type === ItemTypes.FIELD_TYPE) {
                // NEW LOGIC FOR TASK_ITEM
                if (item.fieldType === 'task_item') {
                    const taskItemId = uuidv4();
                    const taskNameField = {
                        id: uuidv4(), label: 'Task Description', name: `task_${taskItemId}_description`, type: 'text', placeholder: 'Enter task description', required: true, styles: { ...defaultFieldStyles }, mapping: `task_item.${taskItemId}.description`
                    };
                    const completedField = {
                        id: uuidv4(), label: 'Completed?', name: `task_${taskItemId}_completed`, type: 'radio', options: ['Yes', 'No'], required: true, styles: { ...defaultFieldStyles }, mapping: `task_item.${taskItemId}.completed`
                    };
                    const reasonField = {
                        id: uuidv4(), label: 'Reason if not completed', name: `task_${taskItemId}_reason`, type: 'textarea', placeholder: 'Explain why task was not completed', required: true, conditional: { field: `task_${taskItemId}_completed`, value: 'No' }, styles: { ...defaultFieldStyles }, mapping: `task_item.${taskItemId}.reason`
                    };
                    const newRow = {
                        id: uuidv4(),
                        columns: [{ id: uuidv4(), width: 'full', fields: [taskNameField, completedField, reasonField] }]
                    };
                    setFormRows(prevRows => [...prevRows, newRow]);
                } else {
                    // Existing logic for other field types
                    const newField = {
                        id: uuidv4(),
                        label: item.label,
                        name: item.fieldType.toLowerCase().replace(' ', '_') + '_' + uuidv4().slice(0, 4),
                        type: item.fieldType,
                        placeholder: '',
                        required: false,
                        options: [],
                        ref: React.createRef(),
                        styles: { ...defaultFieldStyles }
                    };
                    const newRow = {
                        id: uuidv4(),
                        columns: [{ id: uuidv4(), width: 'full', fields: [newField] }]
                    };
                    setFormRows(prevRows => [...prevRows, newRow]);
                }
            } else if (item.type === ItemTypes.ROW) {
                const dragIndex = item.index;
                const hoverIndex = formRows.length - 1;
                if (dragIndex === hoverIndex) return;
                moveRow(dragIndex, hoverIndex);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [formRows, moveRow]); // Add formRows to dependency array for drop

    const moveField = useCallback((draggedFieldId, targetColumnId, targetRowId, hoverIndex, sourceColumnId, sourceRowId) => {
        setFormRows(prevRows => {
            const newRows = JSON.parse(JSON.stringify(prevRows));
            let draggedField = null;
            for (let i = 0; i < newRows.length; i++) {
                if (newRows[i].id === sourceRowId) {
                    for (let j = 0; j < newRows[i].columns.length; j++) {
                        if (newRows[i].columns[j].id === sourceColumnId) {
                            const foundIndex = newRows[i].columns[j].fields.findIndex(f => f.id === draggedFieldId);
                            if (foundIndex !== -1) {
                                [draggedField] = newRows[i].columns[j].fields.splice(foundIndex, 1);
                                break;
                            }
                        }
                    }
                }
                if (draggedField) break;
            }
            if (!draggedField) return prevRows;

            draggedField = { ...draggedField, ref: React.createRef(), styles: { ...defaultFieldStyles, ...(draggedField.styles || {}) } };

            for (let i = 0; i < newRows.length; i++) {
                if (newRows[i].id === targetRowId) {
                    for (let j = 0; j < newRows[i].columns.length; j++) {
                        if (newRows[i].columns[j].id === targetColumnId) {
                            newRows[i].columns[j].fields.splice(hoverIndex, 0, draggedField);
                            return newRows;
                        }
                    }
                }
            }
            return prevRows;
        });
    }, []);

    const addFieldToColumn = useCallback((rowId, columnId, newField, targetIndex = -1) => {
        setFormRows(prevRows =>
            prevRows.map(row =>
                row.id === rowId
                    ? {
                        ...row,
                        columns: row.columns.map(col =>
                            col.id === columnId
                                ? {
                                    ...col,
                                    fields:
                                        targetIndex === -1
                                            ? [...col.fields, { ...newField, ref: React.createRef(), styles: { ...defaultFieldStyles, ...(newField.styles || {}) } }]
                                            : [
                                                ...col.fields.slice(0, targetIndex),
                                                { ...newField, ref: React.createRef(), styles: { ...defaultFieldStyles, ...(newField.styles || {}) } },
                                                ...col.fields.slice(targetIndex),
                                            ],
                                }
                                : col
                        ),
                    }
                    : row
            )
        );
    }, []);

    const removeField = useCallback((rowId, columnId, fieldId) => {
        setFormRows(prevRows =>
            prevRows.map(row =>
                row.id === rowId
                    ? {
                        ...row,
                        columns: row.columns.map(col =>
                            col.id === columnId ? { ...col, fields: col.fields.filter(f => f.id !== fieldId) } : col
                        ),
                    }
                    : row
            )
        );
    }, []);

    const editField = useCallback((fieldToEdit) => {
        setEditingField({ ...fieldToEdit });
        setIsSettingsModalOpen(true);
    }, []);

    const saveFieldSettings = useCallback((updatedField) => {
        setFormRows(prevRows =>
            prevRows.map(row => ({
                ...row,
                columns: row.columns.map(col => ({
                    ...col,
                    fields: col.fields.map(field =>
                        field.id === updatedField.id ? { ...updatedField, ref: field.ref } : field
                    )
                }))
            }))
        );
        setIsSettingsModalOpen(false);
        setEditingField(null);
    }, []);
    
    const handleFormSave = async (isNew = true) => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const formSchemaToSave = formRows.map(row => ({
                id: row.id,
                columns: row.columns.map(col => ({
                    id: col.id, width: col.width,
                    fields: col.fields.map(field => {
                        const { ref, ...rest } = field;
                        return rest;
                    })
                }))
            }));
            const formPayload = {
                name: formName,
                schema: formSchemaToSave,
                settings: {
                    styles: formStyles
                },
                purpose: formPurpose, // Include formPurpose in payload
            };
            let res;
            if (selectedFormId && !isNew) {
                res = await api.put(`/forms/${selectedFormId}`, formPayload);
                setSuccessMessage('Form updated successfully!');
            } else {
                res = await api.post('/forms', formPayload);
                setSelectedFormId(res.data.form._id);
                setSuccessMessage('Form saved successfully!');
            }
            fetchForms();
            generateSnippet(res.data.form?._id || selectedFormId);
        } catch (err) {
            console.error('Error saving form:', err);
            setError(err.response?.data?.message || 'Failed to save form.');
        } finally {
            setLoading(false);
        }
    };

    const handleLoadExistingFormChange = (e) => {
        const formId = e.target.value;
        if (formId) {
            loadForm(formId);
        } else {
            handleNewForm();
        }
    };

    const addRow = useCallback((columns = 1) => {
        const newColumns = [];
        for (let i = 0; i < columns; i++) {
            newColumns.push({ id: uuidv4(), width: `${100 / columns}%`, fields: [] });
        }
        setFormRows(prevRows => [
            ...prevRows,
            { id: uuidv4(), columns: newColumns }
        ]);
    }, []);

    const removeRow = useCallback((rowId) => {
        setFormRows(prevRows => prevRows.filter(row => row.id !== rowId));
    }, []);

    const updateRowColumns = useCallback((rowId, newColumnCount) => {
        setFormRows(prevRows =>
            prevRows.map(row => {
                if (row.id === rowId) {
                    const newColumns = [];
                    let allFields = [];
                    row.columns.forEach(col => allFields = allFields.concat(col.fields));
                    for (let i = 0; i < newColumnCount; i++) {
                        newColumns.push({ id: uuidv4(), width: `${100 / newColumnCount}%`, fields: [] });
                    }
                    if (newColumns.length > 0) {
                        newColumns[0].fields = allFields;
                    }
                    return { ...row, columns: newColumns };
                }
                return row;
            })
        );
    }, []);

    const previewDefinition = {
        schema: formRows.map(row => ({
            id: row.id,
            columns: row.columns.map(col => ({
                id: col.id, width: col.width,
                fields: col.fields.map(field => { const { ref, ...rest } = field; return rest; })
            }))
        })),
        settings: {
            styles: formStyles
        },
        purpose: formPurpose, // Pass formPurpose to preview
    };

    return (
        <Fragment>
            <div className="p-8 bg-gray-50 min-h-screen flex">
                <div className="w-72 bg-white p-6 rounded-xl shadow-lg mr-8 h-fit sticky top-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3 border-gray-200">Form Elements</h2>
                    <div className="space-y-3">
                        <DraggableFieldType type="text" label="Text Input" icon={CursorArrowRaysIcon} />
                        <DraggableFieldType type="textarea" label="Text Area" icon={DocumentTextIcon} />
                        <DraggableFieldType type="email" label="Email" icon={EnvelopeIcon} />
                        <DraggableFieldType type="phone" label="Phone" icon={PhoneIcon} />
                        <DraggableFieldType type="select" label="Dropdown" icon={ListBulletIcon} />
                        <DraggableFieldType type="radio" label="Radio Group" icon={QueueListIcon} />
                        <DraggableFieldType type="checkbox" label="Checkbox" icon={CheckIcon} />
                        <DraggableFieldType type="date" label="Date" icon={CalendarIcon} />
                        <DraggableFieldType type="time" label="Time" icon={ClockIcon} />
                        <DraggableFieldType type="address" label="Address (Autocomplete)" icon={MapPinIcon} />
                        <DraggableFieldType type="file" label="File Upload" icon={ArrowUpTrayIcon} />
                        {/* NEW Draggable Field Type for Task Item */}
                        <DraggableFieldType type="task_item" label="Task Item (Staff Only)" icon={ClipboardDocumentListIcon} />
                    </div>
                </div>

                <div className="flex-1 bg-white p-8 rounded-xl shadow-lg">
                    <div className="mb-6 flex space-x-4 items-start">
                        <div className="flex-1">
                            <ModernInput
                                label="Form Name"
                                name="formName"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g. Website Contact Form"
                                required
                            />
                        </div>
                        <div className="flex items-end space-x-4 h-full pt-6">
                            <ModernSelect
                                label="Load Existing Form"
                                name="loadForm"
                                value={selectedFormId}
                                onChange={handleLoadExistingFormChange}
                                options={[{ value: '', label: 'Select a form' }, ...formsList.map(f => ({ value: f._id, label: f.name }))]}
                            />
                            <button type="button" onClick={handleNewForm} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">New</button>
                        </div>
                    </div>

                    <div className="border-b border-gray-200 mb-6">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button onClick={() => setActiveTab('canvas')} className={`${activeTab === 'canvas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Form Canvas
                            </button>
                            <button onClick={() => setActiveTab('styling')} className={`${activeTab === 'styling' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Styling & Branding
                            </button>
                            <button onClick={() => setActiveTab('embed')} className={`${activeTab === 'embed' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}>
                                <CodeBracketIcon className="h-5 w-5 mr-1" /> Embed Code
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'canvas' && (
                        <div ref={dropCanvas} className="min-h-[500px] border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 relative">
                            {loading && formRows.length === 0 ? <Loader /> : (
                                formRows.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                        <p className="text-lg mb-4">Drag a field from the left to start a new row, or click "Add Row" below.</p>
                                        <button type="button" onClick={() => addRow(1)} className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold shadow-md flex items-center">
                                            <PlusCircleIcon className="h-5 w-5 mr-2" /> Add First Row
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {formRows.map((row, rowIndex) => (
                                            <RowComponent key={row.id} row={row} rowIndex={rowIndex} removeRow={removeRow} updateRowColumns={updateRowColumns} moveField={moveField} removeField={removeField} editField={editField} addFieldToColumn={addFieldToColumn} moveRow={moveRow} />
                                        ))}
                                        <div className="mt-4 text-center">
                                            <button type="button" onClick={() => addRow(1)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium shadow-sm transition-colors duration-200 flex items-center mx-auto">
                                                <PlusCircleIcon className="h-5 w-5 mr-2" /> Add New Row
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {activeTab === 'styling' && (
                        <div className="p-6 border rounded-lg bg-gray-50/80 space-y-6">
                            {/* NEW: Form Purpose Selector */}
                            <ModernSelect
                                label="Form Purpose"
                                name="formPurpose"
                                value={formPurpose}
                                onChange={handleFormPurposeChange}
                                options={formPurposeOptions}
                                helpText="Defines how form submissions are processed (e.g., create customer, generate quote)."
                            />

                            <div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-4">Branding</h3>
                                <ModernInput
                                    label="Company Logo URL"
                                    name="logoUrl"
                                    value={formStyles.logoUrl}
                                    onChange={handleGlobalStyleChange}
                                    placeholder="https://example.com/logo.png"
                                    helpText="Paste a direct link to your hosted logo image."
                                />
                            </div>
                              <div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-4">Colors & Appearance</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="flex flex-col">
                                        <label htmlFor="backgroundColor" className="mb-2 text-sm font-medium text-gray-700">Background Color</label>
                                        <input id="backgroundColor" name="backgroundColor" type="color" value={formStyles.backgroundColor} onChange={handleGlobalStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label htmlFor="primaryColor" className="mb-2 text-sm font-medium text-gray-700">Primary Color (Buttons)</label>
                                        <input id="primaryColor" name="primaryColor" type="color" value={formStyles.primaryColor} onChange={handleGlobalStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label htmlFor="borderColor" className="mb-2 text-sm font-medium text-gray-700">Border Color</label>
                                        <input id="borderColor" name="borderColor" type="color" value={formStyles.borderColor} onChange={handleGlobalStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label htmlFor="labelColor" className="mb-2 text-sm font-medium text-gray-700">Label Color</label>
                                        <input id="labelColor" name="labelColor" type="color" value={formStyles.labelColor} onChange={handleGlobalStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                                    </div>
                                    <ModernInput
                                        label="Input/Button Border Radius"
                                        name="borderRadius"
                                        type="range"
                                        value={parseFloat(formStyles.borderRadius)}
                                        onChange={handleGlobalStyleChange}
                                        min="0"
                                        max="20"
                                        step="0.1"
                                        helpText={`Current: ${formStyles.borderRadius}. Adjust the roundness of input and button corners (e.g. 0 for square, 0.375rem for rounded-md).`}
                                        className="col-span-full md:col-span-1"
                                    />
                                    <ModernInput
                                        label="Input/Button Border Width (px)"
                                        name="globalBorderWidth"
                                        type="number"
                                        value={formStyles.globalBorderWidth}
                                        onChange={handleGlobalStyleChange}
                                        min="0"
                                        max="5"
                                        helpText="Thickness of borders for inputs and buttons."
                                    />
                                    <ModernSelect
                                        label="Input/Button Border Style"
                                        name="globalBorderStyle"
                                        value={formStyles.globalBorderStyle}
                                        onChange={handleGlobalStyleChange}
                                        options={borderStyleOptions}
                                        helpText="Style of borders for inputs and buttons."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'embed' && (
                        <div className="p-6 border rounded-lg bg-gray-50/80 space-y-6">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                <CodeBracketIcon className="h-6 w-6 mr-2 text-gray-700" /> Embed Form on Your Website
                            </h3>
                            <p className="text-gray-600">
                                Copy and paste the HTML snippet below into your website's `&lt;body&gt;` section where you want the form to appear.
                                Ensure your form is saved to generate the latest snippet.
                            </p>
                            
                            {selectedFormId ? (
                                <>
                                    <button
                                        onClick={() => generateSnippet(selectedFormId)}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-semibold shadow-sm transition-colors"
                                        disabled={loading}
                                    >
                                        {loading ? 'Generating...' : 'Regenerate Embed Code'}
                                    </button>
                                    {generatedEmbedSnippet && (
                                        <div className="mt-4">
                                            <label htmlFor="embed-code" className="block text-sm font-medium text-gray-700 mb-2">Your Embed Code:</label>
                                            <textarea
                                                id="embed-code"
                                                readOnly
                                                value={generatedEmbedSnippet}
                                                className="w-full h-48 p-3 border border-gray-300 rounded-md bg-gray-100 font-mono text-sm resize-y focus:ring-blue-500 focus:border-blue-500"
                                                onClick={(e) => e.target.select()}
                                                placeholder="Embed code will appear here after saving your form."
                                            ></textarea>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(generatedEmbedSnippet)}
                                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-sm transition-colors disabled:opacity-50"
                                                disabled={!generatedEmbedSnippet || loading}
                                            >
                                                Copy to Clipboard
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-gray-500">Save your form first to generate an embed code.</p>
                            )}
                        </div>
                    )}

                    <div className="mt-8 text-right">
                        <button type="button" onClick={() => setIsPreviewModalOpen(true)} className="px-6 py-3 mr-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-semibold shadow-lg transition-colors duration-200" disabled={loading || !formName || (activeTab === 'canvas' && formRows.length === 0)}>
                            <EyeIcon className="h-5 w-5 inline-block mr-2" /> Preview Form
                        </button>
                        <button type="button" onClick={() => handleFormSave(false)} className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-lg transition-colors duration-200" disabled={loading || !formName}>
                            {loading ? 'Saving...' : 'Save Form'}
                        </button>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
                            {successMessage}
                        </div>
                    )}
                </div>
            </div>

            {isPreviewModalOpen && (
                <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="Form Preview" maxWidthClass="max-w-4xl">
                    <FormRenderer formDefinition={previewDefinition} isPreview={true} />
                </Modal>
            )}

            {isSettingsModalOpen && editingField && (
                <FieldSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} field={editingField} onSave={saveFieldSettings} />
            )}
        </Fragment>
    );
};

export default FormBuilderPage;