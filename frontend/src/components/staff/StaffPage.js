// src/components/staff/StaffPage.jsx

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import ConfirmationModal from '../common/ConfirmationModal';
import AddContactModal from '../common/AddContactModal';
import BulkUploader from '../common/BulkUploader'; // NEW: Import BulkUploader
import { useMapsApi } from '../../App';

const StaffPage = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [staffToDelete, setStaffToDelete] = useState(null);
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false); // NEW: State for bulk upload modal

    const { isMapsLoaded, isMapsLoadError } = useMapsApi();

    const staffRoleOptions = [
        { value: 'staff', label: 'Staff' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' },
    ];

    // NEW: Define fields for Staff Bulk Upload (for instructions and internal mapping)
    const staffUploadFields = [
        { header: 'Contact Person Name', key: 'contactPersonName' },
        { header: 'Email Address', key: 'email' },
        { header: 'Phone Number', key: 'phone' },
        { header: 'Street', key: 'address.street' }, // Detailed address fields
        { header: 'City', key: 'address.city' },
        { header: 'County', key: 'address.county' },
        { header: 'Postcode', key: 'address.postcode' },
        { header: 'Country', key: 'address.country' },
        { header: 'Role', key: 'role' },
        { header: 'Employee ID', key: 'employeeId' },
    ];


    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/staff');
            setStaff(res.data);
        } catch (err) {
            console.error('Error fetching staff:', err);
            setError(err.response?.data?.message || 'Failed to fetch staff members.');
        } finally {
            setLoading(false);
        }
    };

    const handleStaffSaved = () => {
        fetchStaff();
        setIsAddEditModalOpen(false);
        setSelectedStaff(null);
    };

    const handleAddStaffClick = () => {
        setSelectedStaff(null);
        setIsAddEditModalOpen(true);
    };

    const handleEditStaffClick = (staffMember) => {
        setSelectedStaff({
            ...staffMember,
            emails: staffMember.email ? [{ email: staffMember.email, label: 'Primary', isMaster: true }] : [],
            phones: staffMember.phone ? [{ number: staffMember.phone, label: 'Primary', isMaster: true }] : [],
            role: staffMember.role,
        });
        setIsAddEditModalOpen(true);
    };

    const handleDeleteClick = (staffMember) => {
        setStaffToDelete(staffMember);
        setIsConfirmationModalOpen(true);
    };

    const confirmDeleteStaff = async () => {
        if (!staffToDelete) return;

        setLoading(true);
        setError(null);
        try {
            await api.delete(`/staff/${staffToDelete._id}`);
            setStaff(prev => prev.filter(member => member._id !== staffToDelete._id));
            setStaffToDelete(null);
            setIsConfirmationModalOpen(false);
        } catch (err) {
            console.error('Error deleting staff:', err);
            setError(err.response?.data?.message || 'Failed to delete staff member.');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkUploadSuccess = () => { // NEW: Handler for successful bulk upload
        fetchStaff(); // Refresh the staff list
        setIsBulkUploadModalOpen(false); // Close the bulk upload modal
    };

    if (loading && staff.length === 0) return <Loader />;

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
                <h2 className="text-3xl font-extrabold text-gray-800">Staff Management</h2>
                <div className="flex space-x-3"> {/* NEW: Container for multiple buttons */}
                    <button
                        onClick={() => setIsBulkUploadModalOpen(true)} // NEW: Open bulk upload modal
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md"
                    >
                        Bulk Upload
                    </button>
                    <button
                        onClick={handleAddStaffClick}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md"
                    >
                        Add New Staff
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            <AddContactModal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                onContactAdded={handleStaffSaved}
                initialData={selectedStaff}
                isMapsLoaded={isMapsLoaded}
                isMapsLoadError={isMapsLoadError}
                type="staff"
                roleOptions={staffRoleOptions}
            />

            {/* NEW: Bulk Uploader for Staff */}
            <BulkUploader
                isOpen={isBulkUploadModalOpen}
                onClose={() => setIsBulkUploadModalOpen(false)}
                endpoint="/staff/bulk-upload" // Specific API endpoint
                fields={staffUploadFields} // Fields definition for instructions and mapping
                type="staff" // Type string for instructions
                onUploadSuccess={handleBulkUploadSuccess} // Callback on success
            />

            <ConfirmationModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={confirmDeleteStaff}
                title="Confirm Staff Deletion"
                message={`Are you sure you want to permanently delete staff member ${staffToDelete?.contactPersonName || ''}? This action cannot be undone and will remove their associated login.`}
            />

            {staff.length === 0 && !loading ? (
                <p className="text-gray-600 text-center py-10">No staff members found. Add your first staff member!</p>
            ) : (
                <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Email</th>
                                <th scope="col" className="px-6 py-3">Phone</th>
                                <th scope="col" className="px-6 py-3">Role</th>
                                <th scope="col" className="px-6 py-3">Employee ID</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map(member => (
                                <tr key={member._id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{member.contactPersonName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{member.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{member.phone || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap capitalize">{member.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{member.employeeId || 'N/A'}</td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end space-x-3">
                                            <button
                                                onClick={() => handleEditStaffClick(member)}
                                                className="font-medium text-indigo-600 hover:text-indigo-900"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(member)}
                                                className="font-medium text-red-600 hover:text-red-900"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default StaffPage;