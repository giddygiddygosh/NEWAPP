// src/components/payroll/PayslipViewModal.js

import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Loader from '../common/Loader';
import api from '../../utils/api';
import { format, isValid } from 'date-fns';
import { FileText, User, Building, Calendar, DollarSign, ListChecks, Download } from 'lucide-react'; // Added Download icon
import { toast } from 'react-toastify'; // Added toast for download messages

const PayslipViewModal = ({ isOpen, onClose, payslipId }) => {
    const [payslip, setPayslip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false); // New state for download loading

    const fetchPayslipDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get(`/payroll/payslips/${payslipId}`);
            setPayslip(res.data);
        } catch (err) {
            console.error('Error fetching payslip details:', err);
            setError(err.response?.data?.message || 'Failed to load payslip details.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && payslipId) {
            fetchPayslipDetails();
        }
    }, [isOpen, payslipId]);

    // Helper to format dates safely
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
    };

    // Helper to format amounts safely
    const formatAmount = (amount) => {
        const num = parseFloat(amount);
        return isNaN(num) ? '0.00' : num.toFixed(2);
    };

    // NEW: Handle PDF download
    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
            // Make an API call to your new download endpoint
            const res = await api.get(`/payroll/payslips/download/${payslipId}`, {
                responseType: 'blob' // Important: tell Axios to expect a binary blob
            });

            // Create a Blob from the PDF data
            const blob = new Blob([res.data], { type: 'application/pdf' });
            
            // Create a link element, set the download filename, and click it
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `payslip-${payslip.staff?.contactPersonName.replace(/\s+/g, '-') || 'unknown'}-${format(new Date(payslip.payPeriodStart), 'yyyyMMdd')}.pdf`); // Dynamic filename
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl); // Clean up the URL

            toast.success('Payslip downloaded successfully!');
        } catch (err) {
            console.error('Error downloading payslip:', err);
            toast.error(err.response?.data?.message || 'Failed to download payslip. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };


    if (isLoading) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Loading Payslip" maxWidthClass="max-w-xl">
                <div className="p-6 text-center">
                    <Loader />
                    <p className="mt-2 text-gray-700">Loading payslip details...</p>
                </div>
            </Modal>
        );
    }

    if (error) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Error Loading Payslip" maxWidthClass="max-w-xl">
                <div className="p-6 text-center text-red-600">
                    <p>{error}</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                </div>
            </Modal>
        );
    }

    if (!payslip) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Payslip Not Found" maxWidthClass="max-w-xl">
                <div className="p-6 text-center text-gray-700">
                    <p>No payslip data available.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Payslip for ${payslip.staff?.contactPersonName || 'N/A'}`} maxWidthClass="max-w-2xl">
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-center text-blue-600 mb-4">
                    <FileText size={36} className="mr-3" />
                    <h2 className="text-3xl font-bold">Payslip</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                    <div>
                        <p className="font-semibold flex items-center"><User size={16} className="mr-2" /> Employee:</p>
                        <p className="ml-6">{payslip.staff?.contactPersonName || 'N/A'}</p>
                        <p className="ml-6">{payslip.staff?.email || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="font-semibold flex items-center"><Building size={16} className="mr-2" /> Company:</p>
                        <p className="ml-6">{payslip.company?.name || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="font-semibold flex items-center"><Calendar size={16} className="mr-2" /> Pay Period:</p>
                        <p className="ml-6">
                            {formatDate(payslip.payPeriodStart)} - {formatDate(payslip.payPeriodEnd)}
                        </p>
                    </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center"><DollarSign size={18} className="mr-2" /> Earnings</h3>
                    {/* Ensure payslip.earnings is an array before mapping */}
                    {payslip.earnings && Array.isArray(payslip.earnings) && payslip.earnings.length > 0 ? (
                        <ul className="space-y-2">
                            {payslip.earnings.map((earning, index) => (
                                <li key={index} className="flex justify-between items-center text-gray-700">
                                    <span>{earning.description}</span>
                                    <span className="font-medium">£{formatAmount(earning.amount)}</span>
                                </li>))}
                            <li className="flex justify-between items-center font-bold text-gray-900 border-t pt-2 mt-2">
                                <span>Gross Pay:</span>
                                <span>£{formatAmount(payslip.grossPay)}</span>
                            </li>
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500">No earnings recorded.</p>
                    )}
                </div>

                <div className="border rounded-lg p-4 bg-red-50">
                    <h3 className="text-lg font-bold text-red-800 mb-3 flex items-center"><ListChecks size={18} className="mr-2" /> Deductions</h3>
                    {/* Ensure payslip.deductions is an array before mapping */}
                    {payslip.deductions && Array.isArray(payslip.deductions) && payslip.deductions.length > 0 ? (
                        <ul className="space-y-2">
                            {payslip.deductions.map((deduction, index) => (
                                <li key={index} className="flex justify-between items-center text-red-700">
                                    <span>{deduction.description}</span>
                                    <span className="font-medium">-£{formatAmount(deduction.amount)}</span>
                                </li>))}
                            <li className="flex justify-between items-center font-bold text-red-900 border-t pt-2 mt-2">
                                <span>Total Deductions:</span>
                                <span>-£{formatAmount(payslip.totalDeductions)}</span>
                            </li>
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500">No deductions recorded.</p>
                    )}
                </div>

                <div className="text-right text-2xl font-extrabold text-green-700">
                    Net Pay: £{formatAmount(payslip.netPay)}
                </div>
            </div>
            <div className="p-4 border-t mt-6 flex justify-end">
                <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                    Close
                </button>
                {/* NEW: Download PDF button */}
                <button 
                    onClick={handleDownloadPdf} 
                    disabled={isDownloading}
                    className="ml-3 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                >
                    {isDownloading ? <Loader className="animate-spin mr-2" size={18} /> : <Download size={18} className="mr-2" />}
                    Download PDF
                </button>
            </div>
        </Modal>
    );
};

export default PayslipViewModal;