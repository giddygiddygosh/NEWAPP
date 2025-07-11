import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import ModernInput from '../common/ModernInput'; // Make sure this path is correct
import ModernSelect from '../common/ModernSelect'; // Make sure this path is correct
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

// === Helper Constants (moved from inside component to top level) ===
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
// === End Helper Constants ===


const FormRenderer = forwardRef(({ formDefinition, onSubmit, isPreview = false, isLoading: isSubmitting = false, submitButtonText = "Submit Form" }, ref) => {
    // === State variables (already defined here, good!) ===
    const [formData, setFormData] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [isFormSubmitted, setIsFormSubmitted] = useState(false);

    // === Refs (already defined here, good!) ===
    const autocompleteRefs = useRef({});

    // === Hooks (already defined here, good!) ===
    const location = useLocation();

    // === Memoized values (already defined here, good!) ===
    const schema = useMemo(() => formDefinition?.formSchema || [], [formDefinition]);
    const globalStyles = useMemo(() => ({ ...defaultGlobalStyles, ...(formDefinition?.settings?.styles || {}) }), [formDefinition]);

    // === Other variables / hooks ===
    const queryParams = new URLSearchParams(location.search);
    const associatedLeadId = queryParams.get('leadId');

    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.REACT_APP_MAPS_API_KEY,
        libraries, // Uses the 'libraries' constant defined above
    });

    // === Helper Functions (defined using useCallback, which is correct) ===
    const findFieldInSchema = useCallback((fieldName) => {
        for (const row of schema) {
            for (const col of (row.columns || [])) {
                const found = (col.fields || []).find(f => f.name === fieldName);
                if (found) return found;
            }
        }
        return null;
    }, [schema]); // 'schema' is correctly a dependency

    const initializeFormData = useCallback(() => {
        const initialData = {};
        if (Array.isArray(schema)) {
            schema.forEach(row => {
                (row.columns || []).forEach(column => {
                    (column.fields || []).forEach(field => {
                        if (field.type === 'address') {
                            initialData[field.name] = { street: '', city: '', county: '', postcode: '', country: '', fullAddress: '' };
                        } else if (field.type === 'checkbox') {
                            initialData[field.name] = false;
                        } else if (field.type === 'file') {
                            initialData[field.name] = null;
                        } else {
                            initialData[field.name] = '';
                        }
                    });
                });
            });
        }
        return initialData;
    }, [schema]); // 'schema' is correctly a dependency

    // useEffect and useImperativeHandle (already correctly defined)
    useEffect(() => {
        setFormData(initializeFormData());
        setFormErrors({});
        setIsFormSubmitted(false);
    }, [formDefinition?._id, initializeFormData]);

    useImperativeHandle(ref, () => ({
        resetForm() {
            setFormData(initializeFormData());
            setFormErrors({});
            setIsFormSubmitted(false);
        }
    }));

    const isFieldVisible = useCallback((field) => {
        if (!field.conditional || isPreview) {
            return true;
        }
        const watchedFieldName = field.conditional.field;
        const requiredValue = field.conditional.value;
        return formData[watchedFieldName] !== undefined && formData[watchedFieldName] === requiredValue;
    }, [formData, isPreview]); // 'formData' and 'isPreview' are correctly dependencies

    const validateField = useCallback((field, value, currentFormData, errorsAccumulator) => {
        const isValueEffectivelyEmpty = (val, type) => {
            if (val === null || val === undefined) return true;
            if (typeof val === 'string') return val.trim() === '';
            if (Array.isArray(val)) return val.length === 0;
            if (type === 'address' && typeof val === 'object') {
                return !val.fullAddress || val.fullAddress.trim() === '';
            }
            return false;
        };

        if (field.required && isValueEffectivelyEmpty(value, field.type)) {
            errorsAccumulator[field.name] = `${field.label || 'This field'} is required.`;
            return false;
        }

        if (field.type === 'email' && value && !/.+@.+\..+/.test(value)) {
            errorsAccumulator[field.name] = 'Invalid email format.';
            return false;
        }

        return true;
    }, []); // No external dependencies, but if currentFormData or other states are used in validation rules, add them.

    const handleChange = useCallback((e) => {
        const { name, value, type, checked, files } = e.target;

        if (type === 'file') {
            setFormData(prev => ({ ...prev, [name]: files[0] }));
            setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
            return;
        }

        const newValue = type === 'checkbox' ? checked : value;
        const parts = name.split('_');
        const isAddressSubField = parts.length > 1 && (parts.slice(0, -1).join('_').includes('address'));
        
        let rootFieldName = name;
        if (isAddressSubField) {
            rootFieldName = parts.slice(0, -1).join('_');
        }

        const fieldSchema = findFieldInSchema(rootFieldName); // Uses findFieldInSchema

        if (fieldSchema && fieldSchema.type === 'address') {
            const subFieldName = parts[parts.length - 1];
            setFormData(prev => ({
                ...prev,
                [rootFieldName]: {
                    ...(prev[rootFieldName] || initializeFormData()[rootFieldName]), // Uses initializeFormData
                    [subFieldName]: newValue
                }
            }));
            if (formErrors[rootFieldName]) { // Uses formErrors
                setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors[rootFieldName]; return newErrors; }); // Uses setFormErrors
            }
            return;
        }
        
        setFormData(prev => ({ ...prev, [name]: newValue })); // Uses setFormData
        
        if (isFormSubmitted && formErrors[name]) { // Uses isFormSubmitted, formErrors
            const fieldDef = findFieldInSchema(name); // Uses findFieldInSchema
            if (fieldDef) {
                const tempErrors = {};
                validateField(fieldDef, newValue, formData, tempErrors); // Uses validateField, formData
                if (!tempErrors[name]) {
                    setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; }); // Uses setFormErrors
                }
            }
        }
    }, [findFieldInSchema, formErrors, isFormSubmitted, formData, initializeFormData, validateField, setFormData, setFormErrors]); // Added missing dependencies to handleChange useCallback

    const validateForm = useCallback(() => {
        const newErrors = {};
        let allFieldsValid = true;

        schema.forEach(row => {
            (row.columns || []).forEach(column => {
                (column.fields || []).forEach(field => {
                    if (isFieldVisible(field)) {
                        const value = formData[field.name];
                        const isValid = validateField(field, value, formData, newErrors);
                        if (!isValid) {
                            allFieldsValid = false;
                        }
                    }
                });
            });
        });

        if (!allFieldsValid) {
            toast.error("Please correct the errors in the form.");
        }
        setFormErrors(newErrors);
        return allFieldsValid;
    }, [formData, schema, isFieldVisible, validateField]);

    const handleSubmitInternal = async (e) => {
        e.preventDefault();
        setIsFormSubmitted(true);

        if (isPreview) {
            toast.info('This is a form preview. Submissions are not processed.');
            return;
        }

        if (!validateForm()) {
            return;
        }
        
        const finalSubmissionPayload = {};

        const allFieldsInSchema = [];
        schema.forEach(row => {
            (row.columns || []).forEach(col => {
                (col.fields || []).forEach(field => {
                    allFieldsInSchema.push(field);
                });
            });
        });

        for (const internalFieldName in formData) {
            const fieldDefinition = allFieldsInSchema.find(f => f.name === internalFieldName);
            
            if (fieldDefinition) {
                const keyName = fieldDefinition.mapping
                    ? fieldDefinition.mapping.split('.').pop()
                    : fieldDefinition.name;

                finalSubmissionPayload[keyName] = formData[internalFieldName];
            } else {
                finalSubmissionPayload[internalFieldName] = formData[internalFieldName];
            }
        }

        if (formDefinition.purpose) {
            finalSubmissionPayload.purpose = formDefinition.purpose;
        }
        if (associatedLeadId) {
            finalSubmissionPayload.associatedLeadId = associatedLeadId;
        }

        if (onSubmit) {
            await onSubmit(finalSubmissionPayload);
        }
    };
    
    // === Moved these definitions here, inside the component, before return statement ===
    const containerStyle = { backgroundColor: globalStyles.backgroundColor };
    const commonInputStyles = {
        borderColor: globalStyles.borderColor,
        borderRadius: globalStyles.borderRadius,
        borderWidth: `${globalStyles.globalBorderWidth || 1}px`,
        borderStyle: globalStyles.globalBorderStyle || 'solid',
        color: globalStyles.inputTextColor,
        backgroundColor: globalStyles.inputBackgroundColor,
    };
    const buttonStyle = {
        backgroundColor: globalStyles.primaryColor,
        borderRadius: globalStyles.borderRadius,
        borderColor: globalStyles.borderColor,
        borderWidth: `${globalStyles.globalBorderWidth || 1}px`,
        borderStyle: globalStyles.globalBorderStyle || 'solid',
    };
    // === End of moved definitions ===

    if (!schema || schema.length === 0) {
        return <div className="text-gray-600 p-6 text-center">No form schema provided to render.</div>;
    }

    return (
        <div className="p-6 rounded-lg" style={containerStyle}>
            {globalStyles.logoUrl && (
                <div className="mb-6 text-center">
                    <img src={globalStyles.logoUrl} alt="Company Logo" className="mx-auto h-16 w-auto" />
                </div>
            )}
            <form onSubmit={handleSubmitInternal} className="space-y-6">
                {schema.map(row => (
                    <div key={row.id} className={`grid gap-x-6 gap-y-4 ${
                        row.columns.length === 1 ? 'grid-cols-1' :
                        row.columns.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                        'grid-cols-1 md:grid-cols-3'
                    }`}>
                        {(row.columns || []).map(column => (
                            <div key={column.id} className="flex flex-col space-y-4">
                                {(column.fields || []).map(field => {
                                    if (!isFieldVisible(field)) return null;

                                    const fieldValue = formData[field.name];
                                    const fieldError = formErrors[field.name] || null;

                                    const currentFieldInputStyles = {
                                        ...commonInputStyles,
                                        ...(field.styles || {}),
                                    };
                                    const currentFieldLabelStyle = { color: currentFieldInputStyles.labelColor };

                                    switch (field.type) {
                                        case 'text':
                                        case 'email':
                                        case 'phone':
                                        case 'date':
                                        case 'time':
                                        case 'number':
                                        case 'password':
                                            return (
                                                <ModernInput
                                                    key={field.id}
                                                    label={field.label}
                                                    name={field.name}
                                                    type={field.type === 'phone' ? 'tel' : field.type}
                                                    value={fieldValue || ''}
                                                    onChange={handleChange}
                                                    placeholder={field.placeholder}
                                                    required={field.required}
                                                    style={currentFieldInputStyles} // Changed from inputStyle to style
                                                    labelStyle={currentFieldLabelStyle}
                                                    error={fieldError}
                                                />
                                            );
                                        case 'textarea':
                                            return (
                                                <ModernInput
                                                    key={field.id}
                                                    textarea
                                                    label={field.label}
                                                    name={field.name}
                                                    value={fieldValue || ''}
                                                    onChange={handleChange}
                                                    placeholder={field.placeholder}
                                                    required={field.required}
                                                    style={currentFieldInputStyles} // Changed from inputStyle to style
                                                    labelStyle={currentFieldLabelStyle}
                                                    error={fieldError}
                                                />
                                            );
                                        case 'select':
                                            return (
                                                <ModernSelect
                                                    key={field.id}
                                                    label={field.label}
                                                    name={field.name}
                                                    value={fieldValue || ''}
                                                    onChange={handleChange}
                                                    options={(field.options || []).map(opt => ({ value: opt, label: opt }))}
                                                    required={field.required}
                                                    borderColor={currentFieldInputStyles.borderColor}
                                                    borderRadius={currentFieldInputStyles.borderRadius}
                                                    borderWidth={parseFloat(currentFieldInputStyles.borderWidth)}
                                                    borderStyle={currentFieldInputStyles.borderStyle}
                                                    inputTextColor={currentFieldInputStyles.inputTextColor}
                                                    inputBackgroundColor={currentFieldInputStyles.inputBackgroundColor}
                                                    labelStyle={currentFieldLabelStyle}
                                                    error={fieldError}
                                                />
                                            );
                                        case 'radio':
                                            return (
                                                <div key={field.id} className="mb-4" style={currentFieldLabelStyle}>
                                                    <label className="block text-sm font-medium mb-1">{field.label}{field.required ? ' *' : ''}</label>
                                                    <div className="flex flex-wrap gap-x-4">
                                                        {(field.options || []).map(option => (
                                                            <div key={option} className="flex items-center">
                                                                <input
                                                                    type="radio"
                                                                    id={`${field.name}-${option}`}
                                                                    name={field.name}
                                                                    value={option}
                                                                    checked={formData[field.name] === option}
                                                                    onChange={handleChange}
                                                                    required={field.required}
                                                                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 mr-2"
                                                                    style={{
                                                                        borderColor: currentFieldInputStyles.borderColor,
                                                                        backgroundColor: currentFieldInputStyles.inputBackgroundColor,
                                                                    }}
                                                                />
                                                                <label htmlFor={`${field.name}-${option}`} className="text-sm text-gray-700" style={{color: currentFieldInputStyles.inputTextColor}}>
                                                                    {option}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {fieldError && <p className="text-red-500 text-xs mt-1">{fieldError}</p>}
                                                </div>
                                            );
                                        case 'checkbox':
                                            return (
                                                <div key={field.id} className="flex items-center mb-4" style={currentFieldLabelStyle}>
                                                    <input
                                                        type="checkbox"
                                                        id={field.name}
                                                        name={field.name}
                                                        checked={!!fieldValue} // controlled from state
                                                        onChange={handleChange}
                                                        required={field.required}
                                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        style={{
                                                            borderColor: currentFieldInputStyles.borderColor,
                                                            backgroundColor: currentFieldInputStyles.inputBackgroundColor,
                                                        }}
                                                    />
                                                    <label htmlFor={field.name} className="ml-2 block text-sm text-gray-900" style={{color: currentFieldInputStyles.inputTextColor}}>
                                                        {field.label}
                                                    </label>
                                                    {fieldError && <p className="text-red-500 text-xs mt-1">{fieldError}</p>}
                                                </div>
                                            );
                                        case 'address':
                                            return (
                                                <div key={field.id} className="space-y-4">
                                                    <label className="block text-sm font-medium mb-1" style={currentFieldLabelStyle}>
                                                        {field.label}{field.required ? ' *' : ''}
                                                    </label>
                                                    {(isLoaded || isPreview) ? (
                                                        <Autocomplete
                                                            onLoad={(autocomplete) => {
                                                                autocompleteRefs.current[field.name] = autocomplete;
                                                                if (autocomplete) {
                                                                    autocomplete.setComponentRestrictions({ country: ['gb'] }); // Restrict to UK
                                                                    autocomplete.setOptions({ bounds: UK_BOUNDS, strictBounds: false }); // Bias towards UK, not strictly
                                                                }
                                                            }}
                                                            onPlaceChanged={() => {
                                                                const place = autocompleteRefs.current[field.name].getPlace();
                                                                if (!place.address_components) return;

                                                                const addressComponents = {};
                                                                place.address_components.forEach(component => {
                                                                    const type = component.types[0];
                                                                    switch (type) {
                                                                        case 'street_number':
                                                                        case 'route':
                                                                            addressComponents.street = (addressComponents.street || '') + ' ' + component.long_name;
                                                                            break;
                                                                        case 'locality':
                                                                        case 'postal_town': // Added postal_town for better city detection in UK
                                                                            addressComponents.city = component.long_name;
                                                                            break;
                                                                        case 'administrative_area_level_2':
                                                                            addressComponents.county = component.long_name;
                                                                            break;
                                                                        case 'postal_code':
                                                                            addressComponents.postcode = component.long_name;
                                                                            break;
                                                                        case 'country':
                                                                            addressComponents.country = component.short_name;
                                                                            break;
                                                                        default:
                                                                            break;
                                                                    }
                                                                });

                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    [field.name]: {
                                                                        ...(prev[field.name] || initializeFormData()[field.name]),
                                                                        street: (addressComponents.street || '').trim(),
                                                                        city: addressComponents.city || '',
                                                                        county: addressComponents.county || '',
                                                                        postcode: addressComponents.postcode || '',
                                                                        country: addressComponents.country || '',
                                                                        fullAddress: place.formatted_address || ''
                                                                    }
                                                                }));
                                                                if (formErrors[field.name]) {
                                                                    setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors[field.name]; return newErrors; });
                                                                }
                                                            }}
                                                        >
                                                            <ModernInput
                                                                name={field.name}
                                                                type="text"
                                                                value={formData[field.name]?.fullAddress || ''}
                                                                onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: { ...prev[field.name], fullAddress: e.target.value } }))}
                                                                placeholder={field.placeholder || 'Enter address'}
                                                                required={field.required}
                                                                style={currentFieldInputStyles} // Changed from inputStyle to style
                                                                error={fieldError}
                                                            />
                                                        </Autocomplete>
                                                    ) : (
                                                        <p className="text-sm text-red-500">Google Maps not loaded. Check API key or network connection.</p>
                                                    )}
                                                    {fieldError && <p className="text-red-500 text-xs mt-1">{fieldError}</p>}
                                                </div>
                                            );
                                        case 'file':
                                            return (
                                                <div key={field.id} className="mb-4">
                                                    <label htmlFor={field.name} className="block text-sm font-medium mb-1" style={currentFieldLabelStyle}>
                                                        {field.label}{field.required ? ' *' : ''}
                                                    </label>
                                                    <input
                                                        type="file"
                                                        id={field.name}
                                                        name={field.name}
                                                        onChange={handleChange}
                                                        required={field.required}
                                                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                        style={currentFieldInputStyles} // Apply styles directly to file input
                                                    />
                                                    {fieldValue && typeof fieldValue === 'object' && fieldValue.name && (
                                                        <p className="text-xs text-gray-500 mt-1">Selected file: {fieldValue.name}</p>
                                                    )}
                                                    {fieldError && <p className="text-red-500 text-xs mt-1">{fieldError}</p>}
                                                </div>
                                            );
                                        default:
                                            return (
                                                <ModernInput
                                                    key={field.id}
                                                    label={field.label}
                                                    name={field.name}
                                                    type={field.type}
                                                    value={fieldValue || ''}
                                                    onChange={handleChange}
                                                    placeholder={field.placeholder}
                                                    required={field.required}
                                                    style={currentFieldInputStyles} // Changed from inputStyle to style
                                                    labelStyle={currentFieldLabelStyle}
                                                    error={fieldError}
                                                />
                                            );
                                    }
                                })}
                            </div>
                        ))}
                    </div>
                ))}
                {Object.keys(formErrors).length > 0 && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                        Please correct the following:
                        <ul className="list-disc list-inside mt-2">
                            {Object.values(formErrors).map((msg, idx) => msg && <li key={idx}>{msg}</li>)}
                        </ul>
                    </div>
                )}
                <button type="submit"
                    className="w-full px-4 py-3 text-white font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-colors duration-200"
                    style={buttonStyle}
                    disabled={isSubmitting || isPreview}
                >
                    {isSubmitting ? 'Submitting...' : submitButtonText}
                </button>
            </form>
        </div>
    );
});

export default FormRenderer;