// src/components/stock/StockView.js

import React, { useState, useEffect, useMemo } from 'react';
import StockFormModal from './StockFormModal';
import StockInvoiceModal from './StockInvoiceModal'; // Import the new modal
import { Package, Plus, Edit, Trash2, Loader, TrendingUp, Info, FileText } from 'lucide-react';
import api from '../../utils/api';
import { useCurrency } from '../context/CurrencyContext';
import { toast } from 'react-toastify';

const StockView = () => {
    const { formatCurrency, currency, loading: currencyLoading } = useCurrency();
    
    const [stock, setStock] = useState([]);
    const [customers, setCustomers] = useState([]); // State for customers
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false); // State for the new modal
    const [editingItem, setEditingItem] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch both stock and customers at the same time
            const [stockRes, customersRes] = await Promise.all([
                api.get('/stock'),
                api.get('/customers')
            ]);
            setStock(stockRes.data);
            setCustomers(customersRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err.response?.data?.message || 'Failed to fetch data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveStock = async (itemData) => {
        try {
            if (itemData._id) {
                await api.put(`/stock/${itemData._id}`, itemData);
                toast.success("Stock item updated successfully!");
            } else {
                await api.post('/stock', itemData);
                toast.success("Stock item added successfully!");
            }
            fetchData(); // Re-fetch all data to update the view
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to save stock item.';
            setError(errorMessage);
            toast.error(errorMessage);
        }
    };

    const handleDeleteStock = async (itemId) => {
        if (!window.confirm('Are you sure you want to delete this stock item? This action cannot be undone.')) {
            return;
        }
        try {
            await api.delete(`/stock/${itemId}`);
            toast.success("Stock item deleted.");
            fetchData();
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to delete stock item.';
            setError(errorMessage);
            toast.error(errorMessage);
        }
    };

    const handleOpenFormModal = (item = null) => {
        setEditingItem(item);
        setIsFormModalOpen(true);
    };

    const inventoryMetrics = useMemo(() => {
        if (!stock || stock.length === 0) return { totalInventoryValue: 0, totalPotentialSalesValue: 0, potentialProfitOnHand: 0, lowStockItemsCount: 0 };
        let totalInventoryValue = 0, totalPotentialSalesValue = 0, lowStockItemsCount = 0;
        stock.forEach(item => {
            const quantity = parseFloat(item.stockQuantity) || 0;
            const purchase = parseFloat(item.purchasePrice) || 0;
            const sale = parseFloat(item.salePrice) || 0;
            const reorder = parseFloat(item.reorderLevel) || 0;
            totalInventoryValue += (quantity * purchase);
            totalPotentialSalesValue += (quantity * sale);
            if (quantity <= reorder) lowStockItemsCount++;
        });
        return { totalInventoryValue, totalPotentialSalesValue, potentialProfitOnHand: totalPotentialSalesValue - totalInventoryValue, lowStockItemsCount };
    }, [stock]);

    if (loading || currencyLoading) {
        return <Loader />;
    }

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-screen">
            <header className="flex items-center justify-between mb-6 border-b pb-4">
                <div className="flex items-center gap-3">
                    <Package className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Stock Inventory</h1>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsInvoiceModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700"
                    >
                        <FileText size={20} /> Create Stock Invoice
                    </button>
                    <button
                        onClick={() => handleOpenFormModal()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                    >
                        <Plus size={20} /> Add Stock Item
                    </button>
                </div>
            </header>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            {/* --- JSX RESTORED --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-50 rounded-xl shadow-md p-4">
                    <h3 className="text-md font-semibold text-gray-600 mb-1">Total Inventory Value</h3>
                    <p className="text-3xl font-bold text-red-600">{formatCurrency(inventoryMetrics.totalInventoryValue)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl shadow-md p-4">
                    <h3 className="text-md font-semibold text-gray-600 mb-1">Total Sales Value</h3>
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(inventoryMetrics.totalPotentialSalesValue)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl shadow-md p-4">
                    <h3 className="text-md font-semibold text-gray-600 mb-1">Potential Profit</h3>
                    <p className="text-3xl font-bold text-blue-600">{formatCurrency(inventoryMetrics.potentialProfitOnHand)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl shadow-md p-4">
                    <h3 className="text-md font-semibold text-gray-600 mb-1">Low Stock Items</h3>
                    <p className="text-3xl font-bold text-orange-600">{inventoryMetrics.lowStockItemsCount}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4">
                {loading ? (
                    <Loader />
                ) : stock.length === 0 ? (
                    <div className="p-8 text-center text-gray-600">
                        No stock items found. Click 'Add Stock Item' to get started!
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-700 uppercase bg-gray-50">
                                    <th className="py-3 px-4">Name</th>
                                    <th className="py-3 px-4">Quantity</th>
                                    <th className="py-3 px-4">Sale Price</th>
                                    <th className="py-3 px-4">Re-order Level</th>
                                    <th className="py-3 px-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {stock.map(item => (
                                    <tr key={item._id} className={`border-b border-gray-100 hover:bg-gray-50 ${item.stockQuantity <= item.reorderLevel ? 'bg-red-50' : ''}`}>
                                        <td className="py-3 px-4 font-semibold text-gray-800">{item.name}</td>
                                        <td className="py-3 px-4 text-gray-700">{item.stockQuantity} {item.unit}</td>
                                        <td className="py-3 px-4 text-gray-700">{formatCurrency(item.salePrice)}</td>
                                        <td className={`py-3 px-4 font-medium ${item.stockQuantity <= item.reorderLevel ? 'text-red-600' : 'text-gray-700'}`}>{item.reorderLevel}</td>
                                        <td className="text-right py-3 px-4">
                                            <button onClick={() => handleOpenFormModal(item)} className="p-2 text-gray-500 hover:text-blue-600 rounded-full"><Edit size={18}/></button>
                                            <button onClick={() => handleDeleteStock(item._id)} className="p-2 text-gray-500 hover:text-red-600 rounded-full"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {/* --- END OF RESTORED JSX --- */}

            <StockFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSave={handleSaveStock}
                item={editingItem}
            />
            <StockInvoiceModal
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                stockItems={stock}
                customers={customers}
            />
        </div>
    );
};

export default StockView;

