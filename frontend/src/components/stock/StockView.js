import React, { useState, useEffect, useMemo } from 'react';
import StockFormModal from './StockFormModal';
import { Package, Plus, Edit, Trash2, Loader, TrendingUp, TrendingDown, Info } from 'lucide-react'; // Removed DollarSign import
import api from '../../utils/api';
import { useCurrency } from '../context/CurrencyContext'; // Import useCurrency hook

const StockView = () => {
    // Destructure formatCurrency and currency object from useCurrency
    const { formatCurrency, currency, loading: currencyLoading } = useCurrency(); 
    
    const [stock, setStock] = useState([]);
    const [loadingStock, setLoadingStock] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // No need for currentCurrencySymbol or currencySymbolToDisplay derived this way.
    // formatCurrency handles the symbol.

    // Removed CurrencyIconComponent as we will no longer display a static icon next to the formatted value.
    // If you want dynamic icons (e.g., a specific icon for EUR, another for GBP),
    // you would need a custom helper function that maps currency codes/symbols to Lucide React icons.

    useEffect(() => {
        fetchStockItems();
    }, []);

    const fetchStockItems = async () => {
        setLoadingStock(true);
        setError(null);
        try {
            const res = await api.get('/stock');
            setStock(res.data);
        } catch (err) {
            console.error('Error fetching stock items:', err);
            setError(err.response?.data?.message || 'Failed to fetch stock items.');
        } finally {
            setLoadingStock(false);
        }
    };

    const handleSaveStock = async (itemData) => {
        setLoadingStock(true);
        setError(null);
        try {
            if (itemData._id) {
                await api.put(`/stock/${itemData._id}`, itemData);
            } else {
                await api.post('/stock', itemData);
            }
            fetchStockItems(); // Re-fetch to update the list
        } catch (err) {
            console.error('Error saving stock item:', err);
            setError(err.response?.data?.message || 'Failed to save stock item.');
        } finally {
            // Loading will be set to false by fetchStockItems() on success/failure
        }
    };

    const handleDeleteStock = async (itemId) => {
        if (!window.confirm('Are you sure you want to delete this stock item? This action cannot be undone.')) {
            return;
        }
        setLoadingStock(true);
        setError(null);
        try {
            await api.delete(`/stock/${itemId}`);
            fetchStockItems(); // Re-fetch to update the list
        } catch (err) {
            console.error('Error deleting stock item:', err);
            setError(err.response?.data?.message || 'Failed to delete stock item.');
        } finally {
            // Loading will be set to false by fetchStockItems() on success/failure
        }
    };

    const handleOpenModal = (item = null) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const inventoryMetrics = useMemo(() => {
        if (!stock || stock.length === 0) {
            return {
                totalInventoryValue: 0,
                totalPotentialSalesValue: 0,
                potentialProfitOnHand: 0,
                lowStockItemsCount: 0,
            };
        }

        let totalInventoryValue = 0;
        let totalPotentialSalesValue = 0;
        let lowStockItemsCount = 0;

        stock.forEach(item => {
            const quantity = parseFloat(item.stockQuantity) || 0;
            const purchase = parseFloat(item.purchasePrice) || 0;
            const sale = parseFloat(item.salePrice) || 0;
            const reorder = parseFloat(item.reorderLevel) || 0;

            totalInventoryValue += (quantity * purchase);
            totalPotentialSalesValue += (quantity * sale);

            if (quantity <= reorder) {
                lowStockItemsCount++;
            }
        });

        const potentialProfitOnHand = totalPotentialSalesValue - totalInventoryValue;

        return {
            totalInventoryValue,
            totalPotentialSalesValue,
            potentialProfitOnHand,
            lowStockItemsCount,
        };
    }, [stock]); // Dependency on stock items

    // Combine loading states for initial render
    if (loadingStock || currencyLoading) { 
        return <Loader />;
    }

    if (error) {
        return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>;
    }

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-screen">
            <header className="flex items-center justify-between mb-6 border-b pb-4">
                <div className="flex items-center gap-3">
                    <Package className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Stock Inventory</h1>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                    disabled={loadingStock}
                >
                    <Plus size={20} /> Add Stock Item
                </button>
            </header>

            {/* Error display outside header */}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            {/* Summary Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total Inventory Value */}
                <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Total Inventory Value</h3>
                        <p className="text-3xl font-bold text-red-600 flex items-center">
                            {/* Removed CurrencyIconComponent here */}
                            {formatCurrency(inventoryMetrics.totalInventoryValue)} {/* Use formatCurrency */}
                        </p>
                    </div>
                </div>

                {/* Total Potential Sales Value */}
                <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Total Sales Value</h3>
                        <p className="text-3xl font-bold text-green-600 flex items-center">
                            {/* Removed CurrencyIconComponent here */}
                            {formatCurrency(inventoryMetrics.totalPotentialSalesValue)} {/* Use formatCurrency */}
                        </p>
                    </div>
                </div>

                {/* Potential Profit on Hand */}
                <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Potential Profit</h3>
                        <p className="text-3xl font-bold text-blue-600 flex items-center">
                            {/* Removed CurrencyIconComponent here */}
                            {formatCurrency(inventoryMetrics.potentialProfitOnHand)} {/* Use formatCurrency */}
                        </p>
                    </div>
                    <TrendingUp size={36} className="text-blue-400" />
                </div>

                {/* Low Stock Items Count */}
                <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Low Stock Items</h3>
                        <p className="text-3xl font-bold text-orange-600">
                            {inventoryMetrics.lowStockItemsCount}
                        </p>
                    </div>
                    <Info size={36} className="text-orange-400" />
                </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-xl shadow-lg p-4">
                {loadingStock ? (
                    <Loader />
                ) : stock.length === 0 ? (
                    <div className="p-8 text-center text-gray-600">
                        No stock items found. Click '<Plus size={16} className="inline-block relative -top-0.5" /> Add Stock Item' to get started!
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-700 uppercase bg-gray-50">
                                    <th className="py-3 px-4">Name</th>
                                    <th className="py-3 px-4">Quantity</th>
                                    <th className="py-3 px-4">Sale Price Per Unit</th>
                                    <th className="py-3 px-4">Re-order Level</th>
                                    <th className="py-3 px-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {(stock || []).map(item => (
                                    <tr key={item._id} className={`border-b border-gray-100 hover:bg-gray-50 ${item.stockQuantity <= item.reorderLevel ? 'bg-red-50' : ''}`}>
                                        <td className="py-3 px-4 font-semibold text-gray-800">{item.name}</td>
                                        <td className="py-3 px-4 text-gray-700">{item.stockQuantity} {item.unit}</td>
                                        <td className="py-3 px-4 text-gray-700">
                                            {formatCurrency(parseFloat(item.salePrice || item.purchasePrice || 0))} {/* Use formatCurrency */}
                                        </td>
                                        <td className={`py-3 px-4 font-medium ${item.stockQuantity <= item.reorderLevel ? 'text-red-600' : 'text-gray-700'}`}>
                                            {item.reorderLevel}
                                        </td>
                                        <td className="text-right py-3 px-4">
                                            <button onClick={() => handleOpenModal(item)} className="p-2 text-gray-500 hover:text-blue-600 rounded-full"><Edit size={18}/></button>
                                            <button onClick={() => handleDeleteStock(item._id)} className="p-2 text-gray-500 hover:text-red-600 rounded-full"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <StockFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveStock}
                item={editingItem}
                // Pass the full currency object to the modal if it needs detailed currency info
                // Otherwise, the modal can also use `useCurrency()` directly.
                // If it needs the symbol for input prefixes, pass `currency.symbol`.
                // For now, let's assume it uses `useCurrency` directly or just needs the symbol.
                // currency={currency?.code} // Pass the currency CODE, e.g., "GBP"
            />
        </div>
    );
};

export default StockView;