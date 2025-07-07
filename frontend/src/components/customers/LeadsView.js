// src/components/customers/LeadsView.jsx

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import ConfirmationModal from '../common/ConfirmationModal';
import AddContactModal from '../common/AddContactModal'; // Corrected import path (if previous was `./AddLeadModal`)
import ModernSelect from '../common/ModernSelect';
import { useMapsApi } from '../../App'; // Corrected import from App.js

const LeadsView = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [selectedLeadForAction, setSelectedLeadForAction] = useState(null);
    const [selectedLeadIds, setSelectedLeadIds] = useState([]);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [actionToConfirm, setActionToConfirm] = useState(null);
    const [editingLeadStatusId, setEditingLeadStatusId] = useState(null);

    // Get Maps loading status from context
    const { isMapsLoaded, isMapsLoadError } = useMapsApi();

    const leadStatusOptions = [
        { value: 'New', label: 'New' },
        { value: 'Contacted', label: 'Contacted' },
        { value: 'Qualified', label: 'Qualified' },
        { value: 'Unqualified', label: 'Unqualified' },
        { value: 'Converted', label: 'Converted' },
    ];

    const leadSourceOptions = [
        { value: 'Website', label: 'Website' },
        { value: 'Referral', label: 'Referral' },
        { value: 'Social Media', label: 'Social Media' },
        { value: 'Cold Call', label: 'Cold Call' },
        { value: 'Other', label: 'Other' },
    ];

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/leads');
            setLeads(res.data);
            setSelectedLeadIds([]);
        } catch (err) {
            console.error('Error fetching leads:', err);
            setError(err.response?.data?.message || 'Failed to fetch leads.');
        } finally {
            setLoading(false);
        }
    };

    const handleContactSaved = () => {
        fetchLeads();
        setIsAddContactModalOpen(false);
    };

    const handleAddLeadClick = () => {
        setSelectedLeadForAction(null);
        setIsAddContactModalOpen(true);
    };

    const handleEditClick = (lead) => {
        setSelectedLeadForAction(lead);
        setIsAddContactModalOpen(true);
    };

    const handleDeleteClick = (lead) => {
        setSelectedLeadForAction(lead);
        setActionToConfirm('delete');
        setIsConfirmationModalOpen(true);
    };

    const handleConvertClick = async (lead) => {
        try {
            // First, mark the lead as converted on the backend. This updates its status
            // for lead tracking, but the actual customer creation is still pending.
            await api.post(`/leads/${lead._id}/mark-converted`);
            console.log(`Lead ${lead._id} marked as converted on backend.`);

            // Now, open the AddContactModal, pre-populating with lead data
            // and indicating it's for a customer.
            setSelectedLeadForAction({
                ...lead,
                convertedFromLead: lead._id, // Pass original lead ID for backend to delete
                customerType: '', // Default for new customer from lead (can be pre-filled as needed)
                industry: '',     // Default for new customer from lead
                serviceAddresses: [], // Start with no service addresses for new customer conversion
            });
            setIsAddContactModalOpen(true);
        } catch (err) {
            console.error('Error preparing lead for conversion:', err.response?.data?.message || err.message);
            setError(err.response?.data?.message || 'Failed to prepare lead for conversion.');
        }
    };

    const handleStatusChange = async (leadId, newStatus) => {
        if (newStatus === 'Converted') {
            const leadToConvert = leads.find(l => l._id === leadId);
            if (leadToConvert) {
                await handleConvertClick(leadToConvert);
            }
        } else {
            setEditingLeadStatusId(leadId);
            try {
                await api.put(`/leads/${leadId}`, { leadStatus: newStatus });
                setLeads(prevLeads =>
                    prevLeads.map(lead =>
                        lead._id === leadId ? { ...lead, leadStatus: newStatus } : lead
                    )
                );
            } catch (err) {
                console.error('Error updating lead status:', err);
                setError(err.response?.data?.message || 'Failed to update lead status.');
            } finally {
                setEditingLeadStatusId(null);
            }
        }
    };

    const handleCheckboxChange = (leadId) => {
        setSelectedLeadIds(prev =>
            prev.includes(leadId)
                ? prev.filter(id => id !== leadId)
                : [...prev, leadId]
        );
    };

    const handleSelectAllChange = (e) => {
        if (e.target.checked) {
            const allLeadIds = leads.map(lead => lead._id);
            setSelectedLeadIds(allLeadIds);
        } else {
            setSelectedLeadIds([]);
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedLeadIds.length === 0) return;
        setSelectedLeadForAction(null);
        setActionToConfirm('bulk-delete');
        setIsConfirmationModalOpen(true);
    };

    const confirmAction = async () => {
        setLoading(true);
        setError(null);
        try {
            if (actionToConfirm === 'delete' && selectedLeadForAction) {
                await api.delete(`/leads/${selectedLeadForAction._id}`);
                setLeads(prev => prev.filter(lead => lead._id !== selectedLeadForAction._id));
            } else if (actionToConfirm === 'bulk-delete' && selectedLeadIds.length > 0) {
                await api.post('/leads/bulk-delete', { ids: selectedLeadIds });
                setLeads(prev => prev.filter(lead => !selectedLeadIds.includes(lead._id)));
                setSelectedLeadIds([]);
            }
            fetchLeads();
        } catch (err) {
            console.error(`Error ${actionToConfirm}ing lead(s):`, err);
            setError(err.response?.data?.message || `Failed to ${actionToConfirm} lead(s).`);
        } finally {
            setLoading(false);
            setIsConfirmationModalOpen(false);
            setSelectedLeadForAction(null);
            setActionToConfirm(null);
        }
    };

    const getMasterContact = (contacts, type) => {
        if (!contacts) return 'N/A';
        if (Array.isArray(contacts)) {
            const master = contacts.find(c => c.isMaster);
            if (master) return type === 'email' ? master.email : master.number;
            const firstNonEmpty = contacts.find(c => (type === 'email' ? c.email : c.number)?.trim() !== '');
            return type === 'email' ? firstNonEmpty?.email : firstNonEmpty?.number;
        }
        return 'N/A';
    };

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
                <h2 className="text-3xl font-extrabold text-gray-800">Lead Management</h2>
                <div className="flex space-x-4">
                    {selectedLeadIds.length > 0 && (
                        <button
                            onClick={handleBulkDeleteClick}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={selectedLeadIds.length === 0 || loading}
                        >
                            Delete Selected ({selectedLeadIds.length})
                        </button>
                    )}
                    <button
                        onClick={handleAddLeadClick}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md"
                    >
                        Add New Lead
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            <AddContactModal
                isOpen={isAddContactModalOpen}
                onClose={() => setIsAddContactModalOpen(false)}
                onContactAdded={handleContactSaved}
                initialData={selectedLeadForAction}
                isMapsLoaded={isMapsLoaded}
                isMapsLoadError={isMapsLoadError}
                type={selectedLeadForAction?.convertedFromLead ? 'customer' : 'lead'}
            />

            <ConfirmationModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={confirmAction}
                title={
                    actionToConfirm === 'delete' ? 'Confirm Deletion' :
                    actionToConfirm === 'bulk-delete' ? `Confirm Bulk Deletion (${selectedLeadIds.length} Leads)` : ''
                }
                message={
                    actionToConfirm === 'delete' ? `Are you sure you want to delete ${selectedLeadForAction?.contactPersonName || 'this lead'}?` :
                    actionToConfirm === 'bulk-delete' ? `Are you sure you want to permanently delete the selected ${selectedLeadIds.length} leads? This action cannot be undone.` : ''
                }
            />

            {leads.length === 0 && !loading ? (
                <p className="text-gray-600 text-center py-10">No leads found. Start by adding a new lead to get started!</p>
            ) : (
                <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="p-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                        onChange={handleSelectAllChange}
                                        checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                                        disabled={loading}
                                    />
                                </th>
                                <th scope="col" className="px-6 py-3">Contact Person</th>
                                <th scope="col" className="px-6 py-3">Company Name</th>
                                <th scope="col" className="px-6 py-3">Email</th>
                                <th scope="col" className="px-6 py-3">Phone</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3">Source</th>
                                <th scope="col" className="px-6 py-3">Sales Person</th>
                                <th scope="col" className="px-6 py-3">Commission Earned</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map(lead => (
                                <tr key={lead._id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="w-4 p-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                            checked={selectedLeadIds.includes(lead._id)}
                                            onChange={() => handleCheckboxChange(lead._id)}
                                            disabled={loading}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        {lead.contactPersonName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.companyName || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getMasterContact(lead.email, 'email') || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getMasterContact(lead.phone, 'phone') || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.leadStatus === 'Converted' ? (
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                {lead.leadStatus}
                                            </span>
                                        ) : (
                                            <div className="relative">
                                                <ModernSelect
                                                    name="leadStatus"
                                                    value={lead.leadStatus}
                                                    onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                                                    options={leadStatusOptions.filter(o => o.value !== 'Converted')}
                                                    className="w-full"
                                                    disabled={editingLeadStatusId === lead._id || loading}
                                                />
                                                {editingLeadStatusId === lead._id && (
                                                    <span className="absolute right-0 top-0 mt-2 mr-2 text-blue-500 animate-spin">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356-2A8.001 8 0 004 12c0 2.21.815 4.214 2.158 5.764m15.356-2A8.001 8 0 0020 12c0-2.21-.815-4.214-2.158-5.764"></path></svg>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.leadSource}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.salesPersonName || 'Unassigned'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                        {lead.commissionEarned > 0 ? `£${lead.commissionEarned.toFixed(2)}` : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end space-x-3">
                                            {lead.leadStatus !== 'Converted' && (
                                                <>
                                                    <button
                                                        onClick={() => handleEditClick(lead)}
                                                        className="font-medium text-indigo-600 hover:text-indigo-900"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleConvertClick(lead)}
                                                        className="font-medium text-green-600 hover:text-green-900"
                                                    >
                                                        Convert
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleDeleteClick(lead)}
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

export default LeadsView;
