import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import AddressInput from '../common/AddressInput'; // Ensure AddressInput is imported
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

// Firebase Auth specific imports (ensure these are needed for change password/email sections)
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail } from 'firebase/auth';

// Helper imports
import { getCurrencySymbol } from '../../utils/helpers'; // Assuming this utility exists

const SettingsPage = () => {
    const { user, loading: authLoading, auth } = useAuth(); // `auth` is Firebase auth instance
    const { currency, loading: currencyLoading, error: currencyError, updateCurrency, formatCurrency } = useCurrency();

    const [settings, setSettings] = useState(null); // Stores the full fetched backend settings object
    const [loading, setLoading] = useState(true); // Manages loading state for the page's data fetch
    const [saving, setSaving] = useState(false); // Manages saving state for form submission
    const [error, setError] = useState(null); // Displays general page/fetch errors
    const [successMessage, setSuccessMessage] = useState(null); // Displays general success messages
    const [activeTab, setActiveTab] = useState('company'); // Manages which tab is active ('company', 'currency', 'my-account')


    // Define a consistent default empty address object
    const defaultAddress = { street: '', city: '', county: '', postcode: '', country: '' };

    // Local form state, mirroring CompanySetting and User properties
    const [localSettings, setLocalSettings] = useState({
        companyName: '', // From Company model
        companyLogoUrl: '', // From CompanySetting
        companyAddress: defaultAddress, // Initialize with a full default object
        companyPhone: '', // From CompanySetting
        companyEmail: '', // From CompanySetting
        companyWebsite: '', // From CompanySetting
        companyTaxId: '', // From CompanySetting

        // UI Styling Overrides
        backgroundColor: '#FFFFFF',
        primaryColor: '#3B82F6',
        borderColor: '#D1D5DB',
        labelColor: '#111827',
        inputButtonBorderRadius: '0.375rem',

        // Currency Settings
        defaultCurrencyCode: 'GBP',
        defaultCurrencySymbol: '£',
        defaultCurrencyDecimalPlaces: 2,
        defaultCurrencyThousandSeparator: ',',
        defaultCurrencyDecimalSeparator: '.',
        defaultCurrencyFormatTemplate: '{symbol}{amount}',
    });

    // Local state for user profile and password/email changes
    const [userProfile, setUserProfile] = useState({
        contactPersonName: '',
        email: '', // User's current email
        newEmail: '', // For email change form
        currentPassword: '', // For password/email change forms
        newPassword: '', // For password change form
        confirmNewPassword: '', // For password change form
    });

    const [logoFile, setLogoFile] = useState(null); // For new logo upload
    const [logoPreview, setLogoPreview] = useState(''); // For local logo preview


    // Options for currency selection dropdown
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

    // Helper to get default currency properties based on code (for `handleCurrencyChange`)
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


    // Effect to fetch initial settings and user profile data
    useEffect(() => {
        const fetchSettingsAndProfile = async () => {
            if (authLoading || !user) { // Wait for user to be loaded from AuthContext
                setLoading(true);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                // Fetch Company Settings
                const settingsRes = await api.get('/settings'); // GET /api/settings
                const fetchedSettings = settingsRes.data;

                // Fetch User Profile (from /auth/me)
                const userProfileRes = await api.get('/auth/me');
                const fetchedUserProfile = userProfileRes.data.user;

                setSettings(fetchedSettings); // Store full fetched settings

                // Populate localSettings state from fetched data
                setLocalSettings(prev => ({
                    ...prev,
                    companyName: fetchedSettings.company?.name || '', // Company name comes from populated company
                    companyLogoUrl: fetchedSettings.companyLogoUrl || '',
                    // Ensure address is always an object, even if fetchedSettings.address is null/undefined
                    companyAddress: fetchedSettings.address || defaultAddress,
                    companyPhone: fetchedSettings.phone || '',
                    companyEmail: fetchedSettings.email || '',
                    companyWebsite: fetchedSettings.website || '',
                    companyTaxId: fetchedSettings.taxId || '',
                    
                    backgroundColor: fetchedSettings.backgroundColor || '#FFFFFF',
                    primaryColor: fetchedSettings.primaryColor || '#3B82F6',
                    borderColor: fetchedSettings.borderColor || '#D1D5DB',
                    labelColor: fetchedSettings.labelColor || '#111827',
                    inputButtonBorderRadius: fetchedSettings.inputButtonBorderRadius || '0.375rem',

                    defaultCurrencyCode: fetchedSettings.defaultCurrency?.code || 'GBP',
                    defaultCurrencySymbol: fetchedSettings.defaultCurrency?.symbol || '£',
                    defaultCurrencyDecimalPlaces: fetchedSettings.defaultCurrency?.decimalPlaces || 2,
                    defaultCurrencyThousandSeparator: fetchedSettings.defaultCurrency?.thousandSeparator || ',',
                    defaultCurrencyDecimalSeparator: fetchedSettings.defaultCurrency?.decimalSeparator || '.',
                    defaultCurrencyFormatTemplate: fetchedSettings.defaultCurrency?.formatTemplate || '{symbol}{amount}',
                }));

                // Populate userProfile state from fetched data
                setUserProfile(prev => ({
                    ...prev,
                    contactPersonName: fetchedUserProfile.contactPersonName || '',
                    email: fetchedUserProfile.email || '',
                }));

                // If a logo URL exists, set it for preview
                if (fetchedSettings.companyLogoUrl) {
                    setLogoPreview(fetchedSettings.companyLogoUrl);
                }

            } catch (err) {
                console.error('Error fetching settings or profile:', err.response?.data || err.message);
                setError(err.response?.data?.message || 'Failed to load settings or profile data.');
            } finally {
                setLoading(false);
            }
        };

        fetchSettingsAndProfile();
    }, [user, authLoading]); // Re-run when user or authLoading changes


    // Handler for changes in company details or UI styling (flat fields in localSettings)
    const handleLocalSettingsChange = useCallback((e) => {
        const { name, value, type } = e.target;
        setLocalSettings(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value // Parse numbers
        }));
    }, []);

    // Handler for changes in company address (uses AddressInput's onChange callback)
    const handleCompanyAddressChange = useCallback((newAddressObject) => {
        setLocalSettings(prev => ({ ...prev, companyAddress: newAddressObject }));
    }, []);

    // Handler for logo file selection
    const handleLogoFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file)); // Create a local URL for preview
        }
    };

    // Handler for currency setting changes (updates local currencyPreferences state)
    const handleCurrencyChange = useCallback((e) => {
        const { name, value, type } = e.target;
        setLocalSettings(prev => {
            let newSettings = { ...prev };
            const parsedValue = type === 'number' ? parseInt(value, 10) : value; // Ensure integer for decimalPlaces

            if (name === 'defaultCurrencyCode') {
                const defaults = currencyDefaults[parsedValue] || currencyDefaults['GBP']; // Get symbol/format based on code
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
    }, [currencyDefaults]); // Dependency on memoized currencyDefaults

    // Handler for changes in user profile details
    const handleUserProfileChange = useCallback((e) => {
        const { name, value } = e.target;
        setUserProfile(prev => ({ ...prev, [name]: value }));
    }, []);


    // --- Form Submission Handlers ---

    // Handles saving Company Details and UI Styling Overrides
    const handleSaveCompanySettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        if (user?.role !== 'admin') {
            setError('You do not have permission to update company settings.');
            setSaving(false);
            return;
        }

        let uploadedLogoUrl = localSettings.companyLogoUrl; // Start with current URL

        // Upload new logo file if selected
        if (logoFile) {
            const formData = new FormData();
            formData.append('logo', logoFile);

            try {
                const uploadRes = await api.post('/uploads/upload-logo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }, // Important for file uploads
                });
                uploadedLogoUrl = uploadRes.data.logoUrl;
            } catch (err) {
                console.error('Error uploading logo:', err.response?.data || err.message);
                setError(err.response?.data?.message || 'Failed to upload logo.');
                setSaving(false);
                return;
            }
        }

        try {
            const payload = {
                // Properties that map directly to CompanySetting model
                companyLogoUrl: uploadedLogoUrl,
                defaultFormName: localSettings.defaultFormName,
                backgroundColor: localSettings.backgroundColor,
                primaryColor: localSettings.primaryColor,
                borderColor: localSettings.borderColor,
                labelColor: localSettings.labelColor,
                inputButtonBorderRadius: localSettings.inputButtonBorderRadius,
                
                // Nested defaultCurrency object
                defaultCurrency: {
                    code: localSettings.defaultCurrencyCode,
                    symbol: localSettings.defaultCurrencySymbol,
                    decimalPlaces: localSettings.defaultCurrencyDecimalPlaces,
                    thousandSeparator: localSettings.defaultCurrencyThousandSeparator,
                    decimalSeparator: localSettings.defaultCurrencyDecimalSeparator,
                    formatTemplate: localSettings.defaultCurrencyFormatTemplate,
                },

                // Properties that map to Company model (passed separately in payload)
                name: localSettings.companyName, // For Company.name
                address: localSettings.companyAddress, // For Company.address
                phone: localSettings.companyPhone, // For Company.phone
                email: localSettings.companyEmail, // For Company.email
                website: localSettings.companyWebsite, // For Company.website
                taxId: localSettings.companyTaxId, // For Company.taxId
            };

            // Send to backend (PUT /api/settings)
            const res = await api.put('/settings', payload);
            
            // Update local state and context after successful save
            setSettings(res.data.settings); // Update the main settings state from backend response
            setLocalSettings(prev => ({
                ...prev,
                companyLogoUrl: uploadedLogoUrl, // Ensure logo URL is updated
                companyName: res.data.settings.company.name, // Update company name from backend response
                // Update other company details from backend response if they were sent/changed
                companyAddress: res.data.settings.address || defaultAddress, // Ensure fallback here too
                companyPhone: res.data.settings.phone,
                companyEmail: res.data.settings.email,
                companyWebsite: res.data.settings.website,
                companyTaxId: res.data.settings.taxId,
            }));
            setSuccessMessage('Company Settings updated successfully!');
            setLogoFile(null); // Clear file input after successful upload

            // Update AuthContext's user data for company name if it changed
            if (user && user.setUserData) {
                user.setUserData(prev => ({ ...prev, company: { ...prev.company, name: res.data.settings.company.name } }));
            }
            // Update CurrencyContext with the new default currency
            updateCurrency(res.data.settings.defaultCurrency);

        } catch (err) {
            console.error('Error saving company settings:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'Failed to save company settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Handles saving user profile details
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Only update contactPersonName in this endpoint
            const res = await api.put('/auth/profile', { contactPersonName: userProfile.contactPersonName });
            setSuccessMessage('Profile updated successfully!');
            // Update AuthContext's user data
            if (user && user.setUserData) {
                user.setUserData(prev => ({ ...prev, contactPersonName: res.data.user.contactPersonName }));
            }
        } catch (err) {
            console.error('Error saving profile:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Handles changing user's password
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        const { currentPassword, newPassword, confirmNewPassword } = userProfile;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            setError('All password fields are required.');
            setSaving(false);
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setError('New password and confirm password do not match.');
            setSaving(false);
            return;
        }
        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters long.');
            setSaving(false);
            return;
        }

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setError('No authenticated user found. Please log in again.');
                setSaving(false);
                return;
            }

            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPassword);

            setSuccessMessage('Password changed successfully! You may need to log in again shortly.');
            setUserProfile(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmNewPassword: '' }));

        } catch (err) {
            console.error('Error changing password:', err);
            let errorMessage = 'Failed to change password. Please ensure your current password is correct.';
            if (err.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect current password.';
            } else if (err.code === 'auth/requires-recent-login') {
                errorMessage = 'Your session has expired. Please log out and log back in, then try changing your password again.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'New password is too weak. Please choose a stronger password.';
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection.';
            }
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    // Handles changing user's email address
    const handleChangeEmail = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        const { newEmail, currentPassword } = userProfile;

        if (!newEmail || !currentPassword) {
            setError('New email and current password are required.');
            setSaving(false);
            return;
        }
        if (newEmail === user.email) {
            setError('New email cannot be the same as the current email.');
            setSaving(false);
            return;
        }

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setError('No authenticated user found. Please log in again.');
                setSaving(false);
                return;
            }

            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);

            await updateEmail(currentUser, newEmail);

            setSuccessMessage(
                'Email change initiated! A verification email has been sent to your NEW email address (' +
                newEmail +
                '). Please click the link in that email to complete the change. ' +
                'You may need to log in again with your new email after verification.'
            );

            setUserProfile(prev => ({ ...prev, newEmail: '', currentPassword: '' }));

        } catch (err) {
            console.error('Error changing email:', err);
            let errorMessage = 'Failed to change email address.';
            if (err.code === 'auth/invalid-email') {
                errorMessage = 'The new email address is not valid.';
            } else if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'This email address is already in use by another account.';
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect current password provided for email change.';
            } else if (err.code === 'auth/requires-recent-login') {
                errorMessage = 'Your session has expired. Please log out and log back in, then try changing your email again.';
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (err.code === 'auth/operation-not-allowed') {
                errorMessage = 'Email change operation not allowed. This could be due to a temporary issue or specific Firebase project settings. Please try again or contact support.';
            }
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };


    if (loading || authLoading || currencyLoading) { // Combined loading states
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
                <Loader />
            </div>
        );
    }

    const canAccessCompanyCurrencySettings = user?.role === 'admin'; // Only admin can modify

    const displayError = error || currencyError; // Prioritize local errors, then currency context errors

    return (
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Company Settings</h1>

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
                        disabled={!canAccessCompanyCurrencySettings} // Disable if not admin
                    >
                        Company Details
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('currency')}
                        className={`${activeTab === 'currency' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        disabled={!canAccessCompanyCurrencySettings} // Disable if not admin
                    >
                        Currency Preferences
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('my-account')}
                        className={`${activeTab === 'my-account' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        My Account
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'company' && (
                <form onSubmit={handleSaveCompanySettings} className="space-y-6">
                    {/* Company Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernInput
                            label="Company Name"
                            name="companyName"
                            value={localSettings.companyName}
                            onChange={handleLocalSettingsChange}
                            required
                        />

                        {/* Company Logo Upload Section */}
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                            <div className="mt-1 flex items-center">
                                {(logoPreview || localSettings.companyLogoUrl) ? (
                                    <img src={logoPreview || localSettings.companyLogoUrl} alt="Company Logo" className="h-20 w-20 object-contain rounded-full border border-gray-200 p-1 mr-4" />
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
                                    Change
                                </label>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">Upload a logo (max 5MB, PNG, JPG, GIF)</p>
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-800 md:col-span-2 mt-4">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernInput
                            label="Company Phone"
                            name="companyPhone"
                            value={localSettings.companyPhone}
                            onChange={handleLocalSettingsChange}
                            type="tel"
                        />
                        <ModernInput
                            label="Company Email"
                            name="companyEmail"
                            value={localSettings.companyEmail}
                            onChange={handleLocalSettingsChange}
                            type="email"
                        />
                        <div className="md:col-span-2">
                            <ModernInput
                                label="Company Website"
                                name="companyWebsite"
                                value={localSettings.companyWebsite}
                                onChange={handleLocalSettingsChange}
                                type="url"
                                placeholder="https://yourcompany.com"
                            />
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-800 mt-4">Address Details</h3>
                    <AddressInput
                        label="Company Address"
                        address={localSettings.companyAddress} // This is where the undefined 'street' is coming from
                        onChange={handleCompanyAddressChange}
                        fieldName="companyAddress"
                        // isMapsLoaded={isMapsLoaded} // Should be passed from AppContent
                        // isMapsLoadError={isMapsLoadError} // Should be passed from AppContent
                    />

                    <ModernInput
                        label="Tax / Business ID (e.g., VAT Number)"
                        name="companyTaxId"
                        value={localSettings.companyTaxId}
                        onChange={handleLocalSettingsChange}
                        placeholder="e.g., GB123456789"
                    />

                    <div className="flex justify-end mt-6">
                        <button
                            type="submit"
                            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}

            {activeTab === 'currency' && (
                <form onSubmit={handleSaveCompanySettings} className="p-6 border rounded-lg bg-gray-50/80 space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Currency Preferences</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ModernSelect
                            label="Currency Code"
                            name="defaultCurrencyCode"
                            value={localSettings.defaultCurrencyCode}
                            onChange={handleCurrencyChange}
                            options={currencyOptions}
                            helpText="The 3-letter ISO code for your primary currency (e.g., GBP, USD)."
                            disabled={currencyLoading}
                        />
                        <ModernInput
                            label="Currency Symbol"
                            name="defaultCurrencySymbol"
                            value={localSettings.defaultCurrencySymbol}
                            onChange={handleCurrencyChange}
                            placeholder="e.g., £, $, €"
                            required
                            helpText="The symbol to display before/after amounts."
                        />
                        <ModernInput
                            label="Decimal Places"
                            name="defaultCurrencyDecimalPlaces"
                            type="number"
                            value={localSettings.defaultCurrencyDecimalPlaces}
                            onChange={handleCurrencyChange}
                            required
                            min="0"
                            max="4"
                            helpText="Number of digits after the decimal point (e.g., 2 for 1.99)."
                        />
                        <ModernInput
                            label="Thousand Separator"
                            name="defaultCurrencyThousandSeparator"
                            value={localSettings.defaultCurrencyThousandSeparator}
                            onChange={handleCurrencyChange}
                            placeholder="e.g., ',' or '.'"
                            helpText="Character used to separate thousands (e.g., 1,000)."
                        />
                        <ModernInput
                            label="Decimal Separator"
                            name="defaultCurrencyDecimalSeparator"
                            value={localSettings.defaultCurrencyDecimalSeparator}
                            onChange={handleCurrencyChange}
                            placeholder="e.g., '.' or ','"
                            required
                            helpText="Character used to separate whole numbers from fractions (e.g., 1.99)."
                        />
                        <ModernInput
                            label="Format Template"
                            name="defaultCurrencyFormatTemplate"
                            value={localSettings.defaultCurrencyFormatTemplate}
                            onChange={handleCurrencyChange}
                            placeholder="{symbol}{amount}"
                            required
                            helpText="Use {symbol} for currency symbol, {amount} for number, {code} for currency code. E.g., {symbol}{amount} or {amount} {code}"
                        />
                        <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                            <strong>Preview:</strong> {formatCurrency(1234.56)} {/* Uses formatCurrency from context */}
                        </div>
                    </div>
                    <div className="flex justify-end mt-6">
                        <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-lg transition-colors duration-200" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}

            {activeTab === 'my-account' && (
                <div className="space-y-8">
                    <form onSubmit={handleSaveProfile} className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">My Profile Details</h3>
                        <ModernInput
                            label="Name"
                            name="contactPersonName"
                            value={userProfile.contactPersonName}
                            onChange={handleUserProfileChange}
                            required
                        />
                        <ModernInput
                            label="Email"
                            name="email"
                            value={userProfile.email}
                            onChange={handleUserProfileChange}
                            disabled
                            readOnly={true}
                            helpText="Your email address (managed by login provider)."
                        />
                        <div className="text-right">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold"
                                disabled={saving}
                            >
                                {saving ? 'Updating...' : 'Update Profile'}
                            </button>
                        </div>
                    </form>

                    <form onSubmit={handleChangePassword} className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Change Email Address</h3>
                        <ModernInput
                            label="New Email Address"
                            name="newEmail"
                            type="email"
                            value={userProfile.newEmail}
                            onChange={handleUserProfileChange}
                            required
                            placeholder="Enter your new email"
                            autoComplete="off"
                        />
                        <ModernInput
                            label="Current Password (to confirm change)"
                            name="currentPassword"
                            type="password"
                            value={userProfile.currentPassword}
                            onChange={handleUserProfileChange}
                            required
                            placeholder="Enter your current password"
                            autoComplete="off"
                        />
                        <div className="text-right">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold"
                                disabled={saving}
                            >
                                {saving ? 'Changing Email...' : 'Change Email'}
                            </button>
                        </div>
                    </form>

                    <form onSubmit={handleChangePassword} className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Change Password</h3>
                        <ModernInput
                            label="Current Password"
                            name="currentPassword"
                            type="password"
                            value={userProfile.currentPassword}
                            onChange={handleUserProfileChange}
                            required
                            autoComplete="off"
                        />
                        <ModernInput
                            label="New Password"
                            name="newPassword"
                            type="password"
                            value={userProfile.newPassword}
                            onChange={handleUserProfileChange}
                            required
                            helpText="Minimum 6 characters."
                            autoComplete="new-password"
                        />
                        <ModernInput
                            label="Confirm New Password"
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
                                {saving ? 'Changing...' : 'Change Password'}
                            </button>
                        </div>
                    </form>

                    <div className="p-6 border border-gray-200 rounded-lg shadow-sm space-y-4 bg-gray-50">
                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Two-Factor Authentication (2FA)</h3>
                        <p className="text-gray-700">
                            Enhance your account security with 2FA. This feature requires you to enter a code from your phone in addition to your password when logging in.
                        </p>
                        <p className="text-sm text-gray-500">
                            (Full 2FA setup and management functionality will be available in a future update.)
                        </p>
                        <button
                            type="button"
                            className="px-6 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
                            disabled
                        >
                            Enable 2FA (Coming Soon)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;