// src/components/common/Modal.jsx

import React from 'react';

const Modal = ({ isOpen, onClose, title, children, maxWidthClass = 'max-w-lg' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            {/* The main modal content container */}
            <div className={`bg-white rounded-lg shadow-xl w-full p-6 relative flex flex-col max-h-[90vh] ${maxWidthClass}`}>
                {/* Modal Header - flex-shrink-0 prevents it from shrinking */}
                <div className="flex justify-between items-center pb-3 border-b border-gray-200 flex-shrink-0">
                    <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                {/* Modal Body - occupies remaining space and scrolls */}
                <div className="flex-1 overflow-y-auto"> {/* NEW: flex-1 and overflow-y-auto here */}
                    {children} {/* Children (the form) will go directly here */}
                </div>
            </div>
        </div>
    );
};

export default Modal;