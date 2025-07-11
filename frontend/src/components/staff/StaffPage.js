import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import Modal from '../common/Modal'; // Assuming your Modal component is here
import Loader from '../common/Loader'; // Assuming your Loader component is here
import AddContactModal from '../common/AddContactModal'; // For adding/editing staff member details
import ConfirmationModal from '../common/ConfirmationModal'; // For confirming deletions
import { Users, UserPlus, Edit, Trash2, UserCheck, UserX, User } from 'lucide-react'; // Import User for view profile icon
import StaffProfileModal from './StaffProfileModal'; // <--- NEW IMPORT: StaffProfileModal

// This is a placeholder component for StaffPage.
// Its primary function will be to fetch and manage staff data,
// and handle modals for adding/editing staff.
const StaffPage = () => {
    const [staff, setStaff] = useState([]);
    const [isLoadingStaff, setIsLoadingStaff] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
    const [editingStaffMember, setEditingStaffMember] = useState(null); // Staff member currently being edited

    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [staffMemberToDelete, setStaffMemberToDelete] = useState(null);

    // NEW STATES for StaffProfileModal
    const [isStaffProfileModalOpen, setIsStaffProfileModalOpen] = useState(false);
    const [staffMemberToViewId, setStaffMemberToViewId] = useState(null);

    // Options for staff roles (used by AddContactModal when type='staff')
    const roleOptions = [
        { value: 'staff', label: 'Staff' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' },
    ];

    // Fetch staff members when component mounts or a staff member is saved/deleted
    const fetchStaff = async () => {
        setIsLoadingStaff(true);
        setFetchError(null);
        try {
            const res = await api.get('/staff');
            setStaff(res.data);
        } catch (err) {
            console.error('Error fetching staff:', err);
            setFetchError(err.response?.data?.message || 'Failed to fetch staff members.');
        } finally {
            setIsLoadingStaff(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    // Handlers for Add/Edit Staff Modal
    const handleOpenAddStaffModal = (staffToEdit = null) => {
        setEditingStaffMember(staffToEdit);
        setIsAddStaffModalOpen(true);
    };

    const handleCloseAddStaffModal = () => {
        setIsAddStaffModalOpen(false);
        setEditingStaffMember(null);
    };

    const handleStaffSaved = () => {
        fetchStaff(); // Re-fetch staff list to show updates
        handleCloseAddStaffModal();
    };

    // NEW HANDLERS for StaffProfileModal
    const handleViewStaffProfileClick = (staffId) => {
        setStaffMemberToViewId(staffId);
        setIsStaffProfileModalOpen(true);
    };

    const handleCloseStaffProfileModal = () => {
        setIsStaffProfileModalOpen(false);
        setStaffMemberToViewId(null);
    };

    // This is called from StaffProfileModal when "Edit Profile" is clicked
    const handleOpenEditFromProfileModal = (staffData) => {
        setIsStaffProfileModalOpen(false); // Close profile modal
        handleOpenAddStaffModal(staffData); // Open edit modal with staff data
    };


    // Handlers for Delete Staff
    const handleOpenDeleteConfirm = (staffMember) => {
        setStaffMemberToDelete(staffMember);
        setIsConfirmDeleteModalOpen(true);
    };

    const handleCloseDeleteConfirm = () => {
        setIsConfirmDeleteModalOpen(false);
        setStaffMemberToDelete(null);
    };

    const confirmDeleteStaff = async () => {
        if (!staffMemberToDelete) return;

        setIsLoadingStaff(true);
        setFetchError(null);
        try {
            await api.delete(`/staff/${staffMemberToDelete._id}`);
            setStaff(prevStaff => prevStaff.filter(s => s._id !== staffMemberToDelete._id));
            alert('Staff member deleted successfully!'); // Or a more subtle toast notification
        } catch (err) {
            console.error('Error deleting staff member:', err);
            setFetchError(err.response?.data?.message || 'Failed to delete staff member.');
        } finally {
            setIsLoadingStaff(false);
            handleCloseDeleteConfirm();
        }
    };

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl">
            <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <Users className="w-10 h-10 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Staff Management</h1>
                </div>
                <button
                    onClick={() => handleOpenAddStaffModal()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center gap-2"
                >
                    <UserPlus size={20} /> Add New Staff
                </button>
            </header>

            {fetchError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {fetchError}
                </div>
            )}

            {isLoadingStaff ? (
                <div className="p-8 text-center text-gray-500 text-lg">
                    <Loader className="animate-spin inline-block mr-2" /> Loading staff members...
                </div>
            ) : (
                staff.length === 0 ? (
                    <p className="text-center text-gray-600 py-10">No staff members found. Click "Add New Staff" to get started!</p>
                ) : (
                    <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Name</th>
                                    <th scope="col" className="px-6 py-3">Email</th>
                                    <th scope="col" className="px-6 py-3">Role</th>
                                    <th scope="col" className="px-6 py-3">Employee ID</th>
                                    <th scope="col" className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map(staffMember => (
                                    <tr key={staffMember._id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                            {staffMember.contactPersonName}
                                        </td>
                                        <td className="px-6 py-4">
                                            {staffMember.email || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 capitalize">
                                            {staffMember.role}
                                        </td>
                                        <td className="px-6 py-4">
                                            {staffMember.employeeId || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <div className="flex justify-center items-center space-x-3">
                                                {/* New View Profile Button */}
                                                <button
                                                    onClick={() => handleViewStaffProfileClick(staffMember._id)}
                                                    className="font-medium text-blue-600 hover:text-blue-800"
                                                    title="View Staff Profile"
                                                >
                                                    <User size={16} /> {/* Using User icon for profile view */}
                                                </button>
                                                <button
                                                    onClick={() => handleOpenAddStaffModal(staffMember)}
                                                    className="font-medium text-blue-600 hover:text-blue-800"
                                                    title="Edit Staff Member"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenDeleteConfirm(staffMember)}
                                                    className="font-medium text-red-600 hover:text-red-800"
                                                    title="Delete Staff Member"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* Add/Edit Staff Modal */}
            <AddContactModal
                isOpen={isAddStaffModalOpen}
                onClose={handleCloseAddStaffModal}
                onContactAdded={handleStaffSaved}
                initialData={editingStaffMember}
                type="staff" // Specify the type for AddContactModal
                roleOptions={roleOptions} // Pass available role options
            />

            {/* Confirm Delete Modal */}
            <ConfirmationModal
                isOpen={isConfirmDeleteModalOpen}
                onClose={handleCloseDeleteConfirm}
                onConfirm={confirmDeleteStaff}
                title="Confirm Staff Deletion"
                message={`Are you sure you want to delete staff member "${staffMemberToDelete?.contactPersonName || 'N/A'}"? This will also delete their associated login user account and cannot be undone.`}
            />

            {/* NEW: Staff Profile Modal */}
            {isStaffProfileModalOpen && (
                <StaffProfileModal
                    isOpen={isStaffProfileModalOpen}
                    onClose={handleCloseStaffProfileModal}
                    staffId={staffMemberToViewId}
                    onStaffUpdated={handleOpenEditFromProfileModal} // Allows editing from inside the profile modal
                />
            )}
        </div>
    );
};

export default StaffPage;