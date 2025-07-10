// src/components/staffPortal/StockReturnModal.js
import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal'; // Assuming this path is correct

const StockReturnModal = ({ isOpen, onClose, job, onReturn, newStatus }) => {
    const [returnedStock, setReturnedStock] = useState({});

    // When the modal opens or the job data changes, reset the state
    useEffect(() => {
        if (job?.usedStock) {
            // Create an object to hold the return quantity for each stock item, initialized to 0
            const initialReturns = job.usedStock.reduce((acc, item) => {
                // The key should be the stockId from the usedStock array
                acc[item.stockId] = 0;
                return acc;
            }, {});
            setReturnedStock(initialReturns);
        }
    }, [job, isOpen]); // Rerun when the modal is opened

    // Handle quantity change for a specific stock item
    const handleQtyChange = (stockId, value) => {
        // Find the specific item in the job's usedStock array to get the max quantity
        const usedItem = job.usedStock.find(item => item.stockId === stockId);
        const maxQty = usedItem?.quantity || 0;

        let parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue) || parsedValue < 0) {
            parsedValue = 0; // Default to 0 if input is invalid
        }
        if (parsedValue > maxQty) {
            parsedValue = maxQty; // Cap the value at the maximum used quantity
        }

        setReturnedStock(prev => ({ ...prev, [stockId]: parsedValue }));
    };

    // Submit the returned stock quantities
    const handleSubmit = () => {
        // The onReturn function (which is handleReturnStockAndComplete in the parent)
        // is called with the job, the map of returned stock, and the new status.
        onReturn(job, returnedStock, newStatus);
        onClose(); // Close the modal after submitting
    };

    // Handle skipping the stock return process
    const handleSkip = () => {
        // Call the onReturn function with an empty object for returned stock
        onReturn(job, {}, newStatus);
        onClose(); // Close the modal
    };

    // Defensive check in case job data is not yet available
    if (!job) {
        return null;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Return Unused Stock" maxWidthClass="max-w-md">
            <div className="p-6">
                <p className="text-md text-gray-600 mb-6">
                    For job: <span className="font-semibold">{job.serviceType}</span> for <span className="font-semibold">{job.customer?.contactPersonName || 'N/A'}</span>.
                    <br />
                    Enter the quantity of each item that was <strong className="text-blue-600">NOT used</strong> and will be returned to stock.
                </p>
                <div className="space-y-4">
                    {job.usedStock && job.usedStock.length > 0 ? job.usedStock.map(item => (
                        <div key={item.stockId} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                            <span className="font-medium text-gray-800">
                                {item.name} <span className="text-sm text-gray-500">(Used: {item.quantity})</span>
                            </span>
                            <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={returnedStock[item.stockId] || 0}
                                onChange={e => handleQtyChange(item.stockId, e.target.value)}
                                className="w-24 text-center border border-gray-300 rounded-md py-1"
                            />
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 py-4">No stock items were assigned to this job.</p>
                    )}
                </div>
            </div>
            <div className="bg-gray-100 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                <button
                    type="button"
                    onClick={handleSkip}
                    className="px-5 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
                >
                    Skip & Complete
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                >
                    Confirm & Complete
                </button>
            </div>
        </Modal>
    );
}

export default StockReturnModal;
