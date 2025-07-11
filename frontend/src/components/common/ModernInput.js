// src/components/common/ModernInput.jsx

import React, { forwardRef } from 'react';

const ModernInput = forwardRef(({
    label,
    name,
    value, // This is the value prop
    onChange,
    placeholder,
    textarea,
    required,
    disabled,
    readOnly,
    type = 'text',
    helpText,
    className,
    autoComplete,
    labelStyle, // This prop is correctly applied to the label's style attribute
    borderColor,
    inputClassName,
    borderRadius,
    borderWidth,
    borderStyle,
    inputTextColor,
    inputBackgroundColor,
    min,
    max,
    step,
    ...rest
}, ref) => {
    const InputElement = textarea ? 'textarea' : 'input';

    // Ensure value is always a string for input elements to avoid controlled/uncontrolled warnings
    // For date/time inputs, an empty string is the correct way to represent no selection.
    // For numbers, handle potential null/undefined values
    const inputValue = (type === 'date' || type === 'time') ? (value || '') : (value === null || value === undefined ? '' : value);

    const defaultInputClasses = `
        mt-1 block w-full px-3 py-2 border rounded-md shadow-sm
        placeholder-gray-400 text-gray-900 focus:outline-none
        focus:ring-blue-500 focus:border-blue-500 sm:text-sm
        ${textarea ? 'h-24 resize-y' : ''}
        ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    `;

    // dynamicInputStyle now correctly creates an object for the native 'style' prop
    const dynamicInputStyle = {
        borderColor: borderColor || undefined,
        borderRadius: borderRadius || undefined,
        borderWidth: borderWidth ? `${borderWidth}px` : undefined,
        borderStyle: borderStyle || undefined,
        color: inputTextColor || undefined,
        backgroundColor: inputBackgroundColor || undefined,
    };

    const baseInputProps = {
        id: name,
        name: name,
        value: inputValue, // Use the safely handled value
        onChange: onChange,
        placeholder: placeholder,
        required: required,
        disabled: disabled,
        readOnly: readOnly,
        ref: ref,
        autoComplete: autoComplete,
        className: `${inputClassName || defaultInputClasses}`,
        style: dynamicInputStyle, // Correctly applies the dynamic styles
        min: min,
        max: max,
        step: step,
        ...rest
    };

    if (!textarea) {
        baseInputProps.type = type;
    }

    return (
        <div className={`mb-4 ${className || ''}`}>
            {label && (
                <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1" style={labelStyle}>
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <InputElement {...baseInputProps} />

            {helpText && (
                <p className="mt-1 text-sm text-gray-500">{helpText}</p>
            )}
        </div>
    );
});

export default ModernInput;