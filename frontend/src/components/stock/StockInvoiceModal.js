// src/components/stock/StockInvoiceModal.js

import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import ModernSelect from '../common/ModernSelect';
import ModernInput from '../common/ModernInput';
import { PlusIcon, XCircleIcon } from '@heroicons/react/20/solid';
import { useCurrency } from '../context/CurrencyContext';
import api from '../../utils/api';
import { toast } from 'react-toastify';

const StockInvoiceModal = ({ isOpen, onClose, stockItems, customers }) => {
    const { formatCurrency } = useCurrency();
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [itemsToInvoice, setItemsToInvoice] = useState([]);
    const [selectedStockId, setSelectedStockId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const customerOptions = useMemo(() => [
        { value: '', label: 'Select a Customer...' },
        ...customers.map(c => ({ value: c._id, label: c.contactPersonName }))
    ], [customers]);

    const availableStockOptions = useMemo(() => {
        const invoicedIds = new Set(itemsToInvoice.map(item => item.stockId));
        return [
            { value: '', label: 'Select a Stock Item...' },
            ...stockItems
                .filter(item => !invoicedIds.has(item._id))
                .map(item => ({ value: item._id, label: `${item.name} (Avail: ${item.stockQuantity})` }))
        ];
    }, [stockItems, itemsToInvoice]);

    const handleAddItem = () => {
        setError(null);
        if (!selectedStockId || quantity <= 0) {
            setError('Please select an item and enter a valid quantity.');
            return;
        }
        const stockItem = stockItems.find(item => item._id === selectedStockId);
        if (!stockItem || quantity > stockItem.stockQuantity) {
            setError('Insufficient stock available for the selected item.');
            return;
        }
        setItemsToInvoice(prev => [...prev, { ...stockItem, stockId: stockItem._id, quantity }]);
        setSelectedStockId('');
        setQuantity(1);
    };

    const handleRemoveItem = (stockId) => {
        setItemsToInvoice(prev => prev.filter(item => item.stockId !== stockId));
    };

    const handleSubmit = async () => {
        setError(null);
        if (!selectedCustomerId || itemsToInvoice.length === 0) {
            setError('Please select a customer and add at least one item to the invoice.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                customerId: selectedCustomerId,
                items: itemsToInvoice.map(({ stockId, quantity }) => ({ stockId, quantity })),
            };
            await api.post('/invoices/stock', payload);
            toast.success('Stock invoice created successfully!');
            onClose(); // Close the modal on success
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to create stock invoice.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const subtotal = useMemo(() => 
        itemsToInvoice.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0), 
    [itemsToInvoice]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Invoice from Stock" maxWidthClass="max-w-2xl">
            <div className="p-6 space-y-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
                
                <ModernSelect
                    label="Customer"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    options={customerOptions}
                    required
                />

                <div className="p-4 border rounded-lg bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Items</label>
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <ModernSelect
                                label="Stock Item"
                                value={selectedStockId}
                                onChange={(e) => setSelectedStockId(e.target.value)}
                                options={availableStockOptions}
                            />
                        </div>
                        <ModernInput
                            label="Qty"
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                            min="1"
                            className="w-20"
                        />
                        <button type="button" onClick={handleAddItem} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 h-10">
                            <PlusIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Invoice Items</h3>
                    <div className="border rounded-lg p-2 space-y-2 min-h-[100px]">
                        {itemsToInvoice.length > 0 ? itemsToInvoice.map(item => (
                            <div key={item.stockId} className="flex justify-between items-center bg-blue-50 p-2 rounded">
                                <span>{item.name} (Qty: {item.quantity})</span>
                                <div className="flex items-center gap-4">
                                    <span>{formatCurrency(item.salePrice * item.quantity)}</span>
                                    <button onClick={() => handleRemoveItem(item.stockId)} className="text-red-500 hover:text-red-700">
                                        <XCircleIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-500 p-4">No items added yet.</p>}
                    </div>
                    {itemsToInvoice.length > 0 && (
                        <div className="text-right font-bold text-xl mt-2">
                            Subtotal: {formatCurrency(subtotal)}
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-gray-100 px-6 py-4 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300" disabled={isSaving}>
                    Cancel
                </button>
                <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Create Invoice'}
                </button>
            </div>
        </Modal>
    );
};

export default StockInvoiceModal;
