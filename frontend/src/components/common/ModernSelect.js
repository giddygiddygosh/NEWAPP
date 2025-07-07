// src/components/common/ModernSelect.jsx

import React from 'react';

const ModernSelect = ({ label, name, value, onChange, options, required = false, labelStyle,
    borderColor,
    borderWidth,
    borderStyle,
    inputBackgroundColor,
    inputTextColor,
    borderRadius
}) => {
    const selectStyle = {
        borderColor: borderColor || undefined,
        borderWidth: borderWidth ? `${borderWidth}px` : undefined,
        borderStyle: borderStyle || undefined,
        backgroundColor: inputBackgroundColor || undefined,
        color: inputTextColor || undefined,
        borderRadius: borderRadius || undefined,
    };

    return (
        <div className="mb-4">
            {label && <label htmlFor={name} className="block text-gray-700 text-sm font-bold mb-2" style={labelStyle}>{label}</label>}
            <select
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                style={selectStyle}
                required={required}
            >
                {/* FIXED: Ensure options is always an array before mapping and pass option.disabled */}
                {(options || []).map(option => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
                ))}
            </select>
        </div>
    );
};

export default ModernSelect;