// src/components/common/BulkUploader.jsx

import React, { useState } from 'react';
import Modal from './Modal';
import * as XLSX from 'xlsx';
import api from '../../utils/api';
import Loader from './Loader';

// FIXED: Changed 'uploadType' in destructuring to 'type'
const BulkUploader = ({ isOpen, onClose, type, onUploadSuccess }) => { // Renamed prop from uploadType to type
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [uploadDetails, setUploadDetails] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setError(null);
            setSuccessMessage(null);
            setPreviewData(null);
            setUploadDetails(null);
            parseFile(file);
        } else {
            setSelectedFile(null);
            setPreviewData(null);
            setUploadDetails(null);
        }
    };

    const parseFile = (file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                setPreviewData(json.slice(0, 5));
                console.log(`Parsed ${json.length} rows from ${type} file. Preview:`, json.slice(0, 5)); // Use 'type'

            } catch (err) {
                setError('Failed to parse file. Please ensure it\'s a valid CSV or Excel file.');
                console.error('File parsing error:', err);
                setPreviewData(null);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select a file to upload.');
            return;
        }

        setUploading(true);
        setError(null);
        setSuccessMessage(null);
        setUploadDetails(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                const formattedData = json.map(row => {
                    const newRecord = {};
                    const address = {};

                    for (const key in row) {
                        const rawValue = row[key];
                        if (rawValue === null || rawValue === undefined) continue;

                        const lowerKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

                        if (lowerKey.includes('name') && lowerKey.includes('contact')) newRecord.contactPersonName = String(rawValue);
                        else if (lowerKey.includes('email')) newRecord.email = String(rawValue);
                        else if (lowerKey.includes('phone')) newRecord.phone = String(rawValue);
                        else if (lowerKey.includes('companyname')) newRecord.companyName = String(rawValue);

                        else if (lowerKey.includes('street')) address.street = String(rawValue);
                        else if (lowerKey.includes('city')) address.city = String(rawValue);
                        else if (lowerKey.includes('county') || lowerKey.includes('state')) address.county = String(rawValue);
                        else if (lowerKey.includes('postcode') || lowerKey.includes('zip')) address.postcode = String(rawValue);
                        else if (lowerKey.includes('country')) address.country = String(rawValue);

                        else if (type === 'staff') { // Use 'type' prop here
                            if (lowerKey.includes('role')) newRecord.role = String(rawValue);
                            else if (lowerKey.includes('employeeid')) newRecord.employeeId = String(rawValue);
                        }
                        else if (type === 'customers') { // Use 'type' prop here
                            if (lowerKey.includes('customertype')) newRecord.customerType = String(rawValue);
                            else if (lowerKey.includes('industry')) newRecord.industry = String(rawValue);
                        }
                    }

                    if (Object.keys(address).length > 0) {
                        newRecord.address = address;
                    }

                    if (type === 'customers') { // Use 'type' prop here
                        if (newRecord.email) newRecord.email = [{ email: newRecord.email, label: 'Primary', isMaster: true }];
                        if (newRecord.phone) newRecord.phone = [{ number: newRecord.phone, label: 'Primary', isMaster: true }];
                    }

                    return newRecord;
                });

                console.log("Formatted data for upload:", formattedData);

                const endpointPath = type === 'customers' ? '/customers/bulk-upload' : '/staff/bulk-upload'; // Use 'type' prop here
                const payloadKey = type === 'customers' ? 'customers' : 'staff'; // Use 'type' prop here

                const response = await api.post(endpointPath, { [payloadKey]: formattedData });

                setSuccessMessage(response.data.message || 'Upload completed successfully!');
                setUploadDetails(response.data.summary);
                setSelectedFile(null);
                if (onUploadSuccess) {
                    onUploadSuccess();
                }
            } catch (err) {
                console.error('Upload failed:', err.response?.data || err.message, err);
                setError(err.response?.data?.message || 'Bulk upload failed. Please check file format and data.');
                setUploadDetails(err.response?.data?.details || (err.message && typeof err.message === 'string' ? [err.message] : null));
            } finally {
                setUploading(false);
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const getInstructions = () => {
        if (type === 'customers') { // Use 'type' prop here
            return (
                <>
                    <p>Upload a CSV or Excel file (.csv, .xls, .xlsx) to import multiple customer records.</p>
                    <p className="font-semibold mt-2">Required Headers (Case-Insensitive, flexible naming):</p>
                    <ul className="list-disc list-inside ml-4">
                        <li>`Contact Person Name` (e.g., `Full Name`, `Customer Name`)</li>
                        <li>`Email Address` (e.g., `Email`)</li>
                    </ul>
                    <p className="font-semibold mt-2">Optional Headers:</p>
                    <ul className="list-disc list-inside ml-4">
                        <li>`Company Name`</li>
                        <li>`Phone Number` (or `Phone`)</li>
                        <li>`Street`, `City`, `County`, `Postcode` (or `Zip`), `Country` (for address)</li>
                        <li>`Customer Type`</li>
                        <li>`Industry`</li>
                    </ul>
                </>
            );
        } else if (type === 'staff') { // Use 'type' prop here
            return (
                <>
                    <p>Upload a CSV or Excel file (.csv, .xls, .xlsx) to import multiple staff members.</p>
                    <p className="font-semibold mt-2">Required Headers (Case-Insensitive, flexible naming):</p>
                    <ul className="list-disc list-inside ml-4">
                        <li>`Contact Person Name` (e.g., `Full Name`, `Staff Name`)</li>
                        <li>`Email Address` (e.g., `Email`) - **Must be unique and not used by existing Firebase users.**</li>
                        <li>`Role` (must be 'staff' or 'manager')</li>
                    </ul>
                    <p className="font-semibold mt-2">Optional Headers:</p>
                    <ul className="list-disc list-inside ml-4">
                        <li>`Phone Number` (or `Phone`)</li>
                        <li>`Street`, `City`, `County`, `Postcode` (or `Zip`), `Country` (for address)</li>
                        <li>`Employee ID`</li>
                    </ul>
                </>
            );
        }
        return null;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Upload ${type.charAt(0).toUpperCase() + type.slice(1)}`} maxWidthClass="max-w-3xl">
            <div className="py-4 px-2 custom-scrollbar max-h-[80vh] overflow-y-auto">
                <div className="p-2 space-y-6">
                    {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
                    {successMessage && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{successMessage}</div>}

                    <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-700 p-4" role="alert">
                        <p className="font-bold">Instructions:</p>
                        {getInstructions()}
                    </div>

                    <div>
                        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
                            Select CSV or Excel File
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L36 32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="flex text-sm text-gray-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                        <span>Upload a file</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {selectedFile ? selectedFile.name : 'CSV, XLS, XLSX up to 10MB'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Preview parsed data */}
                    {previewData && previewData.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">File Preview (First {previewData.length} Rows)</h3>
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {/* Get headers from the first row of previewData, or assume common headers if previewData is empty for some reason */}
                                            {previewData[0] && Object.keys(previewData[0]).map(header => (
                                                <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {previewData.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {/* Ensure cell content is rendered safely */}
                                                {Object.values(row).map((cell, cellIndex) => (
                                                    <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{String(cell)}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">Ensure your columns match the expected format. Only the first {previewData.length} rows are shown.</p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-3 mr-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200 text-lg font-medium shadow-sm" disabled={uploading}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 text-lg font-medium shadow-md"
                            disabled={uploading || !selectedFile}
                        >
                            {uploading ? 'Uploading...' : 'Upload Data'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default BulkUploader;