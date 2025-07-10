import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import { toast } from 'react-toastify';
import { Users, Calendar, Calculator, FileText, Download, Archive, BookText } from 'lucide-react'; // Added BookText icon
import { format } from 'date-fns'; // Make sure format is imported

import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import PayslipViewModal from './PayslipViewModal';


const PayrollPage = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [staffList, setStaffList] = useState([]); // All staff, for selection
    const [selectedStaffIds, setSelectedStaffIds] = useState([]); // Staff selected for calculation
    const [payrollSummary, setPayrollSummary] = useState(null);
    const [isLoadingStaff, setIsLoadingStaff] = useState(true);
    const [isLoadingCalculation, setIsLoadingCalculation] = useState(false);
    const [staffError, setStaffError] = useState(null);
    const [calculationError, setCalculationError] = useState(null);
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);
    const [isLoadingReport, setIsLoadingReport] = useState(false); // New state for report loading

    // States for Payslip View Modal
    const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
    const [selectedPayslipId, setSelectedPayslipId] = useState(null);


    // Fetch all staff members for the selection list
    const fetchAllStaff = useCallback(async () => {
        setIsLoadingStaff(true);
        setStaffError(null);
        try {
            const res = await api.get('/staff'); // Your /api/staff endpoint
            setStaffList(res.data);
            // Optionally, pre-select all staff by default
            setSelectedStaffIds(res.data.map(s => s._id));
        } catch (err) {
            console.error('Error fetching staff for payroll:', err);
            setStaffError(err.response?.data?.message || 'Failed to load staff list.');
        } finally {
            setIsLoadingStaff(false);
        }
    }, []);

    useEffect(() => {
        fetchAllStaff();
    }, [fetchAllStaff]);

    const handleStaffSelectionChange = (e) => {
        const { value, checked } = e.target;
        if (checked) {
            setSelectedStaffIds(prev => [...prev, value]);
        } else {
            setSelectedStaffIds(prev => prev.filter(id => id !== value));
        }
    };

    const handleSelectAllStaff = (e) => {
        if (e.target.checked) {
            setSelectedStaffIds(staffList.map(s => s._id));
        } else {
            setSelectedStaffIds([]);
        }
    };

    const handleCalculatePayroll = useCallback(async (e) => {
        e.preventDefault();
        setIsLoadingCalculation(true);
        setCalculationError(null);
        setPayrollSummary(null); // Clear previous summary

        if (!startDate || !endDate) {
            setCalculationError('Please select both a start date and an end date for the pay period.');
            setIsLoadingCalculation(false);
            return;
        }

        if (selectedStaffIds.length === 0) {
            setCalculationError('Please select at least one staff member to calculate payroll for.');
            setIsLoadingCalculation(false);
            return;
        }

        try {
            const res = await api.post('/payroll/calculate', {
                startDate,
                endDate,
                staffIds: selectedStaffIds,
            });
            setPayrollSummary(res.data); // This now contains payslipId
            toast.success('Payroll calculated and payslips generated successfully!');
        } catch (err) {
            console.error('Error calculating payroll:', err);
            setCalculationError(err.response?.data?.message || 'Failed to calculate payroll.');
            toast.error(err.response?.data?.message || 'Failed to calculate payroll.');
        } finally {
            setIsLoadingCalculation(false);
        }
    }, [startDate, endDate, selectedStaffIds]);

    // Handler to open Payslip View Modal
    const handleViewPayslip = useCallback((payslipId) => {
        setSelectedPayslipId(payslipId);
        setIsPayslipModalOpen(true);
    }, []);

    // Handler to close Payslip View Modal
    const handleClosePayslipModal = useCallback(() => {
        setIsPayslipModalOpen(false);
        setSelectedPayslipId(null);
    }, []);

    // Handle Bulk PDF download
    const handleBulkDownloadPdf = useCallback(async () => {
        setIsBulkDownloading(true);
        setCalculationError(null); // Clear previous errors

        if (!startDate || !endDate) {
            setCalculationError('Please select both a start date and an end date for the pay period for bulk download.');
            setIsBulkDownloading(false);
            return;
        }
        if (selectedStaffIds.length === 0) {
            setCalculationError('Please select at least one staff member for bulk download.');
            setIsBulkDownloading(false);
            return;
        }

        try {
            const res = await api.get('/payroll/payslips/bulk-download', {
                params: {
                    startDate,
                    endDate,
                    staffIds: selectedStaffIds.join(','), // Send as comma-separated string
                },
                responseType: 'blob' // Important: tell Axios to expect a binary blob
            });

            const blob = new Blob([res.data], { type: 'application/zip' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `payslips_payroll_${format(new Date(startDate), 'yyyyMMdd')}_to_${format(new Date(endDate), 'yyyyMMdd')}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success('Selected payslips downloaded as ZIP!');
        } catch (err) {
            console.error('Error bulk downloading payslips:', err);
            setCalculationError(err.response?.data?.message || 'Failed to bulk download payslips. Please try again.');
            toast.error(err.response?.data?.message || 'Failed to bulk download payslips.');
        } finally {
            setIsBulkDownloading(false);
        }
    }, [startDate, endDate, selectedStaffIds]);

    // NEW: Handle Generate Accountant Report - Modified to handle PDF download
    const handleGenerateAccountantReport = useCallback(async () => {
        setIsLoadingReport(true);
        setCalculationError(null); // Clear previous errors

        if (!startDate || !endDate) {
            setCalculationError('Please select both a start date and an end date for the accountant report.');
            setIsLoadingReport(false);
            return;
        }
        // Staff selection is optional for accountant report, so no error if selectedStaffIds is empty

        try {
            const params = {
                startDate,
                endDate,
            };
            if (selectedStaffIds.length > 0) {
                params.staffIds = selectedStaffIds.join(',');
            }

            const res = await api.get('/payroll/report/summary', {
                params,
                responseType: 'blob' // <--- IMPORTANT: Expect a binary blob (PDF)
            });

            // Create a Blob from the PDF data
            const blob = new Blob([res.data], { type: 'application/pdf' });
            
            // Create a link element, set the download filename, and click it
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            // The backend sets Content-Disposition, but setting a fallback filename here is good practice
            link.setAttribute('download', `Payroll_Summary_Report_${format(new Date(startDate), 'yyyyMMdd')}_to_${format(new Date(endDate), 'yyyyMMdd')}.pdf`); 
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl); // Clean up the URL

            toast.success('Accountant Report downloaded successfully!');
        } catch (err) {
            console.error('Error generating accountant report:', err);
            // Handle error response if it's not a blob (e.g., JSON error from backend)
            let errorMessage = 'Failed to generate accountant report. Please try again.';
            if (err.response && err.response.data instanceof Blob) {
                // If it's an error blob, try to read it as text
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        const errorJson = JSON.parse(reader.result);
                        errorMessage = errorJson.message || errorMessage;
                    } catch (e) {
                        // Not valid JSON, just use generic message
                    }
                    setCalculationError(errorMessage);
                    toast.error(errorMessage);
                };
                reader.readAsText(err.response.data);
            } else {
                setCalculationError(err.response?.data?.message || errorMessage);
                toast.error(err.response?.data?.message || errorMessage);
            }
        } finally {
            setIsLoadingReport(false);
        }
    }, [startDate, endDate, selectedStaffIds]);


    const getStatusClasses = (status) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-100 text-yellow-800';
            case 'Approved': return 'bg-green-100 text-green-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <Calculator className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Payroll Management</h1>
                </div>
            </header>

            {staffError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {staffError}
                </div>
            )}
            {calculationError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {calculationError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="md:col-span-1 bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="inline" /> Select Pay Period</h2>
                    <div className="space-y-4">
                        <ModernInput
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                        <ModernInput
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="md:col-span-2 bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><Users className="inline" /> Select Staff</h2>
                    {isLoadingStaff ? (
                        <div className="text-center text-gray-500"><Loader /> Loading staff...</div>
                    ) : staffList.length === 0 ? (
                        <p className="text-gray-500">No staff members found.</p>
                    ) : (
                        <div className="space-y-2">
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    onChange={handleSelectAllStaff}
                                    checked={selectedStaffIds.length === staffList.length && staffList.length > 0} // Ensure staffList is not empty
                                />
                                <span className="ml-2 text-gray-700 font-medium">Select All</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border p-2 rounded-md bg-white">
                                {staffList.map(staffMember => (
                                    <label key={staffMember._id} className="inline-flex items-center">
                                        <input
                                            type="checkbox"
                                            className="form-checkbox"
                                            value={staffMember._id}
                                            checked={selectedStaffIds.includes(staffMember._id)}
                                            onChange={handleStaffSelectionChange}
                                        />
                                        <span className="ml-2 text-gray-700">{staffMember.contactPersonName} ({staffMember.payRateType})</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center mb-8 flex justify-center gap-4 flex-wrap">
                <button
                    onClick={handleCalculatePayroll}
                    disabled={isLoadingCalculation || !startDate || !endDate || selectedStaffIds.length === 0}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md text-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoadingCalculation ? <Loader className="animate-spin mr-3" size={24} /> : <Calculator className="mr-3" />}
                    Calculate Payroll
                </button>

                {payrollSummary && payrollSummary.length > 0 && (
                    <>
                        <button
                            onClick={handleBulkDownloadPdf}
                            disabled={isBulkDownloading || !startDate || !endDate || selectedStaffIds.length === 0}
                            className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md text-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isBulkDownloading ? <Loader className="animate-spin mr-3" size={24} /> : <Archive className="mr-3" />}
                            Download All Payslips
                        </button>
                        <button
                            onClick={handleGenerateAccountantReport}
                            disabled={isLoadingReport || !startDate || !endDate} // Staff selection is optional for this report
                            className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md text-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isLoadingReport ? <Loader className="animate-spin mr-3" size={24} /> : <BookText className="mr-3" />}
                            Generate Accountant Report
                        </button>
                    </>
                )}
            </div>

            {payrollSummary && payrollSummary.length > 0 && (
                <div className="mt-8 bg-blue-50 p-6 rounded-lg shadow-lg border border-blue-200">
                    <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <FileText className="inline" /> Payroll Summary
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-blue-200">
                            <thead className="bg-blue-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Staff Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Pay Type</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Details</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-blue-700 uppercase tracking-wider">Gross Pay</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-blue-200">
                                {payrollSummary.map(entry => (
                                    <tr 
                                        key={entry.payslipId} 
                                        className="hover:bg-blue-50" 
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.staffName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{entry.payRateType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {entry.payRateType === 'Hourly' && `Hours: ${entry.payDetails.totalHours} @ £${entry.payDetails.rate}`}
                                            {entry.payRateType === 'Fixed per Job' && `Jobs: ${entry.payDetails.totalJobs} @ £${entry.payDetails.amountPerJob}`}
                                            {entry.payRateType === 'Percentage per Job' && `Value: £${entry.payDetails.totalJobValue} (${entry.payDetails.percentage}%)`}
                                            {entry.payRateType === 'Daily Rate' && `Days: ${entry.payDetails.totalDays} @ £${entry.payDetails.ratePerDay}`}
                                            {entry.payDetails.message && `(${entry.payDetails.message})`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-700">£{entry.grossPay.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleViewPayslip(entry.payslipId); }} 
                                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                                title="View Payslip"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {payrollSummary && payrollSummary.length === 0 && (
                <div className="mt-8 bg-yellow-50 p-6 rounded-lg shadow-lg border border-yellow-200 text-center text-yellow-800">
                    No payroll entries found for the selected criteria.
                </div>
            )}

            {isPayslipModalOpen && (
                <PayslipViewModal
                    isOpen={isPayslipModalOpen}
                    onClose={handleClosePayslipModal}
                    payslipId={selectedPayslipId}
                />
            )}
        </div>
    );
};

export default PayrollPage;