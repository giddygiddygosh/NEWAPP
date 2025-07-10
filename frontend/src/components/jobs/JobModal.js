import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../common/Modal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import AddressInput from '../common/AddressInput';
import api from '../../utils/api';
import { useMapsApi } from '../../App';
import { isSameDay } from '../../utils/helpers';
import { PlusIcon, XCircleIcon } from '@heroicons/react/20/solid';

const JobModal = ({ isOpen, onClose, onSave, jobData = null, customers = [], staff = [] }) => {
    const [formData, setFormData] = useState({
        customer: '', serviceType: '', description: '', date: '',
        time: '', duration: 60, assignedStaff: [], status: 'Booked',
        address: {}, notes: '', endDate: '',
        recurring: { pattern: 'none', endDate: '' }, createdBy: null,
        usedStockItems: [],
        price: 0,
        formTemplate: '',
    });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    const [availabilityError, setAvailabilityError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);
    const [availableStock, setAvailableStock] = useState([]);
    const [selectedStockItemId, setSelectedStockItemId] = useState('');
    const [stockQuantityToAdd, setStockQuantityToAdd] = useState(1);
    const [taskLists, setTaskLists] = useState([]);

    const { isMapsLoaded, isMapsLoadError } = useMapsApi();

    const serviceTypeOptions = [ { value: '', label: 'Select Service Type' }, { value: 'Installation', label: 'Installation' }, { value: 'Repair', label: 'Repair' }, { value: 'Maintenance', label: 'Maintenance' }, { value: 'Inspection', label: 'Inspection' }, { value: 'Consultation', label: 'Consultation' }, { value: 'Emergency', label: 'Emergency' }, { value: 'Other', label: 'Other' }];
    const jobStatusOptions = [ { value: 'Booked', label: 'Booked' }, { value: 'Confirmed', label: 'Confirmed' }, { value: 'In Progress', label: 'In Progress' }, { value: 'Completed', label: 'Completed' }, { value: 'Invoiced', label: 'Invoiced' }, { value: 'Invoice Paid', label: 'Invoice Paid' }, { value: 'Cancelled', label: 'Cancelled' }, { value: 'Pending', label: 'Pending' }, { value: 'On Hold', label: 'On Hold' }];
    const recurrenceOptions = [ { value: 'none', label: 'One-off' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }];

    const customerOptions = useMemo(() => [
        { value: '', label: 'Select Customer' },
        ...customers.map(cust => ({
            value: cust._id,
            label: `${cust.contactPersonName} (${cust.companyName || (cust.email?.length ? cust.email[0]?.email : 'N/A')})`
        }))
    ], [customers]);

    const availableStaff = useMemo(() => {
        const assignedIds = new Set(formData.assignedStaff.map(s => s._id || s));
        return (staff || []).filter(s => !assignedIds.has(s._id));
    }, [staff, formData.assignedStaff]);

    const currentAssignedStaff = useMemo(() => {
        const assignedIds = new Set(formData.assignedStaff.map(s => s._id || s));
        return (staff || []).filter(s => assignedIds.has(s._id));
    }, [staff, formData.assignedStaff]);

    const stockOptions = useMemo(() => {
        const addedStockIds = new Set(formData.usedStockItems.map(item => item.stockItem));
        return [
            { value: '', label: 'Select Stock Item' },
            ...(availableStock || [])
                .filter(item => !addedStockIds.has(item._id))
                .map(item => ({
                    value: item._id,
                    label: `${item.name} (Available: ${item.stockQuantity})`
                }))
        ];
    }, [availableStock, formData.usedStockItems]);

    const taskListOptions = useMemo(() => {
        return [
            { value: '', label: 'No Task List' },
            ...(taskLists || []).map(list => ({
                value: list._id,
                label: list.name,
            }))
        ];
    }, [taskLists]);


    useEffect(() => {
        if (isOpen) {
            // --- FIX START: This function is now timezone-safe ---
            const formatForDateInput = (dateInput) => {
                if (!dateInput) return '';
                // If it's already a 'YYYY-MM-DD' string from the parent, just use it.
                if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                    return dateInput;
                }
                const d = new Date(dateInput);
                if (isNaN(d.getTime())) return '';
                
                // Manually build the string from local date parts to avoid timezone shifts.
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            // --- FIX END ---

            const initialCustomer = jobData ? customers.find(c => c._id === (jobData.customer?._id || jobData.customer)) : null;
            setSelectedCustomerDetails(initialCustomer);
            
            let pattern = 'none', recurringEndDate = '', multiDayEndDate = '';
            if (jobData) {
                if (jobData.recurring && typeof jobData.recurring === 'object') {
                    pattern = jobData.recurring.pattern || 'none';
                    recurringEndDate = formatForDateInput(jobData.recurring.endDate);
                } else if (jobData.recurrence) {
                    pattern = jobData.recurrence;
                    recurringEndDate = formatForDateInput(jobData.endDate);
                }
                if (pattern === 'none' && jobData.endDate && !isSameDay(new Date(jobData.date), new Date(jobData.endDate))) {
                    multiDayEndDate = formatForDateInput(jobData.endDate);
                }
            }
            
            const effectiveJobData = jobData || {};

            setFormData({
                customer: effectiveJobData.customer?._id || effectiveJobData.customer || '',
                serviceType: effectiveJobData.serviceType || '',
                description: effectiveJobData.description || '',
                // --- FIX: Use today's date as a fallback for new jobs ---
                date: formatForDateInput(effectiveJobData.date || new Date()),
                time: effectiveJobData.time || '',
                duration: effectiveJobData.duration || 60,
                assignedStaff: effectiveJobData.assignedStaff || [],
                status: effectiveJobData.status || 'Booked',
                address: effectiveJobData.address || initialCustomer?.address || {},
                notes: effectiveJobData.notes || '',
                endDate: multiDayEndDate,
                recurring: { pattern: pattern, endDate: recurringEndDate },
                createdBy: effectiveJobData.createdBy || null,
                usedStockItems: effectiveJobData.usedStockItems || [],
                price: effectiveJobData.price ?? 0,
                formTemplate: effectiveJobData.formTemplate?._id || effectiveJobData.formTemplate || '',
            });
            
            setFormError(null);
            setAvailabilityError(null);
            setSuccessMessage(null);
            fetchAvailableStock();
            fetchTaskLists();
        }
    }, [isOpen, jobData, customers]);

    const fetchAvailableStock = async () => {
        try {
            const res = await api.get('/stock');
            setAvailableStock(res.data);
        } catch (err) {
            console.error("Failed to fetch available stock:", err);
            setFormError(err.response?.data?.message || "Failed to load available stock items.");
        }
    };

    const fetchTaskLists = async () => {
        try {
            const res = await api.get('/forms', { params: { purpose: 'reminder_task_list' } });
            setTaskLists(res.data);
        } catch (err) {
            console.error("Failed to fetch task lists:", err);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        let newValue;
        if (type === 'number') {
            newValue = value === '' ? 0 : parseFloat(value);
        } else {
            newValue = value;
        }

        if (name === 'pattern' || name === 'recurringEndDate') {
            const fieldName = name === 'recurringEndDate' ? 'endDate' : name;
            setFormData(prev => ({ ...prev, recurring: { ...prev.recurring, [fieldName]: newValue } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: newValue }));
        }
    };

    const handleCustomerSelectChange = (e) => {
        const customerId = e.target.value;
        setFormData(prev => ({ ...prev, customer: customerId }));
        if (customerId) {
            const selectedCust = customers.find(c => c._id === customerId);
            if (selectedCust) {
                setSelectedCustomerDetails(selectedCust);
                setFormData(prev => ({ ...prev, address: selectedCust.address || {} }));
            }
        } else {
            setSelectedCustomerDetails(null);
            setFormData(prev => ({ ...prev, address: {} }));
        }
    };

    const handleAddressChange = useCallback((newAddressObject) => {
        if (typeof newAddressObject === 'object' && newAddressObject !== null) {
            setFormData(prev => ({ ...prev, address: newAddressObject }));
        } else {
            console.error("AddressInput did not return an object:", newAddressObject);
            setFormData(prev => ({ ...prev, address: {} }));
        }
    }, []);

    const handleAddStockItem = () => {
        setFormError(null);
        if (!selectedStockItemId || stockQuantityToAdd <= 0) {
            setFormError('Please select a stock item and enter a positive quantity.');
            return;
        }

        const selectedItemDetails = availableStock.find(item => item._id === selectedStockItemId);
        if (!selectedItemDetails) {
            setFormError('Selected stock item not found in available stock.');
            return;
        }

        const existingJobItemIndex = formData.usedStockItems.findIndex(item => item.stockItem === selectedStockItemId);

        let newUsedStockItems;
        if (existingJobItemIndex !== -1) {
            const existingJobItem = formData.usedStockItems[existingJobItemIndex];
            const newQuantity = existingJobItem.quantityUsed + stockQuantityToAdd;
            
            newUsedStockItems = formData.usedStockItems.map((item, index) =>
                index === existingJobItemIndex
                    ? { ...item, quantityUsed: newQuantity }
                    : item
            );
        } else {
            newUsedStockItems = [
                ...formData.usedStockItems,
                {
                    stockItem: selectedStockItemId,
                    name: selectedItemDetails.name,
                    unit: selectedItemDetails.unit,
                    quantityUsed: stockQuantityToAdd
                }
            ];
        }
        setFormData(prev => ({ ...prev, usedStockItems: newUsedStockItems }));
        setSelectedStockItemId('');
        setStockQuantityToAdd(1);
    };

    const handleRemoveStockItem = (stockItemIdToRemove) => {
        setFormData(prev => ({
            ...prev,
            usedStockItems: prev.usedStockItems.filter(item => item.stockItem !== stockItemIdToRemove)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError(null);
        setSuccessMessage(null);

        if (availabilityError) {
            setFormError(availabilityError);
            setSaving(false);
            return;
        }

        if (!formData.customer || !formData.serviceType || !formData.date || !formData.time || !formData.duration || typeof formData.price !== 'number') {
            setFormError('Please fill in all required fields: Customer, Service Type, Date, Time, Duration, and a valid Price.');
            setSaving(false);
            return;
        }
        
        const dataToSend = { ...formData, staff: formData.assignedStaff };
        delete dataToSend.assignedStaff;
        
        try {
            let res;
            if (jobData?._id) {
                res = await api.put(`/jobs/${jobData._id}`, dataToSend);
                setSuccessMessage('Job updated successfully!');
            } else {
                res = await api.post('/jobs', dataToSend);
                setSuccessMessage('Job created successfully!');
            }

            if (res.data && res.data.job) {
                onSave(res.data.job);
            } else {
                console.error("API response did not include job object. Triggering a full data refresh.");
                onSave();
            }

            setTimeout(() => onClose(), 1500);
        } catch (err) {
            const errorData = err.response?.data;
            setFormError(errorData?.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={jobData?._id ? 'Edit Job' : 'Create New Job'} maxWidthClass="max-w-3xl">
            <div className="py-4 px-2 custom-scrollbar max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-2 space-y-6">
                    {formError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 whitespace-pre-wrap">{formError}</div>}
                    {successMessage && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{successMessage}</div>}

                    <ModernSelect label="Customer" name="customer" value={formData.customer} onChange={handleCustomerSelectChange} options={customerOptions} required disabled={!customers || customers.length === 0} />
                    <ModernSelect label="Service Type" name="serviceType" value={formData.serviceType} onChange={handleChange} options={serviceTypeOptions} required />
                    <ModernInput label="Description (Optional)" name="description" value={formData.description} onChange={handleChange} textarea />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernInput label="Date" name="date" type="date" value={formData.date} onChange={handleChange} required />
                        <ModernInput label="Time" name="time" type="time" value={formData.time} onChange={handleChange} required />
                        <ModernInput label="Duration (minutes)" name="duration" type="number" value={formData.duration} onChange={handleChange} required min="5" step="5" />
                        <ModernInput label="Price" name="price" type="number" value={String(formData.price)} onChange={handleChange} required min="0" step="0.01" />
                    </div>
                    <ModernSelect label="Job Recurrence" name="pattern" value={formData.recurring.pattern} onChange={handleChange} options={recurrenceOptions} />
                    {formData.recurring.pattern !== 'none' && (
                        <ModernInput label="Repeat Until Date" name="recurringEndDate" type="date" value={formData.recurring.endDate || ''} onChange={handleChange} required />
                    )}
                    <ModernSelect
                        label="Select Task List Template (Optional)"
                        name="formTemplate"
                        value={formData.formTemplate}
                        onChange={handleChange}
                        options={taskListOptions}
                    />
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Staff</label>
                        <div className="flex space-x-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Available Staff</label>
                                <div className="border border-gray-300 rounded-md p-2 h-40 overflow-y-auto">
                                    {availableStaff.length > 0 ? (
                                        <ul className="space-y-1">{availableStaff.map(staffMember => (
                                            <li key={staffMember._id} className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
                                                <span className="text-sm text-gray-800">{staffMember.contactPersonName}</span>
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, assignedStaff: [...prev.assignedStaff, staffMember] }))} className="text-blue-600 hover:text-blue-800 text-sm">Add</button>
                                            </li>))}
                                        </ul>
                                    ) : <p className="text-gray-500 text-sm">No staff available.</p>}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned Staff</label>
                                <div className="border border-gray-300 rounded-md p-2 h-40 overflow-y-auto">
                                    {currentAssignedStaff.length > 0 ? (
                                        <ul className="space-y-1">{currentAssignedStaff.map(staffMember => (
                                            <li key={staffMember._id} className="flex justify-between items-center bg-blue-100 p-2 rounded-md">
                                                <span className="text-sm text-blue-800">{staffMember.contactPersonName}</span>
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, assignedStaff: prev.assignedStaff.filter(s => s._id !== staffMember._id) }))} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                                            </li>))}
                                        </ul>
                                    ) : <p className="text-gray-500 text-sm">No staff assigned.</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Items Used</label>
                        <div className="flex items-end space-x-2 mb-4">
                            <div className="flex-grow">
                                <ModernSelect
                                    label="Select Item"
                                    name="selectedStockItem"
                                    value={selectedStockItemId}
                                    onChange={(e) => setSelectedStockItemId(e.target.value)}
                                    options={stockOptions}
                                />
                            </div>
                            <ModernInput
                                label="Quantity"
                                type="number"
                                value={stockQuantityToAdd}
                                onChange={(e) => setStockQuantityToAdd(parseInt(e.target.value) || 0)}
                                className="w-24"
                                min="1"
                            />
                            <button
                                type="button"
                                onClick={handleAddStockItem}
                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center justify-center h-10"
                                disabled={!selectedStockItemId || stockQuantityToAdd <= 0}
                            >
                                <PlusIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {formData.usedStockItems.length > 0 && (
                            <div className="border border-gray-300 rounded-md p-2 max-h-40 overflow-y-auto">
                                <ul className="space-y-1">
                                    {formData.usedStockItems.map(item => (
                                        <li key={item.stockItem} className="flex justify-between items-center bg-blue-100 p-2 rounded-md">
                                            <span className="text-sm text-blue-800">{item.name} (Qty: {item.quantityUsed})</span>
                                            <button type="button" onClick={() => handleRemoveStockItem(item.stockItem)} className="text-red-600 hover:text-red-800">
                                                <XCircleIcon className="h-5 w-5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <ModernSelect label="Job Status" name="status" value={formData.status} onChange={handleChange} options={jobStatusOptions} required />
                    <AddressInput label="Job Address" address={formData.address} onChange={handleAddressChange} fieldName="jobAddress" isMapsLoaded={isMapsLoaded} isMapsLoadError={isMapsLoadError} />
                    <ModernInput label="Internal Notes (Optional)" name="notes" value={formData.notes} onChange={handleChange} textarea />
                    <div className="flex justify-end space-x-2 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-3 mr-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50" disabled={saving}>Cancel</button>
                        <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={saving || !!availabilityError}>
                            {saving ? 'Saving...' : (jobData?._id ? 'Update Job' : 'Create Job')}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default JobModal;
