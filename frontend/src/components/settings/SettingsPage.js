import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import AddressInput from '../common/AddressInput';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail } from 'firebase/auth';
import { getCurrencySymbol } from '../../utils/helpers';

// Define default address outside the component to ensure its reference is stable
const INITIAL_DEFAULT_ADDRESS = { street: '', city: '', county: '', postcode: '', country: '' };

const SettingsPage = () => {
    const { t, i18n } = useTranslation();
    const { user, loading: authLoading, auth } = useAuth();
    const { currency, loading: currencyLoading, error: currencyError, updateCurrency, formatCurrency } = useCurrency();

    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('company');

    const [localSettings, setLocalSettings] = useState({
        companyName: '',
        companyLogoUrl: '',
        companyAddress: INITIAL_DEFAULT_ADDRESS,
        companyPhone: '',
        companyEmail: '',
        companyWebsite: '',
        companyTaxId: '',
        defaultFormName: '',

        backgroundColor: '#FFFFFF',
        primaryColor: '#3B82F6',
        borderColor: '#D1D5DB',
        labelColor: '#111827',
        inputButtonBorderRadius: '0.375rem',

        defaultCurrencyCode: 'GBP',
        defaultCurrencySymbol: '£',
        defaultCurrencyDecimalPlaces: 2,
        defaultCurrencyThousandSeparator: ',',
        defaultCurrencyDecimalSeparator: '.',
        defaultCurrencyFormatTemplate: '{symbol}{amount}',

        invoicePrefix: 'INV-',
        nextInvoiceSeqNumber: 1,
        defaultTaxRate: 0,

        emailAutomation: {
            welcome_email: { enabled: true },
            appointment_reminder: { enabled: true, daysBefore: 1 },
            job_completion: { enabled: true },
            invoice_email: { enabled: true },
            invoice_reminder: { enabled: true, daysAfter: 7 },
            review_request: { enabled: true, daysAfter: 3 },
        },
    });

    const [userProfile, setUserProfile] = useState({
        contactPersonName: '',
        email: '',
        newEmail: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    });

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');

    const currencyOptions = [
        { value: 'GBP', label: 'GBP - British Pound (£)' },
        { value: 'USD', label: 'USD - US Dollar ($)' },
        { value: 'EUR', label: 'EUR - Euro (€)' },
        { value: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
        { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
        { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
        { value: 'CNY', label: 'CNY - Chinese Yuan (CNY)' },
        { value: 'INR', label: 'INR - Indian Rupee (INR)' },
    ];

    const currencyDefaults = useMemo(() => ({
        'GBP': { symbol: '£', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' },
        'USD': { symbol: '$', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' },
        'EUR': { symbol: '€', decimalPlaces: 2, thousandSeparator: '.', decimalSeparator: ',', formatTemplate: '{amount} {symbol}' },
        'CAD': { symbol: 'C$', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' },
        'AUD': { symbol: 'A$', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' },
        'JPY': { symbol: '¥', decimalPlaces: 0, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' },
        'CNY': { symbol: '¥', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' },
        'INR': { symbol: '₹', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' },
    }), []);


    useEffect(() => {
        const fetchSettingsAndProfile = async () => {
            if (authLoading || !user) {
                setLoading(true);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const settingsRes = await api.get('/settings');
                const fetchedSettings = settingsRes.data;

                const userProfileRes = await api.get('/auth/me');
                const fetchedUserProfile = userProfileRes.data.user;

                setSettings(fetchedSettings);

                setLocalSettings(prev => ({
                    ...prev,
                    companyName: fetchedSettings.settings?.company?.name || '',
                    companyLogoUrl: fetchedSettings.settings?.companyLogoUrl || '',
                    defaultFormName: fetchedSettings.settings?.defaultFormName || '',
                    companyAddress: fetchedSettings.settings?.company?.settings?.address || INITIAL_DEFAULT_ADDRESS,
                    companyPhone: fetchedSettings.settings?.company?.settings?.phone || '',
                    companyEmail: fetchedSettings.settings?.company?.settings?.email || '',
                    companyWebsite: fetchedSettings.settings?.company?.settings?.website || '',
                    companyTaxId: fetchedSettings.settings?.company?.settings?.taxId || '',

                    backgroundColor: fetchedSettings.settings?.backgroundColor || '#FFFFFF',
                    primaryColor: fetchedSettings.settings?.primaryColor || '#3B82F6',
                    borderColor: fetchedSettings.settings?.borderColor || '#D1D5DB',
                    labelColor: fetchedSettings.settings?.labelColor || '#111827',
                    inputButtonBorderRadius: fetchedSettings.settings?.inputButtonBorderRadius || '0.375rem',

                    defaultCurrencyCode: fetchedSettings.settings?.defaultCurrency?.code || 'GBP',
                    defaultCurrencySymbol: fetchedSettings.settings?.defaultCurrency?.symbol || '£',
                    defaultCurrencyDecimalPlaces: fetchedSettings.settings?.defaultCurrency?.decimalPlaces || 2,
                    defaultCurrencyThousandSeparator: fetchedSettings.settings?.defaultCurrency?.thousandSeparator || ',',
                    defaultCurrencyDecimalSeparator: fetchedSettings.settings?.defaultCurrency?.decimalSeparator || '.',
                    defaultCurrencyFormatTemplate: fetchedSettings.settings?.defaultCurrency?.formatTemplate || '{symbol}{amount}',

                    invoicePrefix: fetchedSettings.settings?.invoiceSettings?.invoicePrefix || 'INV-',
                    nextInvoiceSeqNumber: fetchedSettings.settings?.invoiceSettings?.nextInvoiceSeqNumber || 1,
                    defaultTaxRate: fetchedSettings.settings?.invoiceSettings?.defaultTaxRate || 0,

                    emailAutomation: {
                        welcome_email: { enabled: fetchedSettings.settings?.emailAutomation?.welcome_email?.enabled ?? true },
                        appointment_reminder: { 
                            enabled: fetchedSettings.settings?.emailAutomation?.appointment_reminder?.enabled ?? true,
                            daysBefore: fetchedSettings.settings?.emailAutomation?.appointment_reminder?.daysBefore ?? 1
                        },
                        job_completion: { enabled: fetchedSettings.settings?.emailAutomation?.job_completion?.enabled ?? true },
                        invoice_email: { enabled: fetchedSettings.settings?.emailAutomation?.invoice_email?.enabled ?? true },
                        invoice_reminder: { 
                            enabled: fetchedSettings.settings?.emailAutomation?.invoice_reminder?.enabled ?? true,
                            daysAfter: fetchedSettings.settings?.emailAutomation?.invoice_reminder?.daysAfter ?? 7
                        },
                        review_request: { 
                            enabled: fetchedSettings.settings?.emailAutomation?.review_request?.enabled ?? true,
                            daysAfter: fetchedSettings.settings?.emailAutomation?.review_request?.daysAfter ?? 3
                        },
                    },
                }));

                setUserProfile(prev => ({
                    ...prev,
                    contactPersonName: fetchedUserProfile.contactPersonName || '',
                    email: fetchedUserProfile.email || '',
                }));

                if (fetchedSettings.settings?.companyLogoUrl) {
                    setLogoPreview(fetchedSettings.settings.companyLogoUrl);
                }

            } catch (err) {
                console.error('Error fetching settings or profile:', err.response?.data || err.message);
                setError(err.response?.data?.message || t('settingsPage.failedToLoadSettings'));
            } finally {
                setLoading(false);
            }
        };

        fetchSettingsAndProfile();
    }, [user, authLoading, t]);

    const handleLocalSettingsChange = useCallback((e) => {
        const { name, value, type } = e.target;
        setLocalSettings(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    }, []);

    const handleCompanyAddressChange = useCallback((newAddressObject) => {
        setLocalSettings(prev => ({ ...prev, companyAddress: newAddressObject }));
    }, []);

    const handleLogoFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleCurrencyChange = useCallback((e) => {
        const { name, value, type } = e.target;
        setLocalSettings(prev => {
            let newSettings = { ...prev };
            const parsedValue = type === 'number' ? parseInt(value, 10) : value;

            if (name === 'defaultCurrencyCode') {
                const defaults = currencyDefaults[parsedValue] || currencyDefaults['GBP'];
                newSettings.defaultCurrencyCode = parsedValue;
                newSettings.defaultCurrencySymbol = defaults.symbol;
                newSettings.defaultCurrencyDecimalPlaces = defaults.decimalPlaces;
                newSettings.defaultCurrencyThousandSeparator = defaults.thousandSeparator;
                newSettings.defaultCurrencyDecimalSeparator = defaults.decimalSeparator;
                newSettings.defaultCurrencyFormatTemplate = defaults.formatTemplate;
            } else {
                newSettings[name] = parsedValue;
            }
            return newSettings;
        });
    }, [currencyDefaults]);

    const handleInvoiceSettingsChange = useCallback((e) => {
        const { name, value, type } = e.target;
        setLocalSettings(prev => ({
            ...prev,
            [name]: type === 'number' && name === 'defaultTaxRate' ? parseFloat(value) : 
                            type === 'number' ? parseFloat(value) : value
        }));
    }, []);
    
    const handleEmailAutomationChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        const [category, field] = name.split('.'); 

        setLocalSettings(prev => ({
            ...prev,
            emailAutomation: {
                ...prev.emailAutomation,
                [category]: {
                    ...prev.emailAutomation[category],
                    [field]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value),
                },
            },
        }));
    }, []);

    const handleUserProfileChange = useCallback((e) => {
        const { name, value } = e.target;
        setUserProfile(prev => ({ ...prev, [name]: value }));
    }, []);


    const handleSaveCompanySettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        if (user?.role !== 'admin') {
            setError(t('settingsPage.permissionError'));
            setSaving(false);
            return;
        }

        let uploadedLogoUrl = localSettings.companyLogoUrl;

        if (logoFile) {
            const formData = new FormData();
            formData.append('logo', logoFile);

            try {
                const uploadRes = await api.post('/uploads/upload-logo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                uploadedLogoUrl = uploadRes.data.logoUrl;
            } catch (err) {
                console.error('Error uploading logo:', err.response?.data || err.message);
                setError(err.response?.data?.message || t('settingsPage.failedToUploadLogo'));
                setSaving(false);
                return;
            }
        }

        try {
            const payload = {
                companyLogoUrl: uploadedLogoUrl,
                defaultFormName: localSettings.defaultFormName,
                backgroundColor: localSettings.backgroundColor,
                primaryColor: localSettings.primaryColor,
                borderColor: localSettings.borderColor,
                labelColor: localSettings.labelColor,
                inputButtonBorderRadius: localSettings.inputButtonBorderRadius,
                
                defaultCurrency: {
                    code: localSettings.defaultCurrencyCode,
                    symbol: localSettings.defaultCurrencySymbol,
                    decimalPlaces: localSettings.defaultCurrencyDecimalPlaces,
                    thousandSeparator: localSettings.defaultCurrencyThousandSeparator,
                    decimalSeparator: localSettings.defaultCurrencyDecimalSeparator,
                    formatTemplate: localSettings.defaultCurrencyFormatTemplate,
                },

                invoiceSettings: {
                    invoicePrefix: localSettings.invoicePrefix,
                    nextInvoiceSeqNumber: localSettings.nextInvoiceSeqNumber,
                    defaultTaxRate: localSettings.defaultTaxRate,
                },

                emailAutomation: localSettings.emailAutomation,

                name: localSettings.companyName,
                address: localSettings.companyAddress,
                phone: localSettings.companyPhone,
                email: localSettings.companyEmail,
                website: localSettings.companyWebsite,
                taxId: localSettings.companyTaxId,
            };

            const res = await api.put('/settings', payload);
            
            setSettings(res.data.settings);

            setLocalSettings(prev => ({
                ...prev,
                companyLogoUrl: uploadedLogoUrl,
                companyName: res.data.settings.company?.name || '',
                companyAddress: res.data.settings.company?.settings?.address || INITIAL_DEFAULT_ADDRESS,
                companyPhone: res.data.settings.company?.settings?.phone || '',
                companyEmail: res.data.settings.company?.settings?.email || '',
                companyWebsite: res.data.settings.company?.settings?.website || '',
                companyTaxId: res.data.settings.company?.settings?.taxId || '',
                
                invoicePrefix: res.data.settings.invoiceSettings?.invoicePrefix || 'INV-',
                nextInvoiceSeqNumber: res.data.settings.invoiceSettings?.nextInvoiceSeqNumber || 1,
                defaultTaxRate: res.data.settings.invoiceSettings?.defaultTaxRate || 0,

                emailAutomation: {
                    welcome_email: { enabled: res.data.settings.emailAutomation?.welcome_email?.enabled ?? true },
                    appointment_reminder: { 
                        enabled: res.data.settings.emailAutomation?.appointment_reminder?.enabled ?? true,
                        daysBefore: res.data.settings.emailAutomation?.appointment_reminder?.daysBefore ?? 1
                    },
                    job_completion: { enabled: res.data.settings.emailAutomation?.job_completion?.enabled ?? true },
                    invoice_email: { enabled: res.data.settings.emailAutomation?.invoice_email?.enabled ?? true },
                    invoice_reminder: { 
                        enabled: res.data.settings.emailAutomation?.invoice_reminder?.enabled ?? true,
                        daysAfter: res.data.settings.emailAutomation?.invoice_reminder?.daysAfter ?? 7
                    },
                    review_request: { 
                        enabled: res.data.settings.emailAutomation?.review_request?.enabled ?? true,
                        daysAfter: res.data.settings.emailAutomation?.review_request?.daysAfter ?? 3
                    },
                },
            }));
            setSuccessMessage(t('settingsPage.companySettingsUpdated'));
            setLogoFile(null);

            if (user && user.setUserData) {
                user.setUserData(prev => ({ ...prev, company: { ...prev.company, name: res.data.settings.company?.name } }));
            }
            updateCurrency(res.data.settings.defaultCurrency);

        } catch (err) {
            console.error('Error saving company settings:', err.response?.data || err.message);
            setError(err.response?.data?.message || t('settingsPage.failedToSaveCompanySettings'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await api.put('/auth/profile', { contactPersonName: userProfile.contactPersonName });
            setSuccessMessage(t('settingsPage.profileUpdated'));
            if (user && user.setUserData) {
                user.setUserData(prev => ({ ...prev, contactPersonName: res.data.user.contactPersonName }));
            }
        } catch (err) {
            console.error('Error saving profile:', err.response?.data || err.message);
            setError(err.response?.data?.message || t('settingsPage.failedToSaveProfile'));
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        const { currentPassword, newPassword, confirmNewPassword } = userProfile;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            setError(t('settingsPage.allPasswordFieldsRequired'));
            setSaving(false);
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setError(t('settingsPage.passwordsMismatch'));
            setSaving(false);
            return;
        }
        if (newPassword.length < 6) {
            setError(t('settingsPage.passwordMinLength'));
            setSaving(false);
            return;
        }

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setError(t('settingsPage.noAuthenticatedUser'));
                setSaving(false);
                return;
            }

            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPassword);

            setSuccessMessage(t('settingsPage.passwordChangeSuccess'));
            setUserProfile(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmNewPassword: '' }));

        } catch (err) {
            console.error('Error changing password:', err);
            let errorMessage = t('settingsPage.failedToChangePassword');
            if (err.code === 'auth/wrong-password') {
                errorMessage = t('settingsPage.incorrectCurrentPassword');
            } else if (err.code === 'auth/requires-recent-login') {
                errorMessage = t('settingsPage.sessionExpired');
            } else if (err.code === 'auth/weak-password') {
                errorMessage = t('settingsPage.weakPassword');
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = t('settingsPage.networkError');
            } else if (err.code === 'auth/operation-not-allowed') {
                errorMessage = t('settingsPage.operationNotAllowed');
            }
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleChangeEmail = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        const { newEmail, currentPassword } = userProfile;

        if (!newEmail || !currentPassword) {
            setError(t('settingsPage.newEmailPasswordRequired'));
            setSaving(false);
            return;
        }
        if (newEmail === user.email) {
            setError(t('settingsPage.emailSameAsCurrent'));
            setSaving(false);
            return;
        }

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setError(t('settingsPage.noAuthenticatedUser'));
                setSaving(false);
                return;
            }

            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);

            await updateEmail(currentUser, newEmail);

            setSuccessMessage(
                t('settingsPage.emailChangeVerificationSent', { newEmail: newEmail })
            );

            setUserProfile(prev => ({ ...prev, newEmail: '', currentPassword: '' }));

        } catch (err) {
            console.error('Error changing email:', err);
            let errorMessage = t('settingsPage.failedToChangeEmail');
            if (err.code === 'auth/invalid-email') {
                errorMessage = t('settingsPage.invalidNewEmail');
            } else if (err.code === 'auth/email-already-in-use') {
                errorMessage = t('settingsPage.emailAlreadyInUse');
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = t('settingsPage.incorrectCurrentPasswordForEmail');
            } else if (err.code === 'auth/requires-recent-login') {
                errorMessage = t('settingsPage.sessionExpired');
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = t('settingsPage.networkError');
            } else if (err.code === 'auth/operation-not-allowed') {
                errorMessage = t('settingsPage.operationNotAllowed');
            }
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };


    if (loading || authLoading || currencyLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
                <Loader />
            </div>
        );
    }

    const canAccessCompanyCurrencySettings = user?.role === 'admin';

    const displayError = error || currencyError;

    return (
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-4xl mx-auto">
            {/* Translated Page Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">{t('settingsPage.companySettingsTitle')}</h1>

            {displayError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {displayError}
                </div>
            )}
            {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {successMessage}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('company')}
                        className={`${activeTab === 'company' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        disabled={!canAccessCompanyCurrencySettings}
                    >
                        {t('settingsPage.companyDetailsTab')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('currency')}
                        className={`${activeTab === 'currency' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        disabled={!canAccessCompanyCurrencySettings}
                    >
                        {t('settingsPage.currencyPreferencesTab')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('my-account')}
                        className={`${activeTab === 'my-account' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        {t('settingsPage.myAccountTab')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('language')}
                        className={`${activeTab === 'language' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        {t('settingsPage.languageTab')}
                    </button>
                </nav>
            </div>

            {/* Tab Content: Company Details */}
            {activeTab === 'company' && (
                <form onSubmit={handleSaveCompanySettings} className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{t('settingsPage.companyProfileSection')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernInput
                            label={t('settingsPage.companyNameLabel')}
                            name="companyName"
                            value={localSettings.companyName}
                            onChange={handleLocalSettingsChange}
                            required
                        />

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.companyLogoLabel')}</label>
                            <div className="mt-1 flex items-center">
                                {(logoPreview || localSettings.companyLogoUrl) ? (
                                    <img src={logoPreview || localSettings.companyLogoUrl} alt={t('settingsPage.companyLogoAlt')} className="h-20 w-20 object-contain rounded-full border border-gray-200 p-1 mr-4" />
                                ) : (
                                    <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-gray-100">
                                        <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </span>
                                )}
                                <input
                                    id="logo-upload"
                                    name="logo"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoFileChange}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="logo-upload"
                                    className="ml-5 bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    {t('settingsPage.changeButton')}
                                </label>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">{t('settingsPage.logoUploadHelpText')}</p>
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.contactInformationSection')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernInput
                            label={t('settingsPage.companyPhoneLabel')}
                            name="companyPhone"
                            value={localSettings.companyPhone}
                            onChange={handleLocalSettingsChange}
                            type="tel"
                        />
                        <ModernInput
                            label={t('settingsPage.companyEmailLabel')}
                            name="companyEmail"
                            value={localSettings.companyEmail}
                            onChange={handleLocalSettingsChange}
                            type="email"
                        />
                        <div className="md:col-span-2">
                            <ModernInput
                                label={t('settingsPage.companyWebsiteLabel')}
                                name="companyWebsite"
                                value={localSettings.companyWebsite}
                                onChange={handleLocalSettingsChange}
                                type="url"
                                placeholder={t('settingsPage.companyWebsitePlaceholder')}
                            />
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.addressDetailsSection')}</h3>
                    <AddressInput
                        label={t('settingsPage.companyAddressLabel')}
                        address={localSettings.companyAddress}
                        onChange={handleCompanyAddressChange}
                        fieldName="companyAddress"
                    />

                    <ModernInput
                        label={t('settingsPage.taxIdLabel')}
                        name="companyTaxId"
                        value={localSettings.companyTaxId}
                        onChange={handleLocalSettingsChange}
                        placeholder={t('settingsPage.taxIdPlaceholder')}
                    />

                    {/* NEW: Invoice Settings Section */}
                    <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.invoiceSettingsSection')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernInput
                            label={t('settingsPage.invoicePrefixLabel')}
                            name="invoicePrefix"
                            value={localSettings.invoicePrefix}
                            onChange={handleInvoiceSettingsChange}
                            helpText={t('settingsPage.invoicePrefixHelpText')}
                        />
                        <ModernInput
                            label={t('settingsPage.nextInvoiceNumberLabel')}
                            name="nextInvoiceSeqNumber"
                            value={localSettings.nextInvoiceSeqNumber}
                            onChange={handleInvoiceSettingsChange}
                            type="number"
                            min="1"
                            helpText={t('settingsPage.nextInvoiceNumberHelpText')}
                        />
                        <ModernInput
                            label={t('settingsPage.defaultTaxRateLabel')}
                            name="defaultTaxRate"
                            value={localSettings.defaultTaxRate * 100}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                handleInvoiceSettingsChange({ target: { name: 'defaultTaxRate', value: value / 100 } });
                            }}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            helpText={t('settingsPage.defaultTaxRateHelpText')}
                        />
                    </div>

                    {/* NEW: Email Automation Settings Section */}
                    <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.emailAutomationSection')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Welcome Email */}
                        <div className="col-span-1 flex items-center">
                            <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="welcome_email.enabled"
                                    checked={localSettings.emailAutomation.welcome_email.enabled}
                                    onChange={handleEmailAutomationChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span>{t('settingsPage.enableWelcomeEmail')}</span>
                            </label>
                            <p className="ml-4 text-sm text-gray-500">{t('settingsPage.welcomeEmailHelpText')}</p>
                        </div>

                        {/* Invoice Email */}
                        <div className="col-span-1 flex items-center">
                            <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="invoice_email.enabled"
                                    checked={localSettings.emailAutomation.invoice_email.enabled}
                                    onChange={handleEmailAutomationChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span>{t('settingsPage.enableInvoiceEmails')}</span>
                            </label>
                            <p className="ml-4 text-sm text-gray-500">{t('settingsPage.invoiceEmailHelpText')}</p>
                        </div>

                        {/* Appointment Reminder */}
                        <div className="col-span-1 flex flex-col">
                            <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="appointment_reminder.enabled"
                                    checked={localSettings.emailAutomation.appointment_reminder.enabled}
                                    onChange={handleEmailAutomationChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span>{t('settingsPage.enableAppointmentReminders')}</span>
                            </label>
                            {localSettings.emailAutomation.appointment_reminder.enabled && (
                                <ModernInput
                                    label={t('settingsPage.daysBeforeAppointmentLabel')}
                                    name="appointment_reminder.daysBefore"
                                    type="number"
                                    value={localSettings.emailAutomation.appointment_reminder.daysBefore}
                                    onChange={handleEmailAutomationChange}
                                    min="0"
                                    className="mt-2"
                                    helpText={t('settingsPage.daysBeforeAppointmentHelpText')}
                                />
                            )}
                        </div>

                        {/* Job Completion */}
                        <div className="col-span-1 flex items-center">
                            <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="job_completion.enabled"
                                    checked={localSettings.emailAutomation.job_completion.enabled}
                                    onChange={handleEmailAutomationChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span>{t('settingsPage.enableJobCompletionEmails')}</span>
                            </label>
                            <p className="ml-4 text-sm text-gray-500">{t('settingsPage.jobCompletionEmailHelpText')}</p>
                        </div>

                        {/* Invoice Reminder */}
                        <div className="col-span-1 flex flex-col">
                            <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="invoice_reminder.enabled"
                                    checked={localSettings.emailAutomation.invoice_reminder.enabled}
                                    onChange={handleEmailAutomationChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span>{t('settingsPage.enableInvoiceReminders')}</span>
                            </label>
                            {localSettings.emailAutomation.invoice_reminder.enabled && (
                                <ModernInput
                                    label={t('settingsPage.daysAfterDueDateLabel')}
                                    name="invoice_reminder.daysAfter"
                                    type="number"
                                    value={localSettings.emailAutomation.invoice_reminder.daysAfter}
                                    onChange={handleEmailAutomationChange}
                                    min="0"
                                    required
                                    placeholder={t('settingsPage.daysAfterDueDatePlaceholder')}
                                    className="mt-2"
                                    helpText={t('settingsPage.daysAfterDueDateHelpText')}
                                />
                            )}
                        </div>

                        {/* Review Request */}
                        <div className="col-span-1 flex flex-col">
                            <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="review_request.enabled"
                                    checked={localSettings.emailAutomation.review_request.enabled}
                                    onChange={handleEmailAutomationChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span>{t('settingsPage.enableReviewRequests')}</span>
                            </label>
                            {localSettings.emailAutomation.review_request.enabled && (
                                <ModernInput
                                    label={t('settingsPage.daysAfterJobCompletionLabel')}
                                    name="review_request.daysAfter"
                                    type="number"
                                    value={localSettings.emailAutomation.review_request.daysAfter}
                                    onChange={handleEmailAutomationChange}
                                    min="0"
                                    required
                                    placeholder={t('settingsPage.daysAfterJobCompletionPlaceholder')}
                                    className="mt-2"
                                    helpText={t('settingsPage.daysAfterJobCompletionHelpText')}
                                />
                            )}
                        </div>
                    </div>


                    <div className="flex justify-end mt-6">
                        <button
                            type="submit"
                            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={saving}
                        >
                            {saving ? t('common.saving') : t('common.saveChanges')}
                        </button>
                    </div>
                </form>
            )}

            {/* Tab Content: Currency Preferences */}
            {activeTab === 'currency' && (
                <form onSubmit={handleSaveCompanySettings} className="p-6 border rounded-lg bg-gray-50/80 space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('settingsPage.currencyPreferencesSection')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernSelect
                            label={t('settingsPage.currencyCodeLabel')}
                            name="defaultCurrencyCode"
                            value={localSettings.defaultCurrencyCode}
                            onChange={handleCurrencyChange}
                            options={currencyOptions}
                            helpText={t('settingsPage.currencyCodeHelpText')}
                            disabled={currencyLoading}
                        />
                        <ModernInput
                            label={t('settingsPage.currencySymbolLabel')}
                            name="defaultCurrencySymbol"
                            value={localSettings.defaultCurrencySymbol}
                            onChange={handleCurrencyChange}
                            placeholder={t('settingsPage.currencySymbolPlaceholder')}
                            required
                            helpText={t('settingsPage.currencySymbolHelpText')}
                        />
                        <ModernInput
                            label={t('settingsPage.decimalPlacesLabel')}
                            name="defaultCurrencyDecimalPlaces"
                            type="number"
                            value={localSettings.defaultCurrencyDecimalPlaces}
                            onChange={handleCurrencyChange}
                            required
                            min="0"
                            max="4"
                            helpText={t('settingsPage.decimalPlacesHelpText')}
                        />
                        <ModernInput
                            label={t('settingsPage.thousandSeparatorLabel')}
                            name="defaultCurrencyThousandSeparator"
                            value={localSettings.defaultCurrencyThousandSeparator}
                            onChange={handleCurrencyChange}
                            placeholder={t('settingsPage.thousandSeparatorPlaceholder')}
                            helpText={t('settingsPage.thousandSeparatorHelpText')}
                        />
                        <ModernInput
                            label={t('settingsPage.decimalSeparatorLabel')}
                            name="defaultCurrencyDecimalSeparator"
                            value={localSettings.defaultCurrencyDecimalSeparator}
                            onChange={handleCurrencyChange}
                            placeholder={t('settingsPage.decimalSeparatorPlaceholder')}
                            required
                            helpText={t('settingsPage.decimalSeparatorHelpText')}
                        />
                        <ModernInput
                            label={t('settingsPage.formatTemplateLabel')}
                            name="defaultCurrencyFormatTemplate"
                            value={localSettings.defaultCurrencyFormatTemplate}
                            onChange={handleCurrencyChange}
                            placeholder={t('settingsPage.formatTemplatePlaceholder')}
                            required
                            helpText={t('settingsPage.formatTemplateHelpText')}
                        />
                        <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                            <strong>{t('settingsPage.previewLabel')}:</strong> {formatCurrency(1234.56)}
                        </div>
                    </div>
                    <div className="flex justify-end mt-6">
                        <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-lg transition-colors duration-200" disabled={saving}>
                            {saving ? t('common.saving') : t('common.saveChanges')}
                        </button>
                    </div>
                </form>
            )}

            {/* Tab Content: My Account */}
            {activeTab === 'my-account' && (
                <div className="space-y-8">
                    <form onSubmit={handleSaveProfile} className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{t('settingsPage.myProfileDetailsSection')}</h3>
                        <ModernInput
                            label={t('settingsPage.nameLabel')}
                            name="contactPersonName"
                            value={userProfile.contactPersonName}
                            onChange={handleUserProfileChange}
                            required
                        />
                        <ModernInput
                            label={t('settingsPage.emailLabel')}
                            name="email"
                            value={userProfile.email}
                            onChange={handleUserProfileChange}
                            disabled
                            readOnly={true}
                            helpText={t('settingsPage.emailHelpText')}
                        />
                        <div className="text-right">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold"
                                disabled={saving}
                            >
                                {saving ? t('common.updating') : t('settingsPage.updateProfileButton')}
                            </button>
                        </div>
                    </form>

                    <form onSubmit={handleChangeEmail} className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{t('settingsPage.changeEmailAddressSection')}</h3>
                        <ModernInput
                            label={t('settingsPage.newEmailAddressLabel')}
                            name="newEmail"
                            type="email"
                            value={userProfile.newEmail}
                            onChange={handleUserProfileChange}
                            required
                            placeholder={t('settingsPage.newEmailAddressPlaceholder')}
                            autoComplete="off"
                        />
                        <ModernInput
                            label={t('settingsPage.currentPasswordLabel')}
                            name="currentPassword"
                            type="password"
                            value={userProfile.currentPassword}
                            onChange={handleUserProfileChange}
                            required
                            placeholder={t('settingsPage.currentPasswordPlaceholder')}
                            autoComplete="off"
                        />
                        <div className="text-right">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold"
                                disabled={saving}
                            >
                                {saving ? t('common.changingEmail') : t('settingsPage.changeEmailButton')}
                            </button>
                        </div>
                    </form>

                    <form onSubmit={handleChangePassword} className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{t('settingsPage.changePasswordSection')}</h3>
                        <ModernInput
                            label={t('settingsPage.currentPasswordLabel')}
                            name="currentPassword"
                            type="password"
                            value={userProfile.currentPassword}
                            onChange={handleUserProfileChange}
                            required
                            autoComplete="off"
                        />
                        <ModernInput
                            label={t('settingsPage.newPasswordLabel')}
                            name="newPassword"
                            type="password"
                            value={userProfile.newPassword}
                            onChange={handleUserProfileChange}
                            required
                            helpText={t('settingsPage.passwordMinLengthHelpText')}
                            autoComplete="new-password"
                        />
                        <ModernInput
                            label={t('settingsPage.confirmNewPasswordLabel')}
                            name="confirmNewPassword"
                            type="password"
                            value={userProfile.confirmNewPassword}
                            onChange={handleUserProfileChange}
                            required
                            autoComplete="new-password"
                        />
                        <div className="text-right">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-semibold"
                                disabled={saving}
                            >
                                {saving ? t('common.changing') : t('settingsPage.changePasswordButton')}
                            </button>
                        </div>
                    </form>

                    <div className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4 bg-gray-50">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{t('settingsPage.twoFactorAuthSection')}</h3>
                        <p className="text-gray-700">
                            {t('settingsPage.twoFactorAuthDescription')}
                        </p>
                        <p className="text-sm text-gray-500">
                            {t('settingsPage.twoFactorAuthComingSoon')}
                        </p>
                        <button
                            type="button"
                            className="px-6 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
                            disabled
                        >
                            {t('settingsPage.enableTwoFactorAuthButton')}
                        </button>
                    </div>
                </div>
            )}

            {/* NEW TAB CONTENT: Language Preferences */}
            {activeTab === 'language' && (
                <div className="p-6 border rounded-lg bg-gray-50/80 space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('settingsPage.languagePreferencesSection')}</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <ModernSelect
                            label={t('settingsPage.selectLanguageLabel')}
                            name="languageSelector"
                            value={i18n.language}
                            onChange={(e) => i18n.changeLanguage(e.target.value)}
                            options={[
                                { value: 'en', label: t('languages.en') }, // <--- UPDATED: Use t() for label
                                { value: 'fr', label: t('languages.fr') }, // <--- UPDATED: Use t() for label
                                { value: 'fil', label: t('languages.fil') }, // <--- ADDED: Filipino option
                            ]}
                            helpText={t('settingsPage.languageChangeHelpText')}
                        />
                    </div>
                    <div className="text-sm text-gray-600">
                        <p>{t('settingsPage.currentLanguageMessage', { lang: t(`languages.${i18n.language}`) || i18n.language })}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;