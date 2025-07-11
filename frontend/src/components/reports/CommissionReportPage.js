// src/components/reports/CommissionReportPage.jsx

import React, { useState, useEffect } from 'react';
import api from '../../utils/api'; // Correct path
import Loader from '../common/Loader'; // Correct path
import ModernInput from '../common/ModernInput'; // Correct path
import ModernSelect from '../common/ModernSelect'; // Correct path
import { useCurrency } from '../context/CurrencyContext'; // **NEW: Import useCurrency hook**

const CommissionReportPage = () => {
    const { formatCurrency } = useCurrency(); // **NEW: Destructure formatCurrency from useCurrency hook**

    const [reportData, setReportData] = useState([]);
    const [salespersons, setSalespersons] = useState([]); // For dropdown filter
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSalesPerson, setSelectedSalesPerson] = useState('');

    const fetchReportData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (selectedSalesPerson) params.salesPersonName = selectedSalesPerson;

            const response = await api.get('/reports/commission', { params });
            setReportData(response.data.report);
            setSalespersons(response.data.salespersons); // Set salespersons from the backend response

        } catch (err) {
            console.error('Error fetching commission report:', err);
            setError(err.response?.data?.message || 'Failed to fetch commission report.');
            setReportData([]); // Clear report on error
            setSalespersons([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReportData();
    }, [startDate, endDate, selectedSalesPerson]); // Re-fetch when filters change

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedSalesPerson('');
    };

    // Prepare options for the salesperson dropdown
    const salespersonOptions = [
        { value: '', label: 'All Salespersons' },
        ...salespersons.map(sp => ({
            value: sp.contactPersonName, // Assuming salesPersonName on Customer matches staff contactPersonName
            label: sp.contactPersonName
        }))
    ];

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-md mt-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Commission Report</h1>

            {/* Filters Section */}
            <div className="bg-gray-100 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <ModernInput
                        label="Start Date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <ModernInput
                        label="End Date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div>
                    <ModernSelect
                        label="Salesperson"
                        value={selectedSalesPerson}
                        onChange={(e) => setSelectedSalesPerson(e.target.value)}
                        options={salespersonOptions}
                    />
                </div>
                <div className="flex justify-end md:justify-start">
                    <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>
            ) : (
                <div className="overflow-x-auto">
                    {reportData.length === 0 ? (
                        <p className="text-gray-600 text-center py-4">No commission data found for the selected criteria.</p>
                    ) : (
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b">Salesperson</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b">Customers Count</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b">Total Commission</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-4 text-sm text-gray-800">{item.salesPersonName || 'Unassigned'}</td>
                                        <td className="py-3 px-4 text-sm text-gray-800">{item.customersCount}</td>
                                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                                            {formatCurrency(item.totalCommission)} {/* **USED formatCurrency from hook** */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-200">
                                <tr>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                        {reportData.reduce((sum, item) => sum + item.customersCount, 0)}
                                    </th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                        {formatCurrency(reportData.reduce((sum, item) => sum + item.totalCommission, 0))} {/* **USED formatCurrency from hook** */}
                                    </th>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default CommissionReportPage;