// ServiceOS/frontend/src/components/common/ConfirmationModal.js

import React from 'react';
import Modal from './Modal'; // Assuming Modal is in the same common folder

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="p-4">
                <p className="text-gray-700 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;