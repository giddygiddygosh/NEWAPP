// src/components/forms/FormRenderer.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { useLocation } from 'react-router-dom';

const libraries = ['places'];

const UK_BOUNDS = {
    north: 60.86,
    south: 49.88,
    west: -8.65,
    east: 1.77,
};

const defaultGlobalStyles = {
    backgroundColor: '#FFFFFF',
    primaryColor: '#2563EB',
    borderColor: '#D1D5DB',
    labelColor: '#111827',
    logoUrl: '',
    borderRadius: '0.375rem',
    globalBorderWidth: 1,
    globalBorderStyle: 'solid',
};

const defaultFieldStyles = {
    labelColor: '#111827',
    inputTextColor: '#111827',
    inputBackgroundColor: '#FFFFFF',
    inputBorderColor: '#D1D5DB',
    inputBorderRadius: '0.375rem',
    inputBorderWidth: 1,
    inputBorderStyle: 'solid',
};


const FormRenderer = ({ formDefinition, onSubmit, isPreview = false }) => {
    const [formData, setFormData] = useState({});
    const [submitStatus, setSubmitStatus] = useState('idle');
    const [submitMessage, setSubmitMessage] = useState('');
    const [formErrors, setFormErrors] = useState({});

    const autocompleteRefs = useRef({});
    const location = useLocation();

    const schema = formDefinition?.schema || [];
    const globalStyles = { ...defaultGlobalStyles, ...(formDefinition?.settings?.styles || {}) };

    const queryParams = new URLSearchParams(location.search);
    const associatedLeadId = queryParams.get('leadId');

    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.REACT_APP_MAPS_API_KEY,
        libraries,
    });

    const isFieldVisible = useCallback((field) => {
        if (!field.conditional || isPreview) {
            return true;
        }

        const watchedFieldName = field.conditional.field;
        const requiredValue = field.conditional.value;

        const watchedFieldValue = formData[watchedFieldName];

        return watchedFieldValue !== undefined && watchedFieldValue === requiredValue;
    }, [formData, isPreview]);

    useEffect(() => {
        const initialData = {};
        if (Array.isArray(schema)) {
            schema.forEach(row => {
                row.columns.forEach(column => {
                    column.fields.forEach(field => {
                        if (field.type === 'checkbox') {
                            initialData[field.name] = false;
                        } else if (field.type === 'address') {
                            initialData[field.name] = { street: '', city: '', county: '', postcode: '', country: '' };
                        } else if (field.type === 'file') {
                            initialData[field.name] = null;
                        } else if (field.type === 'radio') {
                            initialData[field.name] = '';
                        }
                        else {
                            initialData[field.name] = '';
                        }
                    });
                });
            });
        }
        setFormData(initialData);
        setSubmitStatus('idle');
        setSubmitMessage('');
        setFormErrors({});
    }, [schema]);

    const handleChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (formErrors[name]) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }

        if (type === 'file') {
            setFormData(prev => ({ ...prev, [name]: files[0] }));
            return;
        }

        const parts = name.split('_');
        if (parts.length > 1) {
            const fieldName = parts[0];
            const subField = parts.slice(1).join('_');
            const fieldSchema = schema.flatMap(r => r.columns.flatMap(c => c.fields)).find(f => f.name === fieldName);

            if (fieldSchema && fieldSchema.type === 'address') {
                setFormData(prev => ({ ...prev, [fieldName]: { ...(prev[fieldName] || {}), [subField]: value } }));
                return;
            }
        }

        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };


    const onPlaceChanged = useCallback((fieldName, autocompleteInstance) => {
        if (!autocompleteInstance) return;
        const place = autocompleteInstance.getPlace();
        if (place.address_components) {
            let streetNumber = '', route = '', city = '', county = '', postcode = '', country = '';
            for (const component of place.address_components) {
                const type = component.types[0];
                switch (type) {
                    case 'street_number': streetNumber = component.long_name; break;
                    case 'route': route = component.long_name; break;
                    case 'postal_town': city = component.long_name; break;
                    case 'locality': if (!city) city = component.long_name; break;
                    case 'administrative_area_level_2': county = component.long_name; break;
                    case 'postal_code': postcode = component.long_name; break;
                    case 'country': country = component.long_name; break;
                    default: break;
                }
            }
            setFormData(prev => ({ ...prev, [fieldName]: { street: `${streetNumber} ${route}`.trim(), city, county, postcode, country } }));
        }
    }, []);

    const validateForm = useCallback(() => {
        const newErrors = {};
        let isValid = true;
        schema.forEach(row => {
            row.columns.forEach(column => {
                column.fields.forEach(field => {
                    // Only validate visible fields
                    if (!isFieldVisible(field)) {
                        return;
                    }

                    // Check required fields based on field.required property
                    if (field.required) {
                        const value = formData[field.name];
                        const isValueEmpty = !value || (typeof value === 'string' && value.trim() === '') || (field.type === 'address' && Object.values(value || {}).every(v => !v));

                        if (isValueEmpty) {
                            newErrors[field.name] = `${field.label || field.name} is required.`;
                            isValid = false;
                            console.log(`Validation failed: Required field missing: ${field.name} (${field.label})`); // DEBUG LOG
                        }
                    }
                    // Specific field type validations (e.g., email format)
                    if (field.type === 'email' && formData[field.name] && !/.+@.+\..+/.test(formData[field.name])) {
                        newErrors[field.name] = 'Invalid email format.';
                        isValid = false;
                        console.log(`Validation failed: Invalid email format for ${field.name} (${field.label})`); // DEBUG LOG
                    }
                });
            });
        });

        // Debug log all collected errors
        if (!isValid) {
            console.log("Form validation failed with errors:", newErrors);
        } else {
            console.log("Form validation passed on frontend.");
        }

        setFormErrors(newErrors);
        return isValid;
    }, [formData, schema, isFieldVisible]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitStatus('loading');
        setSubmitMessage('');
        setFormErrors({});

        // NEW: Always run validation first on the frontend
        if (!validateForm()) {
            setSubmitStatus('error');
            setSubmitMessage('Please correct the errors in the form.');
            return;
        }

        const submissionPayload = {
            formData: formData,
            formId: formDefinition._id,
            associatedLeadId: associatedLeadId
        };

        if (onSubmit) {
            try {
                await onSubmit(submissionPayload);
                setSubmitStatus('success');
                setSubmitMessage('Form submitted successfully!');
                setFormData({});
            } catch (err) {
                setSubmitStatus('error');
                setSubmitMessage(err.response?.data?.message || err.message || 'Form submission failed.');
                if (err.response?.data?.errors) {
                    setFormErrors(err.response.data.errors);
                }
                console.error("Submission error details:", err.response?.data || err); // DEBUG LOG
            }
        } else {
            console.log('Form data submitted (preview mode):', submissionPayload);
            setSubmitStatus('success');
            setSubmitMessage('Form data collected (preview mode).');
        }
    };

    const renderField = (field) => {
        const mergedFieldStyles = {
            labelColor: field.styles?.labelColor || globalStyles.labelColor,
            inputTextColor: field.styles?.inputTextColor || globalStyles.inputTextColor,
            inputBackgroundColor: field.styles?.inputBackgroundColor || globalStyles.backgroundColor,
            inputBorderColor: field.styles?.inputBorderColor || globalStyles.borderColor,
            inputBorderRadius: field.styles?.inputBorderRadius || globalStyles.borderRadius,
            inputBorderWidth: field.styles?.inputBorderWidth || globalStyles.globalBorderWidth,
            inputBorderStyle: field.styles?.inputBorderStyle || globalStyles.globalBorderStyle,
        };

        const currentLabelStyle = { color: mergedFieldStyles.labelColor };
        const commonInputProps = {
            labelStyle: currentLabelStyle,
            name: field.name,
            value: formData[field.name] || '',
            onChange: handleChange,
            required: field.required,
            placeholder: field.placeholder,
            borderColor: mergedFieldStyles.inputBorderColor,
            borderWidth: mergedFieldStyles.inputBorderWidth,
            borderStyle: mergedFieldStyles.inputBorderStyle,
            inputTextColor: mergedFieldStyles.inputTextColor,
            inputBackgroundColor: mergedFieldStyles.inputBackgroundColor,
            borderRadius: mergedFieldStyles.inputBorderRadius,
            min: field.min,
            max: field.max,
            step: field.step,
        };

        if (!isFieldVisible(field)) {
            return null;
        }

        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
            case 'date':
            case 'time':
                return <ModernInput type={field.type === 'phone' ? 'tel' : field.type} {...commonInputProps} />;
            case 'textarea':
                return <ModernInput textarea {...commonInputProps} />;
            case 'select':
                return <ModernSelect options={field.options.map(opt => ({ value: opt, label: opt }))} {...commonInputProps} />;
            case 'radio':
                return (
                    <div role="radiogroup" className="p-3 border rounded-md bg-gray-50/50" style={{ borderColor: mergedFieldStyles.inputBorderColor, borderRadius: mergedFieldStyles.inputBorderRadius, borderWidth: mergedFieldStyles.inputBorderWidth ? `${mergedFieldStyles.inputBorderWidth}px` : undefined, borderStyle: mergedFieldStyles.inputBorderStyle, backgroundColor: mergedFieldStyles.inputBackgroundColor }}>
                        <label className="block text-sm font-medium mb-2" style={currentLabelStyle}>{field.label}</label>
                        <div className="space-y-2" style={{ color: mergedFieldStyles.inputTextColor }}>
                        {(field.options || []).map(option => (
                            <div key={option} className="flex items-center">
                                <input id={`${field.name}-${option}`} name={field.name} type="radio" value={option} checked={formData[field.name] === option} onChange={handleChange} style={{ accentColor: globalStyles.primaryColor }} className="h-4 w-4 border-gray-300 focus:ring-blue-500" />
                                <label htmlFor={`${field.name}-${option}`} className="ml-3 block text-sm font-medium" style={currentLabelStyle}>{option}</label>
                            </div>
                        ))}
                        </div>
                    </div>
                );
            case 'file':
                return (
                    <div className="p-3 border rounded-md bg-gray-50/50" style={{ borderColor: mergedFieldStyles.inputBorderColor, borderRadius: mergedFieldStyles.inputBorderRadius, borderWidth: mergedFieldStyles.inputBorderWidth ? `${mergedFieldStyles.inputBorderWidth}px` : undefined, borderStyle: mergedFieldStyles.inputBorderStyle, backgroundColor: mergedFieldStyles.inputBackgroundColor }}>
                        <label htmlFor={field.name} className="block text-sm font-medium" style={currentLabelStyle}>{field.label}</label>
                        <input id={field.name} name={field.name} type="file" onChange={handleChange} className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                );
            case 'checkbox':
                return (
                    <div className="p-3 border rounded-md bg-gray-50/50 hover:bg-gray-100/50 transition-colors duration-150" style={{ borderColor: mergedFieldStyles.inputBorderColor, borderRadius: mergedFieldStyles.inputBorderRadius, borderWidth: mergedFieldStyles.inputBorderWidth ? `${mergedFieldStyles.inputBorderWidth}px` : undefined, borderStyle: mergedFieldStyles.inputBorderStyle, backgroundColor: mergedFieldStyles.inputBackgroundColor }}>
                        <div className="flex items-center">
                            <input id={field.name} name={field.name} type="checkbox" checked={formData[field.name] || false} onChange={handleChange} style={{ accentColor: globalStyles.primaryColor }} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor={field.name} className="ml-3 block text-sm font-medium" style={currentLabelStyle}>{field.label}</label>
                        </div>
                    </div>
                );
            case 'address':
                const addressInputName = `${field.name}_search`;
                return (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium" style={currentLabelStyle}>{field.label}</label>
                        {isLoaded &&
                            <Autocomplete
                                onLoad={(autocomplete) => { autocompleteRefs.current[field.name] = autocomplete; }}
                                onPlaceChanged={() => onPlaceChanged(field.name, autocompleteRefs.current[field.name])}
                                options={{ types: ['address'], componentRestrictions: { country: ['uk', 'us'] }, bounds: UK_BOUNDS, strictBounds: false }}
                            >
                                <ModernInput
                                    label="Street Address Search"
                                    name={addressInputName}
                                    placeholder={field.placeholder || "Start typing your address..."}
                                    value={formData[field.name]?.street_search || ''}
                                    onChange={handleChange}
                                    borderColor={mergedFieldStyles.inputBorderColor}
                                    borderWidth={mergedFieldStyles.inputBorderWidth}
                                    borderStyle={mergedFieldStyles.inputBorderStyle}
                                    inputTextColor={mergedFieldStyles.inputTextColor}
                                    inputBackgroundColor={mergedFieldStyles.inputBackgroundColor}
                                    borderRadius={mergedFieldStyles.inputBorderRadius}
                                />
                            </Autocomplete>
                        }
                        {!isLoaded && loadError && <p className="text-red-500 text-xs">Error loading Google Maps for address autocomplete.</p>}
                        {!isLoaded && !loadError && <p className="text-gray-500 text-xs">Loading address autocomplete...</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ModernInput labelStyle={currentLabelStyle} label="Street Address" name={`${field.name}_street`} value={formData[field.name]?.street || ''} onChange={handleChange} {...{borderColor: mergedFieldStyles.inputBorderColor, borderWidth: mergedFieldStyles.inputBorderWidth, borderStyle: mergedFieldStyles.inputBorderStyle, inputTextColor: mergedFieldStyles.inputTextColor, inputBackgroundColor: mergedFieldStyles.inputBackgroundColor, borderRadius: mergedFieldStyles.inputBorderRadius}} />
                            <ModernInput labelStyle={currentLabelStyle} label="City" name={`${field.name}_city`} value={formData[field.name]?.city || ''} onChange={handleChange} {...{borderColor: mergedFieldStyles.inputBorderColor, borderWidth: mergedFieldStyles.inputBorderWidth, borderStyle: mergedFieldStyles.inputBorderStyle, inputTextColor: mergedFieldStyles.inputTextColor, inputBackgroundColor: mergedFieldStyles.inputBackgroundColor, borderRadius: mergedFieldStyles.inputBorderRadius}} />
                            <ModernInput labelStyle={currentLabelStyle} label="County" name={`${field.name}_county`} value={formData[field.name]?.county || ''} onChange={handleChange} {...{borderColor: mergedFieldStyles.inputBorderColor, borderWidth: mergedFieldStyles.inputBorderWidth, borderStyle: mergedFieldStyles.inputBorderStyle, inputTextColor: mergedFieldStyles.inputTextColor, inputBackgroundColor: mergedFieldStyles.inputBackgroundColor, borderRadius: mergedFieldStyles.inputBorderRadius}} />
                            <ModernInput labelStyle={currentLabelStyle} label="Postcode" name={`${field.name}_postcode`} value={formData[field.name]?.postcode || ''} onChange={handleChange} {...{borderColor: mergedFieldStyles.inputBorderColor, borderWidth: mergedFieldStyles.inputBorderWidth, borderStyle: mergedFieldStyles.inputBorderStyle, inputTextColor: mergedFieldStyles.inputTextColor, inputBackgroundColor: mergedFieldStyles.inputBackgroundColor, borderRadius: mergedFieldStyles.inputBorderRadius}} />
                            <div className="md:col-span-2">
                                <ModernInput labelStyle={currentLabelStyle} label="Country" name={`${field.name}_country`} value={formData[field.name]?.country || ''} onChange={handleChange} {...{borderColor: mergedFieldStyles.inputBorderColor, borderWidth: mergedFieldStyles.inputBorderWidth, borderStyle: mergedFieldStyles.inputBorderStyle, inputTextColor: mergedFieldStyles.inputTextColor, inputBackgroundColor: mergedFieldStyles.inputBackgroundColor, borderRadius: mergedFieldStyles.inputBorderRadius}} />
                            </div>
                        </div>
                    </div>
                );
            default:
                return <p className="text-red-500">Unknown field type: {field.type}</p>;
        }
    };

    if (!schema || schema.length === 0) {
        return <div className="text-gray-600">No form schema provided to render.</div>;
    }

    return (
        <div className="p-6 rounded-lg" style={{ backgroundColor: globalStyles.backgroundColor }}>
            {globalStyles.logoUrl && (
                <div className="mb-6 text-center">
                    <img src={globalStyles.logoUrl} alt="Company Logo" className="mx-auto h-16 w-auto" />
                </div>
            )}

            <h2 className="text-2xl font-bold mb-2" style={{color: globalStyles.labelColor}}>Form Preview</h2>
            <p className="text-gray-600 mb-6">This is how your form will appear to visitors.</p>

            {submitStatus === 'success' && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{submitMessage}</div>}
            {submitStatus === 'error' && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{submitMessage}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
                {schema.map(row => (
                    <div key={row.id} className={`grid gap-x-6 gap-y-4 ${
                        row.columns.length === 1 ? 'grid-cols-1' :
                        row.columns.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                        'grid-cols-1 md:grid-cols-3'
                    }`}>
                        {row.columns.map(column => (
                            <div key={column.id} className="flex flex-col space-y-4">
                                {column.fields.map(field => (
                                    <div key={field.id}>
                                        {renderField(field)}
                                        {formErrors[field.name] && <p className="text-red-500 text-xs mt-1">{formErrors[field.name]}</p>}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
                <button type="submit"
                    className="w-full px-4 py-3 text-white font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-colors duration-200"
                    style={{
                        backgroundColor: globalStyles.primaryColor,
                        borderRadius: globalStyles.borderRadius,
                        borderWidth: globalStyles.globalBorderWidth ? `${globalStyles.globalBorderWidth}px` : undefined,
                        borderStyle: globalStyles.globalBorderStyle,
                        borderColor: globalStyles.borderColor,
                    }}
                    disabled={submitStatus === 'loading' || isPreview}
                >
                    {submitStatus === 'loading' ? 'Submitting...' : 'Submit Form'}
                </button>
            </form>
        </div>
    );
};

export default FormRenderer;