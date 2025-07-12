// --- Import useRef ---
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import AddressInput from '../common/AddressInput';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail } from 'firebase/auth';

const INITIAL_DEFAULT_ADDRESS = { street: '', city: '', county: '', postcode: '', country: '' };

const SettingsPage = () => {
    const { t, i18n } = useTranslation();
    const { user, loading: authLoading, auth } = useAuth();
    const { currency, loading: currencyLoading, error: currencyError, updateCurrency, formatCurrency } = useCurrency();
    const navigate = useNavigate();
    const location = useLocation();

    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [activeTab, setActiveTab] = useState(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('success') || queryParams.get('error') || queryParams.get('code')) {
            return 'payments';
        }
        return 'company';
    });

    // --- SOLUTION: Use a ref instead of state for the effect flag ---
    const hasFinalized = useRef(false);

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
        formatTemplate: '{symbol}{amount}',
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
        stripeAccountId: '',
        stripeDetailsSubmitted: false,
    });

    const [userProfile, setUserProfile] = useState({
        contactPersonName: '', email: '', newEmail: '', currentPassword: '', newPassword: '', confirmNewPassword: '',
    });

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');

    const currencyOptions = useMemo(() => [
        { value: 'GBP', label: 'GBP - British Pound (£)' }, { value: 'USD', label: 'USD - US Dollar ($)' },
        { value: 'EUR', label: 'EUR - Euro (€)' }, { value: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
        { value: 'AUD', label: 'AUD - Australian Dollar (A$)' }, { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
        { value: 'CNY', label: 'CNY - Chinese Yuan (CNY)' }, { value: 'INR', label: 'INR - Indian Rupee (INR)' },
    ], []);

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

    const fetchSettingsAndProfile = useCallback(async () => {
        if (authLoading || !user) {
            setLoading(true);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const settingsRes = await api.get('/settings');
            const fetchedSettings = settingsRes.data.settings;

            const userProfileRes = await api.get('/auth/me');
            const fetchedUserProfile = userProfileRes.data.user;

            setSettings(fetchedSettings);

            setLocalSettings(prev => ({
                ...prev,
                companyName: fetchedSettings.company?.name || '',
                companyLogoUrl: fetchedSettings.companyLogoUrl || '',
                defaultFormName: fetchedSettings.defaultFormName || '',
                companyAddress: fetchedSettings.company?.settings?.address || INITIAL_DEFAULT_ADDRESS,
                companyPhone: fetchedSettings.company?.settings?.phone || '',
                companyEmail: fetchedSettings.company?.settings?.email || '',
                companyWebsite: fetchedSettings.company?.settings?.website || '',
                companyTaxId: fetchedSettings.company?.settings?.taxId || '',
                backgroundColor: fetchedSettings.backgroundColor || '#FFFFFF',
                primaryColor: fetchedSettings.primaryColor || '#3B82F6',
                borderColor: fetchedSettings.borderColor || '#D1D5DB',
                labelColor: fetchedSettings.labelColor || '#111827',
                inputButtonBorderRadius: fetchedSettings.inputButtonBorderRadius || '0.375rem',
                defaultCurrencyCode: fetchedSettings.defaultCurrency?.code || 'GBP',
                defaultCurrencySymbol: fetchedSettings.defaultCurrency?.symbol || '£',
                defaultCurrencyDecimalPlaces: fetchedSettings.defaultCurrency?.decimalPlaces ?? 2,
                defaultCurrencyThousandSeparator: fetchedSettings.defaultCurrency?.thousandSeparator || ',',
                defaultCurrencyDecimalSeparator: fetchedSettings.defaultCurrency?.decimalSeparator || '.',
                formatTemplate: fetchedSettings.defaultCurrency?.formatTemplate || '{symbol}{amount}',
                invoicePrefix: fetchedSettings.invoiceSettings?.invoicePrefix || 'INV-',
                nextInvoiceSeqNumber: fetchedSettings.invoiceSettings?.nextInvoiceSeqNumber || 1,
                defaultTaxRate: fetchedSettings.invoiceSettings?.defaultTaxRate || 0,
                emailAutomation: {
                    welcome_email: { enabled: fetchedSettings.emailAutomation?.welcome_email?.enabled ?? true },
                    appointment_reminder: { enabled: fetchedSettings.emailAutomation?.appointment_reminder?.enabled ?? true, daysBefore: fetchedSettings.emailAutomation?.appointment_reminder?.daysBefore ?? 1 },
                    job_completion: { enabled: fetchedSettings.emailAutomation?.job_completion?.enabled ?? true },
                    invoice_email: { enabled: fetchedSettings.emailAutomation?.invoice_email?.enabled ?? true },
                    invoice_reminder: { enabled: fetchedSettings.emailAutomation?.invoice_reminder?.enabled ?? true, daysAfter: fetchedSettings.emailAutomation?.invoice_reminder?.daysAfter ?? 7 },
                    review_request: { enabled: fetchedSettings.emailAutomation?.review_request?.enabled ?? true, daysAfter: fetchedSettings.emailAutomation?.review_request?.daysAfter ?? 3 },
                },
                stripeAccountId: fetchedSettings.company?.stripeAccountId || '',
                stripeDetailsSubmitted: fetchedSettings.company?.stripeDetailsSubmitted || false,
            }));

            setUserProfile(prev => ({
                ...prev,
                contactPersonName: fetchedUserProfile.contactPersonName || '',
                email: fetchedUserProfile.email || '',
            }));

            if (fetchedSettings.companyLogoUrl) {
                setLogoPreview(fetchedSettings.companyLogoUrl);
            }

        } catch (err) {
            console.error('Error fetching settings or profile:', err.response?.data || err.message);
            setError(err.response?.data?.message || t('settingsPage.failedToLoadSettings'));
        } finally {
            setLoading(false);
        }
    }, [user, authLoading, t]);

    // --- SOLUTION: Updated useEffect logic to use the ref ---
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const code = queryParams.get('code');
        const state = queryParams.get('state');

        // Check for the code AND that our persistent ref flag is false
        if (code && state && !hasFinalized.current) {
            // Immediately set the flag to true. This is synchronous and will prevent
            // the second run of the effect from getting past this 'if' statement.
            hasFinalized.current = true;
            
            setActiveTab('payments');
            setError(null);
            setSuccessMessage('Finalizing Stripe connection, please wait...');
            
            api.post('/stripe/connect/finalize', { code, state })
                .then(async () => {
                    setError(null);
                    setSuccessMessage('✅ Stripe account connected successfully!');
                    await fetchSettingsAndProfile();
                })
                .catch(err => {
                    setSuccessMessage(null);
                    setError(err.response?.data?.message || 'Failed to connect Stripe account.');
                })
                .finally(() => {
                    navigate('/settings', { replace: true });
                });
        } else if (!code && !state) {
            // Only fetch settings if it's a normal page load.
            fetchSettingsAndProfile();
        }
    }, [location.search, navigate, fetchSettingsAndProfile]);


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
                newSettings.formatTemplate = defaults.formatTemplate;
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
            [name]: type === 'number' ? parseFloat(value) : value
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
                    formatTemplate: localSettings.formatTemplate,
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

            setSuccessMessage(t('settingsPage.companySettingsUpdated'));
            setLogoFile(null);
            updateCurrency(res.data.settings.defaultCurrency);
            await fetchSettingsAndProfile();

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
            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updateEmail(currentUser, newEmail);

            setSuccessMessage(t('settingsPage.emailChangeVerificationSent', { newEmail: newEmail }));
            setUserProfile(prev => ({ ...prev, newEmail: '', currentPassword: '' }));

        } catch (err) {
            console.error('Error changing email:', err);
            let errorMessage = t('settingsPage.failedToChangeEmail');
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = t('settingsPage.emailAlreadyInUse');
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = t('settingsPage.incorrectCurrentPasswordForEmail');
            }
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleConnectStripe = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await api.get('/stripe/connect/oauth-url');
            if (res.data.connectUrl) {
                window.location.href = res.data.connectUrl;
            } else {
                setError(t('settingsPage.stripe.onboardingLinkError'));
            }
        } catch (err) {
            console.error('Error creating Stripe onboarding link:', err.response?.data || err.message);
            setError(err.response?.data?.message || t('settingsPage.stripe.onboardingLinkError'));
        } finally {
            setSaving(false);
        }
    };

    const handleGoToStripeDashboard = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await api.get('/stripe/connect/dashboard-link');
            if (res.data.url) {
                window.open(res.data.url, '_blank');
            } else {
                setError(t('settingsPage.stripe.dashboardLinkError'));
            }
        } catch (err) {
            console.error('Error creating Stripe dashboard link:', err.response?.data || err.message);
            setError(err.response?.data?.message || t('settingsPage.stripe.dashboardLinkError'));
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnectStripe = async () => {
        if (!window.confirm(t('settingsPage.stripe.disconnectConfirm'))) return;
        setSaving(true);
        setError(null);
        try {
            await api.put('/settings', { stripeAccountId: '' });
            setLocalSettings(prev => ({
                ...prev,
                stripeAccountId: '',
                stripeDetailsSubmitted: false,
            }));
            setSuccessMessage(t('settingsPage.stripe.disconnectSuccess'));
        } catch (err) {
            console.error('Error disconnecting Stripe:', err.response?.data || err.message);
            setError(err.response?.data?.message || t('settingsPage.stripe.disconnectError'));
        } finally {
            setSaving(false);
        }
    };

    if (loading || authLoading || currencyLoading) {
        return (<div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><Loader /></div>);
    }

    const canAccessCompanyCurrencySettings = user?.role === 'admin';
    const displayError = error || currencyError;
    const isStripeConnected = !!localSettings.stripeAccountId;
    const isStripeDetailsNeeded = isStripeConnected && !localSettings.stripeDetailsSubmitted;


    return (
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">{t('settingsPage.companySettingsTitle')}</h1>

            {displayError && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{displayError}</div>)}
            {successMessage && (<div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{successMessage}</div>)}

            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button type="button" onClick={() => setActiveTab('company')} className={`${activeTab === 'company' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`} disabled={!canAccessCompanyCurrencySettings}>
                        {t('settingsPage.companyDetailsTab')}
                    </button>
                    <button type="button" onClick={() => setActiveTab('payments')} className={`${activeTab === 'payments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`} disabled={!canAccessCompanyCurrencySettings}>
                        {t('settingsPage.paymentsTab')}
                    </button>
                    <button type="button" onClick={() => setActiveTab('currency')} className={`${activeTab === 'currency' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`} disabled={!canAccessCompanyCurrencySettings}>
                        {t('settingsPage.currencyPreferencesTab')}
                    </button>
                    <button type="button" onClick={() => setActiveTab('my-account')} className={`${activeTab === 'my-account' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        {t('settingsPage.myAccountTab')}
                    </button>
                    <button type="button" onClick={() => setActiveTab('language')} className={`${activeTab === 'language' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        {t('settingsPage.languageTab')}
                    </button>
                </nav>
            </div>

            {activeTab === 'company' && (<form onSubmit={handleSaveCompanySettings} className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{t('settingsPage.companyProfileSection')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModernInput label={t('settingsPage.companyNameLabel')} name="companyName" value={localSettings.companyName} onChange={handleLocalSettingsChange} required />
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settingsPage.companyLogoLabel')}</label>
                        <div className="mt-1 flex items-center">
                            {(logoPreview || localSettings.companyLogoUrl) ? (<img src={logoPreview || localSettings.companyLogoUrl} alt={t('settingsPage.companyLogoAlt')} className="h-20 w-20 object-contain rounded-full border border-gray-200 p-1 mr-4" />) : (<span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-gray-100"><svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg></span>)}
                            <input id="logo-upload" name="logo" type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
                            <label htmlFor="logo-upload" className="ml-5 bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">{t('settingsPage.changeButton')}</label>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{t('settingsPage.logoUploadHelpText')}</p>
                    </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.contactInformationSection')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModernInput label={t('settingsPage.companyPhoneLabel')} name="companyPhone" value={localSettings.companyPhone} onChange={handleLocalSettingsChange} type="tel" />
                    <ModernInput label={t('settingsPage.companyEmailLabel')} name="companyEmail" value={localSettings.companyEmail} onChange={handleLocalSettingsChange} type="email" />
                    <div className="md:col-span-2"><ModernInput label={t('settingsPage.companyWebsiteLabel')} name="companyWebsite" value={localSettings.companyWebsite} onChange={handleLocalSettingsChange} type="url" placeholder={t('settingsPage.companyWebsitePlaceholder')} /></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.addressDetailsSection')}</h3>
                <AddressInput label={t('settingsPage.companyAddressLabel')} address={localSettings.companyAddress} onChange={handleCompanyAddressChange} fieldName="companyAddress" />
                <ModernInput label={t('settingsPage.taxIdLabel')} name="companyTaxId" value={localSettings.companyTaxId} onChange={handleLocalSettingsChange} placeholder={t('settingsPage.taxIdPlaceholder')} />
                <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.invoiceSettingsSection')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModernInput label={t('settingsPage.invoicePrefixLabel')} name="invoicePrefix" value={localSettings.invoicePrefix} onChange={handleInvoiceSettingsChange} helpText={t('settingsPage.invoicePrefixHelpText')} />
                    <ModernInput label={t('settingsPage.nextInvoiceNumberLabel')} name="nextInvoiceSeqNumber" value={localSettings.nextInvoiceSeqNumber} onChange={handleInvoiceSettingsChange} type="number" min="1" helpText={t('settingsPage.nextInvoiceNumberHelpText')} />
                    <ModernInput label={t('settingsPage.defaultTaxRateLabel')} name="defaultTaxRate" value={localSettings.defaultTaxRate * 100} onChange={(e) => { const value = parseFloat(e.target.value) || 0; handleInvoiceSettingsChange({ target: { name: 'defaultTaxRate', value: value / 100, type: 'number' } }); }} type="number" min="0" max="100" step="0.01" helpText={t('settingsPage.defaultTaxRateHelpText')} />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mt-4 border-b pb-3 mb-4">{t('settingsPage.emailAutomationSection')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 flex items-center"><label className="flex items-center space-x-2 text-gray-700 cursor-pointer"><input type="checkbox" name="welcome_email.enabled" checked={localSettings.emailAutomation.welcome_email.enabled} onChange={handleEmailAutomationChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /><span>{t('settingsPage.enableWelcomeEmail')}</span></label><p className="ml-4 text-sm text-gray-500">{t('settingsPage.welcomeEmailHelpText')}</p></div>
                    <div className="col-span-1 flex items-center"><label className="flex items-center space-x-2 text-gray-700 cursor-pointer"><input type="checkbox" name="invoice_email.enabled" checked={localSettings.emailAutomation.invoice_email.enabled} onChange={handleEmailAutomationChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /><span>{t('settingsPage.enableInvoiceEmails')}</span></label><p className="ml-4 text-sm text-gray-500">{t('settingsPage.invoiceEmailHelpText')}</p></div>
                    <div className="col-span-1 flex flex-col"><label className="flex items-center space-x-2 text-gray-700 cursor-pointer"><input type="checkbox" name="appointment_reminder.enabled" checked={localSettings.emailAutomation.appointment_reminder.enabled} onChange={handleEmailAutomationChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /><span>{t('settingsPage.enableAppointmentReminders')}</span></label>{localSettings.emailAutomation.appointment_reminder.enabled && (<ModernInput label={t('settingsPage.daysBeforeAppointmentLabel')} name="appointment_reminder.daysBefore" type="number" value={localSettings.emailAutomation.appointment_reminder.daysBefore} onChange={handleEmailAutomationChange} min="0" className="mt-2" helpText={t('settingsPage.daysBeforeAppointmentHelpText')} />)}</div>
                    <div className="col-span-1 flex items-center"><label className="flex items-center space-x-2 text-gray-700 cursor-pointer"><input type="checkbox" name="job_completion.enabled" checked={localSettings.emailAutomation.job_completion.enabled} onChange={handleEmailAutomationChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /><span>{t('settingsPage.enableJobCompletionEmails')}</span></label><p className="ml-4 text-sm text-gray-500">{t('settingsPage.jobCompletionEmailHelpText')}</p></div>
                    <div className="col-span-1 flex flex-col"><label className="flex items-center space-x-2 text-gray-700 cursor-pointer"><input type="checkbox" name="invoice_reminder.enabled" checked={localSettings.emailAutomation.invoice_reminder.enabled} onChange={handleEmailAutomationChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /><span>{t('settingsPage.enableInvoiceReminders')}</span></label>{localSettings.emailAutomation.invoice_reminder.enabled && (<ModernInput label={t('settingsPage.daysAfterDueDateLabel')} name="invoice_reminder.daysAfter" type="number" value={localSettings.emailAutomation.invoice_reminder.daysAfter} onChange={handleEmailAutomationChange} min="0" required placeholder={t('settingsPage.daysAfterDueDatePlaceholder')} className="mt-2" helpText={t('settingsPage.daysAfterDueDateHelpText')} />)}</div>
                    <div className="col-span-1 flex flex-col"><label className="flex items-center space-x-2 text-gray-700 cursor-pointer"><input type="checkbox" name="review_request.enabled" checked={localSettings.emailAutomation.review_request.enabled} onChange={handleEmailAutomationChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /><span>{t('settingsPage.enableReviewRequests')}</span></label>{localSettings.emailAutomation.review_request.enabled && (<ModernInput label={t('settingsPage.daysAfterJobCompletionLabel')} name="review_request.daysAfter" type="number" value={localSettings.emailAutomation.review_request.daysAfter} onChange={handleEmailAutomationChange} min="0" required placeholder={t('settingsPage.daysAfterJobCompletionPlaceholder')} className="mt-2" helpText={t('settingsPage.sixMonthsFromCompletionHelpText')} />)}</div>
                </div>
                <div className="flex justify-end mt-6"><button type="submit" className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving}>{saving ? t('common.saving') : t('common.saveChanges')}</button></div>
            </form>
            )}

            {activeTab === 'payments' && (
                <div className="p-6 border rounded-lg bg-gray-50/80 space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('settingsPage.stripe.title')}</h3>
                    {!isStripeConnected ? (
                        <div className="text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            <h4 className="mt-2 text-lg font-medium text-gray-900">{t('settingsPage.stripe.connectTitle')}</h4>
                            <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">{t('settingsPage.stripe.connectDescription')}</p>
                            <div className="mt-6"><button type="button" onClick={handleConnectStripe} disabled={saving} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{saving ? t('common.redirecting') : t('settingsPage.stripe.connectButton')}</button></div>
                        </div>
                    ) : (
                        <div>
                            <div className="p-4 bg-green-100 border-l-4 border-green-500 text-green-700"><p className="font-bold">{t('settingsPage.stripe.connectedStatus')}</p><p>{t('settingsPage.stripe.connectedAccountId', { accountId: localSettings.stripeAccountId })}</p></div>
                            {isStripeDetailsNeeded && (
                                <div className="mt-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700"><p className="font-bold">{t('settingsPage.stripe.actionRequiredTitle')}</p><p>{t('settingsPage.stripe.actionRequiredDescription')}</p><div className="mt-4"><button type="button" onClick={handleGoToStripeDashboard} disabled={saving} className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 font-semibold">{t('settingsPage.stripe.completeOnboardingButton')}</button></div></div>
                            )}
                            <div className="mt-6 space-y-3">
                                <p className="text-sm text-gray-500">{t('settingsPage.stripe.platformFeeNote')}</p>
                                <div className="flex flex-wrap gap-4">
                                    <button type="button" onClick={handleGoToStripeDashboard} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold">{saving ? t('common.loading') : t('settingsPage.stripe.dashboardButton')}</button>
                                    <button type="button" onClick={handleDisconnectStripe} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-semibold">{saving ? t('common.disconnecting') : t('settingsPage.stripe.disconnectButton')}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'currency' && (
                <form onSubmit={handleSaveCompanySettings} className="p-6 border rounded-lg bg-gray-50/80 space-y-6">{/* ... currency form ... */}</form>
            )}

            {activeTab === 'my-account' && (
                <div className="space-y-8">{/* ... my account form ... */}</div>
            )}

            {activeTab === 'language' && (
                <div className="p-6 border rounded-lg bg-gray-50/80 space-y-6">{/* ... language form ... */}</div>
            )}
        </div>
    );
};

export default SettingsPage;