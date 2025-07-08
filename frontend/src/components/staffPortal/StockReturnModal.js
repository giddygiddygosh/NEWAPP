// src/components/staffPortal/StockReturnModal.jsx

import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal'; // Import generic Modal
import { Loader as LoaderIcon } from 'lucide-react'; // For loading indicator

const StockReturnModal = ({ isOpen, onClose, job, onReturn, newStatus }) => {
    const [returnedStock, setReturnedStock] = useState({});
    const [isLoading, setIsLoading] = useState(false); // Local loading state for the modal

    // Initialize returned stock quantities when modal opens
    useEffect(() => {
        if(isOpen && job?.usedStock) {
            // Set initial quantities to 0 for all used stock items
            // Ensure stockId is used as key, and quantity is from usedStock
            const initialReturns = job.usedStock.reduce((acc, item) => ({...acc, [item.stockId]: 0}), {});
            setReturnedStock(initialReturns);
            setIsLoading(false); // Reset loading state on open
        }
    }, [isOpen, job]);

    // Handle quantity change for a specific stock item
    const handleQtyChange = (stockId, value) => {
        // Find the original used quantity for this stock item
        const usedItem = job.usedStock.find(item => item.stockId === stockId);
        const maxQty = usedItem ? usedItem.quantity : 0;

        let parsedValue = parseInt(value);
        if (isNaN(parsedValue) || parsedValue < 0) parsedValue = 0; // Prevent negative or non-numeric input
        if (parsedValue > maxQty) parsedValue = maxQty; // Cap at max used quantity

        setReturnedStock(prev => ({...prev, [stockId]: parsedValue}));
    };

    // Submit the returned stock with the intended new status
    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            await onReturn(job, returnedStock, newStatus); // Call the parent handler
            onClose(); // Close modal on success
        } catch (error) {
            // Error handling is done by onActionError passed to parent,
            // but we might want a local message here too.
            console.error("Error in StockReturnModal handleSubmit:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle skipping stock return: still update job status to newStatus
    const handleSkip = async () => {
        setIsLoading(true);
        try {
            await onReturn(job, {}, newStatus); // Pass empty returnedStock and the newStatus
            onClose(); // Close modal on success
        } catch (error) {
            console.error("Error in StockReturnModal handleSkip:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!job) return null; // Don't render if no job is provided

    return(
        <Modal isOpen={isOpen} onClose={onClose} title="Return Unused Stock" maxWidth="md">
            <div className="p-6">
                <p className="text-md text-gray-600 mb-6">
                    For job: <span className="font-semibold">{job.serviceType}</span> for <span className="font-semibold">{job.customer?.contactPersonName || 'N/A'}</span>.
                    Enter the quantity of each item that was <strong className="text-blue-600">NOT used</strong>.
                </p>
                <div className="space-y-4">
                    {job.usedStock && job.usedStock.length > 0 ? job.usedStock.map(item => (
                        <div key={item.stockId} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 shadow-sm">
                            <span className="font-medium text-gray-800 text-lg">{item.name} <span className="text-sm text-gray-500">(Used: {item.quantity})</span></span>
                            <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={returnedStock[item.stockId] || 0}
                                onChange={e => handleQtyChange(item.stockId, e.target.value)}
                                className="w-24 text-center border border-gray-300 rounded-md py-1.5 text-md font-semibold"
                                disabled={isLoading}
                            />
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 py-4">No stock items were used for this job.</p>
                    )}
                </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-xl border-t border-gray-100 shrink-0">
                <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isLoading}
                    className="px-5 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <LoaderIcon size={18} className="animate-spin mr-2" /> : 'Skip'}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <LoaderIcon size={18} className="animate-spin mr-2" /> : 'Confirm Returns'}
                </button>
            </div>
        </Modal>
    );
}

export default StockReturnModal;
