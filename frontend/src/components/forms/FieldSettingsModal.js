import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';

const FieldSettingsModal = ({ isOpen, onClose, field, onSave }) => {
    const [localField, setLocalField] = useState(field);

    const defaultFieldStyles = {
        labelColor: '#111827',
        inputTextColor: '#111827',
        inputBackgroundColor: '#FFFFFF',
        inputBorderColor: '#D1D5DB',
        inputBorderRadius: '0.375rem',
        inputBorderWidth: 1,
        inputBorderStyle: 'solid',
    };

    // FIXED: Include Lead: Primary Phone in the mapping options
    const crmFieldMappingOptions = [
        { value: '', label: 'Do Not Map' },
        { value: 'lead.contactPersonName', label: 'Lead: Full Name (Primary Contact)' },
        { value: 'lead.email', label: 'Lead: Primary Email' },
        { value: 'lead.phone', label: 'Lead: Primary Phone' }, // Added back the phone mapping
    ];

    const borderStyleOptions = [
        { value: '', label: 'Inherit from Global' },
        { value: 'none', label: 'None' },
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' },
    ];


    useEffect(() => {
        setLocalField({
            ...field,
            styles: {
                ...defaultFieldStyles,
                ...(field.styles || {})
            },
            mapping: field.mapping || '',
            conditional: field.conditional || null,
            options: field.options || [],
            required: field.required ?? false,
            placeholder: field.placeholder || '',
        });
    }, [field, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setLocalField(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleStyleChange = (e) => {
        const { name, value } = e.target;
        setLocalField(prev => ({
            ...prev,
            styles: {
                ...prev.styles,
                [name]: value
            }
        }));
    };

    const handleMappingChange = (e) => {
        setLocalField(prev => ({
            ...prev,
            mapping: e.target.value
        }));
    };

    const handleConditionalChange = (e) => {
        const { name, value } = e.target;
        setLocalField(prev => ({
            ...prev,
            conditional: {
                ...prev.conditional,
                [name]: value
            }
        }));
    };

    const handleOptionsChange = (index, value) => {
        const newOptions = [...localField.options];
        newOptions[index] = value;
        setLocalField(prev => ({ ...prev, options: newOptions }));
    };

    const addOption = () => {
        setLocalField(prev => ({ ...prev, options: [...prev.options, ''] }));
    };

    const removeOption = (index) => {
        setLocalField(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(localField);
    };

    const fieldTypeOptions = [
        { value: 'text', label: 'Text Input' },
        { value: 'textarea', label: 'Text Area' },
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
        { value: 'select', label: 'Dropdown' },
        { value: 'radio', label: 'Radio Group' },
        { value: 'checkbox', label: 'Checkbox' },
        { value: 'date', label: 'Date' },
        { value: 'time', label: 'Time' },
        { value: 'address', label: 'Address (Autocomplete)' },
        { value: 'file', label: 'File Upload' },
    ];


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Field: ${localField.label}`} maxWidthClass="max-w-xl">
            <form onSubmit={handleSubmit} className="p-4 space-y-6">
                <ModernInput
                    label="Field Label"
                    name="label"
                    value={localField.label}
                    onChange={handleChange}
                    required
                />
                <ModernInput
                    label="Field Name (Unique Identifier)"
                    name="name"
                    value={localField.name}
                    onChange={handleChange}
                    required
                    helpText="Must be unique (e.g., first_name). Used for data collection."
                />
                <ModernSelect
                    label="Field Type"
                    name="type"
                    value={localField.type}
                    onChange={handleChange}
                    options={fieldTypeOptions}
                    required
                />
                <ModernInput
                    label="Placeholder Text"
                    name="placeholder"
                    value={localField.placeholder || ''}
                    onChange={handleChange}
                    helpText="Hint text displayed inside the input field."
                />
                <div className="flex items-center">
                    <input
                        id="required-checkbox"
                        type="checkbox"
                        name="required"
                        checked={localField.required}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="required-checkbox" className="ml-2 block text-sm text-gray-900">
                        Required Field
                    </label>
                </div>

                {(localField.type === 'select' || localField.type === 'radio') && (
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center">
                            Options
                            <button type="button" onClick={addOption} className="ml-auto px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center">
                                Add
                            </button>
                        </h3>
                        {localField.options.length === 0 && <p className="text-gray-500 text-sm">No options added yet.</p>}
                        {localField.options.map((option, index) => (
                            <div key={index} className="relative flex items-center gap-2">
                                <ModernInput
                                    name={`option-${index}`}
                                    value={option}
                                    onChange={(e) => handleOptionsChange(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                    className="flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeOption(index)}
                                    className="text-red-500 hover:text-red-700"
                                    title="Remove Option"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.927a2.25 2.25 0 01-2.244-2.077L4.74 5.79m14.232-.744l-1.39-1.39A.75.75 0 0016.732 3H7.268a.75.75 0 00-.53 1.28l-1.39 1.39M4.26 5.25a.75.75 0 000 1.5h.375a.75.75 0 000-1.5H4.26z" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-4 border border-gray-200 rounded-lg bg-yellow-50 space-y-3">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">CRM Field Mapping (For Specific Form Purposes)</h3>
                    <p className="text-sm text-gray-600 mb-3">Map this form field's data to a specific CRM Customer, Lead, or Booking property. This is essential for automatically populating records from form submissions.</p>
                    <ModernSelect
                        label="Map to CRM Field"
                        name="mapping"
                        value={localField.mapping || ''}
                        onChange={handleMappingChange}
                        options={crmFieldMappingOptions}
                        helpText="Select the CRM field this form field should populate."
                    />
                </div>

                {localField.type !== 'radio' && localField.type !== 'checkbox' && (
                    <div className="p-4 border border-gray-200 rounded-lg bg-indigo-50 space-y-3">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Conditional Visibility</h3>
                        <p className="text-sm text-gray-600 mb-3">Make this field visible only when another field has a specific value. This helps create dynamic forms.</p>
                        <ModernInput
                            label="Field Name to Watch"
                            name="field"
                            value={localField.conditional?.field || ''}
                            onChange={handleConditionalChange}
                            placeholder="e.g., 'completed_radio_1234'"
                            helpText="The unique 'Field Name' (from General Settings) of the field that controls this one's visibility."
                        />
                        <ModernInput
                            label="Required Value to Show"
                            name="value"
                            value={localField.conditional?.value || ''}
                            onChange={handleConditionalChange}
                            placeholder="e.g., 'No'"
                            helpText="The exact value of the watched field that makes THIS field visible."
                        />
                        {localField.conditional?.field && localField.conditional?.value && (
                            <div className="text-sm text-green-700">
                                This field will show if <strong>{localField.conditional.field}</strong> is <strong>{localField.conditional.value}</strong>.
                            </div>
                        )}
                    </div>
                )}


                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Field Styling (Overrides Global)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col">
                            <label htmlFor="field-labelColor" className="mb-2 text-sm font-medium text-gray-700">Label Color</label>
                            <input id="field-labelColor" name="labelColor" type="color" value={localField.styles.labelColor || defaultFieldStyles.labelColor} onChange={handleStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="field-inputTextColor" className="mb-2 text-sm font-medium text-gray-700">Input Text Color</label>
                            <input id="field-inputTextColor" name="inputTextColor" type="color" value={localField.styles.inputTextColor || defaultFieldStyles.inputTextColor} onChange={handleStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="field-inputBackgroundColor" className="mb-2 text-sm font-medium text-gray-700">Input Background</label>
                            <input id="field-inputBackgroundColor" name="inputBackgroundColor" type="color" value={localField.styles.inputBackgroundColor || defaultFieldStyles.inputBackgroundColor} onChange={handleStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="field-inputBorderColor" className="mb-2 text-sm font-medium text-gray-700">Input Border Color</label>
                            <input id="field-inputBorderColor" name="inputBorderColor" type="color" value={localField.styles.inputBorderColor || defaultFieldStyles.inputBorderColor} onChange={handleStyleChange} className="w-full h-10 p-1 border-none cursor-pointer rounded-md" />
                        </div>
                           <ModernInput
                                label="Input Border Radius"
                                name="inputBorderRadius"
                                value={localField.styles.inputBorderRadius || defaultFieldStyles.inputBorderRadius}
                                onChange={handleStyleChange}
                                placeholder="e.g., 0.375rem or 8px"
                                helpText="Applies to input fields. e.g., 0.375rem (rounded-md)"
                            />
                           <ModernInput
                                label="Input Border Width (px)"
                                name="inputBorderWidth"
                                type="number"
                                value={localField.styles.inputBorderWidth || defaultFieldStyles.inputBorderWidth}
                                onChange={handleStyleChange}
                                min="0"
                                max="5"
                                helpText="Thickness of input borders."
                            />
                            <ModernSelect
                                label="Input Border Style"
                                name="inputBorderStyle"
                                value={localField.styles.inputBorderStyle || defaultFieldStyles.inputBorderStyle}
                                onChange={handleStyleChange}
                                options={borderStyleOptions}
                                helpText="Style of input borders."
                            />
                    </div>
                </div>


                <div className="flex justify-end space-x-2 mt-6">
                    <button type="button" onClick={onClose} className="px-6 py-3 mr-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200 text-lg font-medium shadow-sm">
                        Cancel
                    </button>
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 text-lg font-medium shadow-md">
                        Save Settings
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default FieldSettingsModal;