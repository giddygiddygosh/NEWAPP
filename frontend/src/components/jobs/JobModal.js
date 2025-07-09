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
        const assignedIds = new Set(formData.assignedStaff);
        return (staff || []).filter(s => !assignedIds.has(s._id));
    }, [staff, formData.assignedStaff]);

    const currentAssignedStaff = useMemo(() => {
        const assignedIds = new Set(formData.assignedStaff);
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
            const formatForDateInput = (dateInput) => {
                if (!dateInput) return '';
                const d = new Date(dateInput);
                return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
            };
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
            setFormData({
                customer: jobData?.customer?._id || jobData?.customer || '',
                serviceType: jobData?.serviceType || '',
                description: jobData?.description || '',
                date: formatForDateInput(jobData?.date),
                time: jobData?.time || '',
                duration: jobData?.duration || 60,
                assignedStaff: jobData?.assignedStaff?.map(s => typeof s === 'string' ? s : s._id) || [],
                status: jobData?.status || 'Booked',
                address: jobData?.address || initialCustomer?.address || {},
                notes: jobData?.notes || '',
                endDate: multiDayEndDate,
                recurring: { pattern: pattern, endDate: recurringEndDate },
                createdBy: jobData?.createdBy || null,
                usedStockItems: jobData?.usedStockItems?.map(item => ({
                    stockItem: item.stockItem?._id || item.stockItem,
                    name: item.stockItem?.name,
                    unit: item.stockItem?.unit,
                    quantityUsed: item.quantityUsed
                })) || [],
                price: jobData?.price ?? 0,
                formTemplate: jobData?.formTemplate || '',
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

            const originalQuantityOnJob = jobData?.usedStockItems?.find(i => i.stockItem?._id === selectedStockItemId)?.quantityUsed || 0;
            const totalAvailableInInventory = selectedItemDetails.stockQuantity + originalQuantityOnJob;

            if (newQuantity > totalAvailableInInventory) {
                setFormError(`Cannot add ${stockQuantityToAdd} more. Total available for ${selectedItemDetails.name}: ${totalAvailableInInventory - existingJobItem.quantityUsed}.`);
                return;
            }
            
            newUsedStockItems = formData.usedStockItems.map((item, index) =>
                index === existingJobItemIndex
                    ? { ...item, quantityUsed: newQuantity }
                    : item
            );
        } else {
            if (stockQuantityToAdd > selectedItemDetails.stockQuantity) {
                setFormError(`Insufficient stock for ${selectedItemDetails.name}. Available: ${selectedItemDetails.stockQuantity}, Requested: ${stockQuantityToAdd}.`);
                return;
            }
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
        const isAddressValid = formData.address && typeof formData.address === 'object' && (
            formData.address.street || formData.address.city || formData.address.postcode || formData.address.country
        );
        if (!isAddressValid) {
            setFormError('Please provide a valid job address (street, city, postcode, or country).');
            setSaving(false);
            return;
        }


        const dataToSend = { ...formData };
        dataToSend.staff = dataToSend.assignedStaff;
        delete dataToSend.assignedStaff;

        if (dataToSend.recurring.pattern === 'none') {
            delete dataToSend.recurring;
            if (!dataToSend.endDate || isSameDay(new Date(dataToSend.date), new Date(dataToSend.endDate))) {
                delete dataToSend.endDate;
            }
        } else {
            dataToSend.endDate = dataToSend.recurring.endDate;
            dataToSend.recurrence = dataToSend.recurring.pattern;
            delete dataToSend.recurring;
        }
        
        try {
            console.log('Job data being sent (frontend):', dataToSend);
            let res;
            if (jobData?._id) {
                res = await api.put(`/jobs/${jobData._id}`, dataToSend);
                setSuccessMessage('Job updated successfully!');
            } else {
                res = await api.post('/jobs', dataToSend);
                setSuccessMessage('Job created successfully!');
            }

            // ✅ FIXED: Add the safety check before saving
            if (res.data && res.data.job) {
                onSave(res.data.job); // Only call onSave with a valid job object
            } else {
                // This is a fallback if the API doesn't return the job object.
                // It calls onSave() without arguments to signal that the parent
                // component should re-fetch all its data.
                console.error("API response did not include job object. Triggering a full data refresh.");
                onSave();
            }

            setTimeout(() => onClose(), 1500);
        } catch (err) {
            const errorData = err.response?.data;
            if (errorData && errorData.message) {
                const detailedError = errorData.details ? `${errorData.message}\n${errorData.details}` : errorData.message;
                setFormError(detailedError);
            } else {
                setFormError('An unexpected error occurred. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    const serviceAddressOptions = useMemo(() => {
        if (!selectedCustomerDetails) return [{ value: '', label: 'Select Customer first' }];
        const options = [];
        const primaryAddressString = `${selectedCustomerDetails.address?.street || ''}, ${selectedCustomerDetails.address?.city || ''}`.trim();
        options.push({ value: 'primary', label: `Primary: ${primaryAddressString || '(No address set)'}` });
        if (selectedCustomerDetails.serviceAddresses?.length) {
            selectedCustomerDetails.serviceAddresses.forEach((addr, idx) => {
                const addrString = `${addr.street || ''}, ${addr.city || ''}`.trim();
                options.push({ value: `service-${idx}`, label: `Service ${idx + 1}: ${addrString || '(No address set)'}` });
            });
        }
        options.push({ value: 'custom', label: 'Custom Address (Enter Below)' });
        return options;
    }, [selectedCustomerDetails]);

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
                        <ModernInput 
                            label="Price" 
                            name="price" 
                            type="number" 
                            value={String(formData.price)} 
                            onChange={handleChange} 
                            required 
                            min="0" 
                            step="0.01" 
                        />
                    </div>
                    <ModernSelect label="Job Recurrence" name="pattern" value={formData.recurring.pattern} onChange={handleChange} options={recurrenceOptions} />
                    {formData.recurring.pattern !== 'none' && (
                        <ModernInput label="Repeat Until Date" name="recurringEndDate" type="date" value={formData.recurring.endDate || ''} onChange={handleChange} required helpText="The job will repeat according to the pattern until this date." />
                    )}
                    <ModernSelect
                        label="Select Task List Template (Optional)"
                        name="formTemplate"
                        value={formData.formTemplate}
                        onChange={handleChange}
                        options={taskListOptions}
                        helpText="Choose a task list from your Form Builder to auto-populate job tasks."
                    />
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Staff</label>
                        {availabilityError && (
                            <div className="text-sm text-red-600 bg-red-100 p-2 rounded-md mb-2">{availabilityError}</div>
                        )}
                        <div className="flex space-x-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Available Staff</label>
                                <div className="border border-gray-300 rounded-md p-2 h-40 overflow-y-auto">
                                    {availableStaff.length > 0 ? (
                                        <ul className="space-y-1">{availableStaff.map(staffMember => (
                                            <li key={staffMember._id} className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
                                                <span className="text-sm text-gray-800">{staffMember.contactPersonName}</span>
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, assignedStaff: [...prev.assignedStaff, staffMember._id] }))} className="text-blue-600 hover:text-blue-800 text-sm">Add</button>
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
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, assignedStaff: prev.assignedStaff.filter(id => id !== staffMember._id) }))} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
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
                                    disabled={availableStock.length === 0}
                                />
                            </div>
                            <ModernInput
                                label="Quantity"
                                type="number"
                                value={stockQuantityToAdd}
                                onChange={(e) => setStockQuantityToAdd(parseInt(e.target.value) || 0)}
                                className="w-24"
                                min="1"
                                disabled={!selectedStockItemId}
                            />
                            <button
                                type="button"
                                onClick={handleAddStockItem}
                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center justify-center h-10"
                                disabled={!selectedStockItemId || stockQuantityToAdd <= 0 || saving || availableStock.length === 0}
                            >
                                <PlusIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {formData.usedStockItems.length > 0 && (
                            <div className="border border-gray-300 rounded-md p-2 max-h-40 overflow-y-auto">
                                <ul className="space-y-1">
                                    {formData.usedStockItems.map(item => (
                                        <li key={item.stockItem} className="flex justify-between items-center bg-blue-100 p-2 rounded-md">
                                            <span className="text-sm text-blue-800">{item.name} (Qty: {item.quantityUsed} {item.unit})</span>
                                            <button type="button" onClick={() => handleRemoveStockItem(item.stockItem)} className="text-red-600 hover:text-red-800">
                                                <XCircleIcon className="h-5 w-5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {availableStock.length === 0 && (
                            <p className="text-gray-500 text-sm mt-2">No stock items available. Add some in the Stock section.</p>
                        )}
                    </div>

                    <ModernSelect label="Job Status" name="status" value={formData.status} onChange={handleChange} options={jobStatusOptions} required />
                    <AddressInput label="Job Address" address={formData.address} onChange={handleAddressChange} fieldName="jobAddress" isMapsLoaded={isMapsLoaded} isMapsLoadError={isMapsLoadError} />
                    <ModernInput label="Internal Notes (Optional)" name="notes" value={formData.notes} onChange={handleChange} textarea />
                    <div className="flex justify-end space-x-2 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-3 mr-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200 text-lg font-medium shadow-sm" disabled={saving}>Cancel</button>
                        <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 text-lg font-medium shadow-md" disabled={saving || !!availabilityError}>
                            {saving ? 'Saving...' : (jobData?._id ? 'Update Job' : 'Create Job')}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default JobModal;