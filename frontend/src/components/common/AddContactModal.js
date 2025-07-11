import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import Modal from '../common/Modal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import AddressInput from '../common/AddressInput';

// roleOptions is expected from StaffPage.jsx
const AddContactModal = ({ isOpen, onClose, onContactAdded, initialData, isMapsLoaded, isMapsLoadError, type = 'lead', roleOptions = [] }) => {
    const modalTitle = type === 'lead'
        ? (initialData ? 'Edit Lead' : 'Add New Lead')
        : type === 'customer'
            ? (initialData ? 'Edit Customer' : 'Add New Customer')
            : (initialData ? 'Edit Staff Member' : 'Add New Staff Member');

    // === FIX HERE: Initialize formData with a complete default structure ===
    const [formData, setFormData] = useState({
        companyName: '',
        contactPersonName: '',
        emails: [{ email: '', label: 'Primary', isMaster: true }],
        phones: [{ number: '', label: 'Primary', isMaster: true }],
        address: {},
        leadSource: 'Website',
        leadStatus: 'New',
        commissionEarned: 0,
        serviceAddresses: [],
        convertedFromLead: null,
        customerType: '',
        industry: '',
        role: 'staff',
        employeeId: '',
        salesPersonName: '',
        payRateType: 'Hourly',
        hourlyRate: 0,
        jobFixedAmount: 0,
        jobPercentage: 0,
        dailyClockInThresholdMins: 480,
        sendWelcomeEmail: true,
        sendInvoiceEmail: true,
        invoiceEmailTrigger: 'On Completion',
        invoicePatternStartDate: '',
        sendInvoiceReminderEmail: false,
        invoiceReminderDaysOffset: 7,
        sendReviewRequestEmail: false,
        reviewRequestDaysOffset: 3,
        sendAppointmentReminderEmail: true,
        sendQuoteEmail: true,
        appointmentReminderDaysOffset: 0,
    });
    // === END FIX ===

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const leadStatusOptions = [
        { value: 'New', label: 'New' },
        { value: 'Contacted', label: 'Contacted' },
        { value: 'Qualified', label: 'Qualified' },
        { value: 'Unqualified', label: 'Unqualified' },
    ];

    const leadSourceOptions = [
        { value: 'Website', label: 'Website' },
        { value: 'Referral', label: 'Referral' },
        { value: 'Social Media', label: 'Social Media' },
        { value: 'Cold Call', label: 'Cold Call' },
        { value: 'Other', label: 'Other' },
    ];

    const customerTypeOptions = [
        { value: '', label: 'Select Type' },
        { value: 'Residential', label: 'Residential' },
        { value: 'Commercial', label: 'Commercial' },
        { value: 'Industrial', label: 'Industrial' },
        { value: 'Other', label: 'Other' },
    ];

    const industryOptions = [
        { value: '', label: 'Select Industry' },
        { value: 'Retail', label: 'Retail' },
        { value: 'Hospitality', label: 'Hospitality' },
        { value: 'Healthcare', label: 'Healthcare' },
        { value: 'Construction', label: 'Construction' },
        { value: 'Education', label: 'Education' },
        { value: 'Manufacturing', label: 'Manufacturing' },
        { value: 'Service', label: 'Service' },
        { value: 'Other', label: 'Other' },
    ];

    const payTypeOptions = [
        { value: '', label: 'Select Pay Type' },
        { value: 'Fixed', label: 'Fixed' },
        { value: 'Hourly', label: 'Hourly' },
    ];

    const staffPayRateTypeOptions = [
        { value: 'Hourly', label: 'Hourly' },
        { value: 'Fixed per Job', label: 'Fixed per Job' },
        { value: 'Percentage per Job', label: 'Percentage per Job' },
        { value: 'Daily Rate', label: 'Daily Rate' },
    ];

    const patternedInvoiceTriggers = ['Weekly', 'Bi-Weekly', '4-Weekly', 'Monthly'];

    const invoiceEmailTriggerOptions = [
        { value: 'On Completion', label: 'On Job Completion' },
        { value: 'Weekly', label: 'Weekly' },
        { value: 'Bi-Weekly', label: 'Bi-Weekly' },
        { value: '4-Weekly', label: 'Every 4 Weeks' },
        { value: 'Monthly', label: 'Monthly' },
    ];

    useEffect(() => {
        // This useEffect now *updates* the formData when isOpen is true or initialData/type changes
        // It no longer defines the *initial* formData state on every render.
        if (isOpen) {
            let initialEmails = [{ email: '', label: 'Primary', isMaster: true }];
            let initialPhones = [{ number: '', label: 'Primary', isMaster: true }];

            // Adjust initialEmails and initialPhones based on type and actual data structure
            if (initialData) {
                if (type === 'staff') {
                    // For staff: If email/phone are strings in initialData, convert to array of objects
                    initialEmails = (typeof initialData.email === 'string' && initialData.email.trim() !== '')
                        ? [{ email: initialData.email, label: 'Primary', isMaster: true }]
                        : (initialData.email && Array.isArray(initialData.email) && initialData.email.length > 0)
                            ? initialData.email
                            : [{ email: '', label: 'Primary', isMaster: true }]; // Fallback for empty/non-array email

                    initialPhones = (typeof initialData.phone === 'string' && initialData.phone.trim() !== '')
                        ? [{ number: initialData.phone, label: 'Primary', isMaster: true }]
                        : (initialData.phone && Array.isArray(initialData.phone) && initialData.phone.length > 0)
                            ? initialData.phone
                            : [{ number: '', label: 'Primary', isMaster: true }]; // Fallback for empty/non-array phone

                } else { // type is 'lead' or 'customer'
                    // For leads/customers, assume email/phone are already arrays of objects
                    initialEmails = initialData.email?.length ? initialData.email : [{ email: '', label: 'Primary', isMaster: true }];
                    initialPhones = initialData.phone?.length ? initialData.phone : [{ number: '', label: 'Primary', isMaster: true }];
                }
            }
            
            setFormData(prev => ({
                ...prev, // Keep any previous formData that is not explicitly overwritten
                // Common fields across types
                companyName: initialData?.companyName || '',
                contactPersonName: initialData?.contactPersonName || '',
                emails: initialEmails,
                phones: initialPhones,
                address: initialData?.address || {},

                // Lead/Customer/Staff specific fields (override defaults set in useState)
                leadSource: initialData?.leadSource || 'Website',
                leadStatus: initialData?.leadStatus || (type === 'lead' ? 'New' : ''),
                commissionEarned: initialData?.commissionEarned || 0,

                serviceAddresses: (initialData?.serviceAddresses || []).map(addr => ({ ...addr, payType: addr.payType || '', amount: addr.amount || 0 })),
                convertedFromLead: initialData?.convertedFromLead || null,
                customerType: initialData?.customerType || '',
                industry: initialData?.industry || '',
                
                role: initialData?.role || 'staff',
                employeeId: initialData?.employeeId || '',
                salesPersonName: initialData?.salesPersonName || '',

                payRateType: initialData?.payRateType || 'Hourly',
                hourlyRate: initialData?.hourlyRate || 0,
                jobFixedAmount: initialData?.jobFixedAmount || 0,
                jobPercentage: initialData?.jobPercentage || 0,
                dailyClockInThresholdMins: initialData?.dailyClockInThresholdMins || 480,

                sendWelcomeEmail: initialData?.sendWelcomeEmail ?? true,
                sendInvoiceEmail: initialData?.sendInvoiceEmail ?? true,
                invoiceEmailTrigger: initialData?.invoiceEmailTrigger || 'On Completion',
                invoicePatternStartDate: initialData?.invoicePatternStartDate ? new Date(initialData.invoicePatternStartDate).toISOString().split('T')[0] : '',
                sendInvoiceReminderEmail: initialData?.sendInvoiceReminderEmail ?? false,
                invoiceReminderDaysOffset: initialData?.invoiceReminderDaysOffset || 7,
                sendReviewRequestEmail: initialData?.sendReviewRequestEmail ?? false,
                reviewRequestDaysOffset: initialData?.reviewRequestDaysOffset || 3,
                sendAppointmentReminderEmail: initialData?.sendAppointmentReminderEmail ?? true,
                sendQuoteEmail: initialData?.sendQuoteEmail ?? true,
                appointmentReminderDaysOffset: initialData?.appointmentReminderDaysOffset || 0,
            }));
            setError(null);
            setSuccessMessage(null);
        } else {
            // When modal closes or is not open, reset formData to its default empty state
            setFormData({
                companyName: '', contactPersonName: '',
                emails: [{ email: '', label: 'Primary', isMaster: true }],
                phones: [{ number: '', label: 'Primary', isMaster: true }],
                address: {}, leadSource: 'Website', leadStatus: 'New', commissionEarned: 0,
                serviceAddresses: [], convertedFromLead: null, customerType: '', industry: '',
                role: 'staff', employeeId: '', salesPersonName: '',
                payRateType: 'Hourly', hourlyRate: 0, jobFixedAmount: 0, jobPercentage: 0, dailyClockInThresholdMins: 480,
                sendWelcomeEmail: true, sendInvoiceEmail: true, invoiceEmailTrigger: 'On Completion',
                invoicePatternStartDate: '', sendInvoiceReminderEmail: false, invoiceReminderDaysOffset: 7,
                sendReviewRequestEmail: false, reviewRequestDaysOffset: 3, sendAppointmentReminderEmail: true,
                sendQuoteEmail: true, appointmentReminderDaysOffset: 0,
            });
            setError(null);
            setSuccessMessage(null);
        }
    }, [initialData, isOpen, type]);

    const handleChange = (e) => {
        const { name, value, type: inputType, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: inputType === 'checkbox' ? checked : value
        }));
    };

    const handleAddressChange = useCallback((newAddressObject) => {
        setFormData(prev => ({ ...prev, address: newAddressObject }));
    }, []);

    const handleEmailChange = useCallback((index, e) => {
        const { name, value, checked } = e.target;
        setFormData(prev => {
            const newEmails = [...prev.emails];
            if (name === 'isMaster') {
                newEmails.forEach((email, i) => newEmails[i].isMaster = (i === index && checked));
            } else {
                newEmails[index] = { ...newEmails[index], [name]: value };
            }
            return { ...prev, emails: newEmails };
        });
    }, []);

    const addEmail = () => {
        setFormData(prev => ({
            ...prev,
            emails: [...prev.emails, { email: '', label: '', isMaster: false }]
        }));
    };

    const removeEmail = (index) => {
        setFormData(prev => {
            const newEmails = prev.emails.filter((_, i) => i !== index);
            if (newEmails.length > 0 && newEmails.filter(e => e.isMaster).length === 0) {
                newEmails[0].isMaster = true;
            }
            return { ...prev, emails: newEmails };
        });
    };

    const handlePhoneChange = useCallback((index, e) => {
        const { name, value, checked } = e.target;
        setFormData(prev => {
            const newPhones = [...prev.phones];
            if (name === 'isMaster') {
                newPhones.forEach((phone, i) => newPhones[i].isMaster = (i === index && checked));
            } else {
                newPhones[index] = { ...newPhones[index], [name]: value };
            }
            if (newPhones[index]?.number?.length > 0 && newPhones.filter(p => p.isMaster).length === 0) {
                newPhones[index].isMaster = true;
            }
            return { ...prev, phones: newPhones };
        });
    }, []);

    const addPhone = () => {
        setFormData(prev => ({
            ...prev,
            phones: [...prev.phones, { number: '', label: '', isMaster: false }]
        }));
    };

    const removePhone = (index) => {
        setFormData(prev => {
            const newPhones = prev.phones.filter((_, i) => i !== index);
            if (newPhones.length > 0 && newPhones.filter(p => p.isMaster).length === 0) {
                newPhones[0].isMaster = true;
            }
            return { ...prev, phones: newPhones };
        });
    };

    const handleServiceAddressChange = useCallback((index, updatedFieldOrAddressObject, fieldName = null) => {
        setFormData(prev => {
            const newServiceAddresses = [...prev.serviceAddresses];
            if (fieldName) {
                newServiceAddresses[index] = {
                    ...newServiceAddresses[index],
                    [fieldName]: updatedFieldOrAddressObject
                };
            } else {
                newServiceAddresses[index] = updatedFieldOrAddressObject;
            }
            return { ...prev, serviceAddresses: newServiceAddresses };
        });
    }, []);

    const addEmptyServiceAddress = () => {
        setFormData(prev => ({
            ...prev,
            serviceAddresses: [...prev.serviceAddresses, { payType: '', amount: 0 }]
        }));
    };

    const copyMainAddressToServiceAddress = () => {
        const primaryAddressHasData = Object.values(formData.address).some(val => val && val.toString().trim() !== '');

        if (!primaryAddressHasData) {
            setError('Please fill in the Primary Address first before copying it to a service address.');
            setTimeout(() => setError(null), 3000);
            return;
        }

        setFormData(prev => {
            const newServiceAddresses = [...prev.serviceAddresses];
            const primaryAddressCopy = { ...prev.address, payType: prev.address.payType || '', amount: prev.address.amount || 0 };

            const emptyIndex = newServiceAddresses.findIndex(addr =>
                !Object.values(addr).some(val => val && val.toString().trim() !== '') && !addr.payType && !addr.amount
            );

            if (emptyIndex !== -1) {
                newServiceAddresses[emptyIndex] = primaryAddressCopy;
            } else {
                newServiceAddresses.push(primaryAddressCopy);
            }

            return { ...prev, serviceAddresses: newServiceAddresses };
        });
    };

    const removeServiceAddress = (index) => {
        setFormData(prev => ({
            ...prev,
            serviceAddresses: prev.serviceAddresses.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        if (!formData.contactPersonName || formData.contactPersonName.trim() === '') {
            setError('Contact Person Name is required.');
            setSaving(false);
            return;
        }

        const masterEmailEntry = formData.emails.find(e => e.isMaster);
        const masterEmailValue = masterEmailEntry?.email?.trim();
        if (!masterEmailValue) {
            setError('A Master Email address is required.');
            setSaving(false);
            return;
        }

        if (type === 'staff' && (!formData.role || formData.role.trim() === '')) {
            setError('Staff role is required.');
            setSaving(false);
            return;
        }

        try {
            let response;
            const dataToSave = { ...formData };

            dataToSave.email = formData.emails.filter(e => e.email.trim() !== '');
            dataToSave.phone = formData.phones.filter(p => p.number.trim() !== '');

            dataToSave.hourlyRate = parseFloat(formData.hourlyRate) || 0;
            dataToSave.jobFixedAmount = parseFloat(formData.jobFixedAmount) || 0;
            dataToSave.jobPercentage = parseFloat(formData.jobPercentage) || 0;
            dataToSave.dailyClockInThresholdMins = parseInt(formData.dailyClockInThresholdMins) || 0;
            dataToSave.commissionEarned = parseFloat(formData.commissionEarned) || 0;

            dataToSave.invoiceReminderDaysOffset = parseInt(formData.invoiceReminderDaysOffset) || 0;
            dataToSave.reviewRequestDaysOffset = parseInt(formData.reviewRequestDaysOffset) || 0;
            dataToSave.appointmentReminderDaysOffset = parseInt(formData.appointmentReminderDaysOffset) || 0;

            if (dataToSave.sendInvoiceEmail && patternedInvoiceTriggers.includes(dataToSave.invoiceEmailTrigger)) {
                dataToSave.invoicePatternStartDate = formData.invoicePatternStartDate ? new Date(formData.invoicePatternStartDate) : null;
                if (!dataToSave.invoicePatternStartDate) {
                    setError('For patterned invoicing, a start date is required.');
                    setSaving(false);
                    return;
                }
            } else {
                dataToSave.invoicePatternStartDate = null;
            }

            if (type === 'staff') {
                // Ensure to pass the email and phone arrays directly for staff too if backend expects it
                // If backend expects simple string for staff email/phone, you'd need to adapt here:
                // dataToSave.email = dataToSave.emails[0]?.email || '';
                // dataToSave.phone = dataToSave.phones[0]?.number || '';
                // Since your Lead/Customer models use arrays, assume Staff also uses them for consistency with AddContactModal's email/phone handling
                
                delete dataToSave.companyName;
                delete dataToSave.leadSource;
                delete dataToSave.leadStatus;
                delete dataToSave.commissionEarned;
                delete dataToSave.serviceAddresses;
                delete dataToSave.convertedFromLead;
                delete dataToSave.customerType;
                delete dataToSave.industry;
                delete dataToSave.salesPersonName;

                delete dataToSave.sendWelcomeEmail;
                delete dataToSave.sendInvoiceEmail;
                delete dataToSave.invoiceEmailTrigger;
                delete dataToSave.invoicePatternStartDate;
                delete dataToSave.sendInvoiceReminderEmail;
                delete dataToSave.invoiceReminderDaysOffset;
                delete dataToSave.sendReviewRequestEmail;
                delete dataToSave.reviewRequestDaysOffset;
                delete dataToSave.sendAppointmentReminderEmail;
                delete dataToSave.appointmentReminderDaysOffset;
                delete dataToSave.sendQuoteEmail;

                if (initialData) {
                    response = await api.put(`/staff/${initialData._id}`, dataToSave);
                    setSuccessMessage('Staff member updated successfully!');
                } else {
                    response = await api.post('/staff', dataToSave);
                    setSuccessMessage('Staff member added successfully!');
                }
            } else if (type === 'customer') {
                delete dataToSave.leadSource;
                delete dataToSave.leadStatus;
                delete dataToSave.convertedFromLead;
                delete dataToSave.role;
                delete dataToSave.employeeId;
                delete dataToSave.payRateType;
                delete dataToSave.hourlyRate;
                delete dataToSave.jobFixedAmount;
                delete dataToSave.jobPercentage;
                delete dataToSave.dailyClockInThresholdMins;
                
                dataToSave.serviceAddresses = formData.serviceAddresses.map(addr => ({
                    ...addr,
                    amount: parseFloat(addr.amount) || 0
                })).filter(addr => Object.values(addr).some(val => val && val.toString().trim() !== ''));

                if (initialData?._id && !initialData?.convertedFromLead) {
                    response = await api.put(`/customers/${initialData._id}`, dataToSave);
                    setSuccessMessage('Customer updated successfully!');
                } else {
                    response = await api.post('/customers', dataToSave);
                    setSuccessMessage('Customer added successfully!');
                }
            } else if (type === 'lead') {
                delete dataToSave.serviceAddresses;
                delete dataToSave.customerType;
                delete dataToSave.industry;
                delete dataToSave.role;
                delete dataToSave.employeeId;
                delete dataToSave.payRateType;
                delete dataToSave.hourlyRate;
                delete dataToSave.jobFixedAmount;
                delete dataToSave.jobPercentage;
                delete dataToSave.dailyClockInThresholdMins;
                delete dataToSave.sendWelcomeEmail;
                delete dataToSave.sendInvoiceEmail;
                delete dataToSave.invoiceEmailTrigger;
                delete dataToSave.invoicePatternStartDate;
                delete dataToSave.sendInvoiceReminderEmail;
                delete dataToSave.invoiceReminderDaysOffset;
                delete dataToSave.sendReviewRequestEmail;
                delete dataToSave.reviewRequestDaysOffset;
                delete dataToSave.sendAppointmentReminderEmail;
                delete dataToSave.appointmentReminderDaysOffset;
                delete dataToSave.sendQuoteEmail;

                if (initialData) {
                    response = await api.put(`/leads/${initialData._id}`, dataToSave);
                    setSuccessMessage('Lead updated successfully!');
                } else {
                    response = await api.post('/leads', dataToSave);
                    setSuccessMessage('Lead added successfully!');
                }
            }

            onContactAdded(response.data.contact || response.data.lead || response.data.customer || response.data.staff);
            
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err) {
            console.error(`Error saving ${type}:`, err.response?.data || err.message);
            setError(err.response?.data?.message || `Failed to save ${type}.`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidthClass="max-w-4xl">
            <div className="py-4 px-2 custom-scrollbar max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-2 space-y-6">
                    {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
                    {successMessage && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{successMessage}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Company Name (Not for Staff) */}
                        {type !== 'staff' && (
                            <ModernInput
                                label="Company Name (Optional)"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                            />
                        )}
                        {/* Contact Person Name */}
                        <ModernInput
                            label="Contact Person Name"
                            name="contactPersonName"
                            value={formData.contactPersonName}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Email Addresses Section */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center">
                            Email Addresses
                            <button type="button" onClick={addEmail} className="ml-auto px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center">
                                Add
                            </button>
                        </h3>
                        {formData.emails.length === 0 && <p className="text-gray-500 text-sm">No email addresses added yet.</p>}
                        {formData.emails.map((emailEntry, index) => (
                            <div key={index} className="relative p-3 border border-gray-200 rounded-lg bg-white shadow-sm grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] items-center gap-2">
                                <ModernInput
                                    label={index === 0 ? "Email (Master by default)" : "Email"}
                                    name="email"
                                    value={emailEntry.email}
                                    onChange={(e) => handleEmailChange(index, e)}
                                    type="email"
                                    required={emailEntry.isMaster || formData.emails.length === 1}
                                    placeholder="e.g., example@company.com"
                                    className="w-full"
                                />
                                <ModernInput
                                    label="Label"
                                    name="label"
                                    value={emailEntry.label}
                                    onChange={(e) => handleEmailChange(index, e)}
                                    placeholder="e.g., Work, Personal"
                                    className="w-full"
                                />
                                <div className="flex-shrink-0 flex items-center mt-auto">
                                    <input
                                        type="radio"
                                        name={`isMasterEmail-${type}`}
                                        checked={emailEntry.isMaster}
                                        onChange={(e) => handleEmailChange(index, { target: { name: 'isMaster', type: 'radio', checked: e.target.checked } })}
                                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <label className="ml-2 text-sm text-gray-700">Master</label>
                                </div>
                                {formData.emails.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeEmail(index)}
                                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                        title="Remove Email"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.927a2.25 2.25 0 01-2.244-2.077L4.74 5.79m14.232-.744l-1.39-1.39A.75.75 0 0016.732 3H7.268a.75.75 0 00-.53 1.28l-1.39 1.39M4.26 5.25a.75.75 0 000 1.5h.375a.75.75 0 000-1.5H4.26z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Phone Numbers Section */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center">
                            Phone Numbers
                            <button type="button" onClick={addPhone} className="ml-auto px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center">
                                Add
                            </button>
                        </h3>
                        {formData.phones.length === 0 && <p className="text-gray-500 text-sm">No phone numbers added yet.</p>}
                        {formData.phones.map((phoneEntry, index) => (
                            <div key={index} className="relative p-3 border border-gray-200 rounded-lg bg-white shadow-sm grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] items-center gap-2">
                                <ModernInput
                                    label={index === 0 ? "Number (Master by default)" : "Number"}
                                    name="number"
                                    value={phoneEntry.number}
                                    onChange={(e) => handlePhoneChange(index, e)}
                                    type="tel"
                                    required={phoneEntry.isMaster || formData.phones.length === 1}
                                    placeholder="e.g., +447912345678"
                                    className="w-full"
                                />
                                <ModernInput
                                    label="Label"
                                    name="label"
                                    value={phoneEntry.label}
                                    onChange={(e) => handlePhoneChange(index, e)}
                                    placeholder="e.g., Mobile, Office"
                                    className="w-full"
                                />
                                <div className="flex-shrink-0 flex items-center mt-auto">
                                    <input
                                        type="radio"
                                        name={`isMasterPhone-${type}`}
                                        checked={phoneEntry.isMaster}
                                        onChange={(e) => handlePhoneChange(index, { target: { name: 'isMaster', type: 'radio', checked: e.target.checked } })}
                                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <label className="ml-2 text-sm text-gray-700">Master</label>
                                </div>
                                {formData.phones.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removePhone(index)}
                                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                        title="Remove Phone"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.927a2.25 2.25 0 01-2.244-2.077L4.74 5.79m14.232-.744l-1.39-1.39A.75.75 0 0016.732 3H7.268a.75.75 0 00-.53 1.28l-1.39 1.39M4.26 5.25a.75.75 0 000 1.5h.375a.75.75 0 000-1.5H4.26z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Primary Address */}
                    <AddressInput
                        label="Primary Address"
                        address={formData.address}
                        onChange={handleAddressChange}
                        fieldName="address"
                        isMapsLoaded={isMapsLoaded}
                        isMapsLoadError={isMapsLoadError}
                    />

                    {/* Lead-specific fields */}
                    {type === 'lead' && (
                        <>
                            <ModernSelect
                                label="Lead Source"
                                name="leadSource"
                                value={formData.leadSource}
                                onChange={handleChange}
                                options={leadSourceOptions}
                                required
                            />
                            <ModernSelect
                                label="Lead Status"
                                name="leadStatus"
                                value={formData.leadStatus}
                                onChange={handleChange}
                                options={leadStatusOptions}
                                required
                            />
                            <ModernInput
                                label="Sales Person Name (Optional)"
                                name="salesPersonName"
                                value={formData.salesPersonName}
                                onChange={handleChange}
                            />
                            <ModernInput
                                label="Commission Earned (£)"
                                name="commissionEarned"
                                type="number"
                                value={formData.commissionEarned}
                                onChange={handleChange}
                                step="0.01"
                                min="0"
                            />
                        </>
                    )}

                    {/* Customer-specific fields */}
                    {type === 'customer' && (
                        <>
                            <ModernSelect
                                label="Customer Type"
                                name="customerType"
                                value={formData.customerType}
                                onChange={handleChange}
                                options={customerTypeOptions}
                                required
                            />
                            <ModernSelect
                                label="Industry"
                                name="industry"
                                value={formData.industry}
                                onChange={handleChange}
                                options={industryOptions}
                                required
                            />
                            <ModernInput
                                label="Sales Person Name (Optional)"
                                name="salesPersonName"
                                value={formData.salesPersonName}
                                onChange={handleChange}
                            />
                            <ModernInput
                                label="Commission Earned (£)"
                                name="commissionEarned"
                                type="number"
                                value={formData.commissionEarned}
                                onChange={handleChange}
                                step="0.01"
                                min="0"
                            />

                            {/* Service Addresses */}
                            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Service Addresses</h3>
                                {formData.serviceAddresses.length === 0 && (
                                    <p className="text-gray-500 text-sm mb-3">No service addresses added yet. Start by adding one:</p>
                                )}
                                <div className="flex space-x-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={copyMainAddressToServiceAddress}
                                        className="px-4 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center"
                                    >
                                        Copy Primary Address
                                    </button>
                                    <button
                                        type="button"
                                        onClick={addEmptyServiceAddress}
                                        className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
                                    >
                                        Add New <span className="ml-1 font-bold">+</span>
                                    </button>
                                </div>
                                {formData.serviceAddresses.map((serviceAddress, index) => (
                                    <div key={index} className="relative p-3 border border-gray-200 rounded-lg bg-white shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AddressInput
                                            label={`Service Address ${index + 1}`}
                                            address={serviceAddress}
                                            onChange={(newAddressObject) => handleServiceAddressChange(index, newAddressObject)}
                                            fieldName={`serviceAddress-${index}`}
                                            isMapsLoaded={isMapsLoaded}
                                            isMapsLoadError={isMapsLoadError}
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <ModernSelect
                                                label="Pay Type"
                                                name={`payType-${index}`}
                                                value={serviceAddress.payType || ''}
                                                onChange={(e) => handleServiceAddressChange(index, e.target.value, 'payType')}
                                                options={payTypeOptions}
                                                required
                                            />
                                            <ModernInput
                                                label="Amount (£)"
                                                name={`amount-${index}`}
                                                type="number"
                                                value={serviceAddress.amount || 0}
                                                onChange={(e) => handleServiceAddressChange(index, e.target.value, 'amount')}
                                                step="0.01"
                                                min="0"
                                                required
                                            />
                                        </div>
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                type="button"
                                                onClick={addEmptyServiceAddress}
                                                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                            >
                                                Add Another <span className="ml-1 font-bold">+</span>
                                            </button>
                                            {formData.serviceAddresses.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeServiceAddress(index)}
                                                    className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Customer Email Automation Settings */}
                            <div className="col-span-full space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                                <h3 className="text-lg font-bold text-blue-800 mb-3">Automated Email Preferences</h3>

                                {/* Send Welcome Email */}
                                <div className="flex items-center justify-between">
                                    <label className="text-gray-700 font-medium">Send Welcome Email:</label>
                                    <input
                                        type="checkbox"
                                        name="sendWelcomeEmail"
                                        checked={formData.sendWelcomeEmail}
                                        onChange={handleChange}
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                    />
                                </div>

                                {/* Send Invoice Email */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-gray-700 font-medium">Send Invoice Email:</label>
                                        <input
                                            type="checkbox"
                                            name="sendInvoiceEmail"
                                            checked={formData.sendInvoiceEmail}
                                            onChange={handleChange}
                                            className="form-checkbox h-5 w-5 text-blue-600"
                                        />
                                    </div>
                                    {formData.sendInvoiceEmail && (
                                        <>
                                        <ModernSelect
                                            label="Invoice Email Trigger"
                                            name="invoiceEmailTrigger"
                                            value={formData.invoiceEmailTrigger}
                                            onChange={handleChange}
                                            options={invoiceEmailTriggerOptions}
                                            required
                                            className="ml-6"
                                        />
                                        {patternedInvoiceTriggers.includes(formData.invoiceEmailTrigger) && (
                                            <ModernInput
                                                label="First Invoice Date (for pattern)"
                                                name="invoicePatternStartDate"
                                                type="date"
                                                value={formData.invoicePatternStartDate}
                                                onChange={handleChange}
                                                required
                                                className="ml-6"
                                            />
                                        )}
                                        </>
                                    )}
                                </div>

                                {/* Send Invoice Reminder Email */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-gray-700 font-medium">Send Invoice Reminder Email:</label>
                                        <input
                                            type="checkbox"
                                            name="sendInvoiceReminderEmail"
                                            checked={formData.sendInvoiceReminderEmail}
                                            onChange={handleChange}
                                            className="form-checkbox h-5 w-5 text-blue-600"
                                        />
                                    </div>
                                    {formData.sendInvoiceReminderEmail && (
                                        <ModernInput
                                            label="Reminder Days After Due Date"
                                            name="invoiceReminderDaysOffset"
                                            type="number"
                                            value={formData.invoiceReminderDaysOffset}
                                            onChange={handleChange}
                                            min="0"
                                            required
                                            placeholder="e.g., 7 days"
                                            className="ml-6"
                                        />
                                    )}
                                </div>

                                {/* Send Review Request Email */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-gray-700 font-medium">Send Review Request Email:</label>
                                        <input
                                            type="checkbox"
                                            name="sendReviewRequestEmail"
                                            checked={formData.sendReviewRequestEmail}
                                            onChange={handleChange}
                                            className="form-checkbox h-5 w-5 text-blue-600"
                                        />
                                    </div>
                                    {formData.sendReviewRequestEmail && (
                                        <ModernInput
                                            label="Review Days After Completion"
                                            name="reviewRequestDaysOffset"
                                            type="number"
                                            value={formData.reviewRequestDaysOffset}
                                            onChange={handleChange}
                                            min="0"
                                            required
                                            placeholder="e.g., 3 days"
                                            className="ml-6"
                                        />
                                    )}
                                </div>

                                {/* Send Appointment Reminder Email */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-gray-700 font-medium">Send Appointment Reminder Email:</label>
                                        <input
                                            type="checkbox"
                                            name="sendAppointmentReminderEmail"
                                            checked={formData.sendAppointmentReminderEmail}
                                            onChange={handleChange}
                                            className="form-checkbox h-5 w-5 text-blue-600"
                                        />
                                    </div>
                                    {formData.sendAppointmentReminderEmail && (
                                        <ModernInput
                                            label="Reminder Days Before Appointment"
                                            name="appointmentReminderDaysOffset"
                                            type="number"
                                            value={formData.appointmentReminderDaysOffset}
                                            onChange={handleChange}
                                            min="0"
                                            required
                                            placeholder="e.g., 1 day"
                                            className="ml-6"
                                        />
                                    )}
                                </div>

                                {/* Send Quote Email */}
                                <div className="flex items-center justify-between">
                                    <label className="text-gray-700 font-medium">Send Quote Email:</label>
                                    <input
                                        type="checkbox"
                                        name="sendQuoteEmail"
                                        checked={formData.sendQuoteEmail}
                                        onChange={handleChange}
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Staff-specific fields */}
                    {type === 'staff' && (
                        <>
                            <ModernSelect
                                label="Staff Role"
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                options={roleOptions}
                                required
                            />
                            <ModernInput
                                label="Employee ID (Optional)"
                                name="employeeId"
                                value={formData.employeeId}
                                onChange={handleChange}
                            />
                            {/* Payroll fields for Staff */}
                            <h3 className="text-lg font-bold text-gray-900 col-span-full mt-6 mb-2">Payroll Settings</h3>
                            
                            <ModernSelect
                                label="Pay Rate Type"
                                name="payRateType"
                                value={formData.payRateType}
                                onChange={handleChange}
                                options={staffPayRateTypeOptions}
                                required
                            />

                            {formData.payRateType === 'Hourly' && (
                                <ModernInput
                                    label="Hourly Rate (£)"
                                    name="hourlyRate"
                                    type="number"
                                    value={formData.hourlyRate}
                                    onChange={handleChange}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            )}

                            {formData.payRateType === 'Fixed per Job' && (
                                <ModernInput
                                    label="Fixed Amount per Job (£)"
                                    name="jobFixedAmount"
                                    type="number"
                                    value={formData.jobFixedAmount}
                                    onChange={handleChange}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            )}

                            {formData.payRateType === 'Percentage per Job' && (
                                <ModernInput
                                    label="Percentage per Job (%)"
                                    name="jobPercentage"
                                    type="number"
                                    value={formData.jobPercentage}
                                    onChange={handleChange}
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    required
                                />
                            )}

                            {formData.payRateType === 'Daily Rate' && (
                                <ModernInput
                                    label="Daily Clock-in Threshold (Mins)"
                                    name="dailyClockInThresholdMins"
                                    type="number"
                                    value={formData.dailyClockInThresholdMins}
                                    onChange={handleChange}
                                    min="0"
                                    required
                                    placeholder="e.g., 480 for 8 hours"
                                />
                            )}
                        </>
                    )}


                    <div className="flex justify-end space-x-2 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-3 mr-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200 text-lg font-medium shadow-sm" disabled={saving}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 text-lg font-medium shadow-md"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : (initialData ? `Update ${modalTitle.split(':')[0].trim()}` : `Add ${modalTitle.split(':')[0].trim()}`)}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default AddContactModal;