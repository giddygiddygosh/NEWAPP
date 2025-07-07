import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { Package, Hash, DollarSign, Repeat, Box } from 'lucide-react'; // Keep DollarSign if you want it as a generic icon
// REMOVED: getCurrencySymbol import, as formatCurrency from context handles it
import { useCurrency } from '../context/CurrencyContext'; // NEW: Import useCurrency hook

const StockFormModal = ({ isOpen, onClose, onSave, item }) => { // Removed 'currency' prop
    const { formatCurrency, currency, loading: currencyLoading } = useCurrency(); // NEW: Get formatCurrency and currency object
    
    const [formData, setFormData] = useState({
        name: '',
        stockQuantity: 0,
        purchasePrice: 0,
        salePrice: 0,
        reorderLevel: 0,
        unit: 'pcs',
    });

    useEffect(() => {
        if (isOpen) { // Only reset/set form data when modal opens
            if (item) {
                setFormData({
                    name: item.name || '',
                    stockQuantity: parseFloat(item.stockQuantity) || 0,
                    purchasePrice: parseFloat(item.purchasePrice || item.price) || 0,
                    salePrice: parseFloat(item.salePrice || item.price) || 0,
                    reorderLevel: parseFloat(item.reorderLevel) || 0,
                    unit: item.unit || 'pcs',
                });
            } else {
                setFormData({
                    name: '',
                    stockQuantity: 0,
                    purchasePrice: 0,
                    salePrice: 0,
                    reorderLevel: 0,
                    unit: 'pcs',
                });
            }
        }
    }, [isOpen, item]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Use a message box instead of alert()
        if (!formData.name) {
            // Implement a custom message box or toast notification here
            console.error('Stock item name is required.');
            return;
        }
        if (isNaN(parseFloat(formData.salePrice)) || parseFloat(formData.salePrice) <= 0) {
            // Implement a custom message box or toast notification here
            console.error('Sale price must be a positive number.');
            return;
        }
        if (isNaN(parseFloat(formData.purchasePrice)) || parseFloat(formData.purchasePrice) < 0) {
            // Implement a custom message box or toast notification here
            console.error('Purchase price must be zero or a positive number.');
            return;
        }

        onSave(item ? { ...formData, _id: item._id } : formData);
        onClose();
    };

    // No longer need currencySymbolToDisplay derived this way.
    // The formatCurrency function from useCurrency context will handle the symbol and placement.

    // If you want a generic icon for the input fields, you can keep DollarSign.
    // Otherwise, remove the `icon={<DollarSign />}` props from ModernInput.

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Stock Item' : 'Add New Stock Item'} maxWidthClass="max-w-lg">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <ModernInput
                    label="Item Name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    icon={<Package />}
                    required
                />
                <ModernInput
                    label="Current Stock Quantity"
                    name="stockQuantity"
                    type="number"
                    value={String(formData.stockQuantity)}
                    onChange={handleChange}
                    icon={<Hash />}
                    min="0"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModernInput
                        label="Purchase Price" // Label simplified, formatCurrency handles symbol
                        name="purchasePrice"
                        type="number"
                        value={String(formData.purchasePrice)}
                        onChange={handleChange}
                        icon={<DollarSign />} // Keep or remove this generic icon
                        step="0.01"
                        min="0"
                    />
                    <ModernInput
                        label="Sale Price" // Label simplified, formatCurrency handles symbol
                        name="salePrice"
                        type="number"
                        value={String(formData.salePrice)}
                        onChange={handleChange}
                        icon={<DollarSign />} // Keep or remove this generic icon
                        step="0.01"
                        min="0"
                        required
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModernInput
                        label="Re-order Level"
                        name="reorderLevel"
                        type="number"
                        value={String(formData.reorderLevel)}
                        onChange={handleChange}
                        icon={<Repeat />}
                        min="0"
                    />
                    <ModernSelect
                        label="Unit (e.g., pcs, kg, box)"
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        icon={<Box />}
                        options={[
                            { value: 'pcs', label: 'pcs' },
                            { value: 'kg', label: 'kg' },
                            { value: 'm', label: 'm' },
                            { value: 'box', label: 'box' },
                            { value: 'litre', label: 'litre' },
                            { value: 'item', label: 'item' },
                        ]}
                    />
                </div>
                <footer className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                        {item ? 'Save Changes' : 'Add Item'}
                    </button>
                </footer>
            </form>
        </Modal>
    );
};

export default StockFormModal;

