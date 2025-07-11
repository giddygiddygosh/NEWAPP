// src/components/staffPortal/MyPayslipsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../../utils/api';
import Loader from '../common/Loader';
import PayslipViewModal from '../payroll/PayslipViewModal'; // Adjust path as needed
import { format, isValid } from 'date-fns';
import { FileText, ChevronRight, Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify'; // <--- ADDED THIS LINE

const MyPayslipsPage = () => {
    const { user } = useAuth();
    const [payslips, setPayslips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // For PayslipViewModal
    const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
    const [selectedPayslipId, setSelectedPayslipId] = useState(null);

    // For reading payslipId from URL query params
    const [searchParams, setSearchParams] = useSearchParams();

    const fetchMyPayslips = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!user?.staff?._id) {
                setError("Staff profile not available. Cannot fetch payslips.");
                setIsLoading(false);
                return;
            }
            // Use the backend endpoint we set up for staff-specific payslips
            const res = await api.get(`/payroll/payslips/staff/${user.staff._id}?limit=50`); // Fetch more than 5 for a full page
            setPayslips(res.data);
        } catch (err) {
            console.error("Error fetching my payslips:", err);
            setError(err.response?.data?.message || err.message || "Failed to load your payslip history.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?.staff?._id) {
            fetchMyPayslips();
        }
    }, [user, fetchMyPayslips]);

    // Effect to open modal if payslipId is in URL on load
    useEffect(() => {
        const payslipIdFromUrl = searchParams.get('payslipId');
        if (payslipIdFromUrl) {
            setSelectedPayslipId(payslipIdFromUrl);
            setIsPayslipModalOpen(true);
            // Optionally clear the URL param after opening the modal
            // setSearchParams({}, { replace: true }); // Uncomment this line if you want to clear the URL param after the modal opens
        }
    }, [searchParams, setSearchParams]);

    const handleViewPayslip = useCallback((payslipId) => {
        setSelectedPayslipId(payslipId);
        setIsPayslipModalOpen(true);
        setSearchParams({ payslipId: payslipId }); // Keep payslipId in URL
    }, [setSearchParams]);

    const handleClosePayslipModal = useCallback(() => {
        setIsPayslipModalOpen(false);
        setSelectedPayslipId(null);
        setSearchParams({}, { replace: true }); // Clear payslipId from URL when closing
    }, [setSearchParams]);

    const handleDownloadPayslip = async (payslipId) => {
        // You can reuse the download endpoint already in your payrollController
        try {
            const res = await api.get(`/payroll/payslips/download/${payslipId}`, {
                responseType: 'blob' // Important: tell Axios to expect a binary blob
            });

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            const payslip = payslips.find(p => p._id === payslipId);
            const fileName = `payslip-${payslip?.staff?.contactPersonName.replace(/\s+/g, '-') || 'unknown'}-${format(new Date(payslip?.payPeriodStart), 'yyyyMMdd')}.pdf`;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
            toast.success('Payslip downloaded successfully!');
        } catch (err) {
            console.error('Error downloading payslip:', err);
            toast.error(err.response?.data?.message || 'Failed to download payslip.');
        }
    };

    const formatDateDisplay = (dateString) => {
        const date = new Date(dateString);
        return isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
    };

    const formatAmountDisplay = (amount) => {
        const num = parseFloat(amount);
        return isNaN(num) ? '0.00' : num.toFixed(2);
    };

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <FileText className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">My Payslips</h1>
                </div>
            </header>

            {isLoading ? (
                <div className="text-center text-gray-500"><Loader /> Loading payslip history...</div>
            ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {error}
                </div>
            ) : payslips.length === 0 ? (
                <div className="bg-yellow-50 p-6 rounded-lg shadow-lg border border-yellow-200 text-center text-yellow-800">
                    You have no payslips recorded. Payslips will appear here after payroll is processed for you.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pay Period</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Pay</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {payslips.map(payslip => (
                                <tr key={payslip._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatDateDisplay(payslip.payPeriodStart)} - {formatDateDisplay(payslip.payPeriodEnd)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        {payslip.payFrequency || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                                        £{formatAmountDisplay(payslip.grossPay)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-700">
                                        £{formatAmountDisplay(payslip.netPay)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <button
                                            onClick={() => handleViewPayslip(payslip._id)}
                                            className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center mr-2"
                                        >
                                            View <ChevronRight size={14} className="ml-0.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadPayslip(payslip._id)}
                                            className="text-purple-600 hover:text-purple-800 font-medium inline-flex items-center"
                                        >
                                            <Download size={14} className="mr-1" /> PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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

export default MyPayslipsPage;