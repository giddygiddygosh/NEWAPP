// src/components/context/CurrencyContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [currency, setCurrency] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCurrencySettings = async () => {
            // Only fetch if authentication is not loading AND user is present (and has a company)
            // If user is null or doesn't have a company, set a fallback currency immediately.
            if (authLoading) {
                setLoading(true);
                return;
            }

            if (!user || !user.company?._id) { // User is not authenticated OR user has no associated company
                console.warn("[CurrencyContext] User not fully authenticated or missing company ID. Using fallback currency.");
                setCurrency({ code: 'GBP', symbol: '£', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' });
                setLoading(false);
                setError(null); // Clear any previous error
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const res = await api.get('/settings'); // Fetch from /api/settings
                if (res.data && res.data.defaultCurrency && typeof res.data.defaultCurrency === 'object') {
                    setCurrency(res.data.defaultCurrency);
                } else {
                    setCurrency({ code: 'GBP', symbol: '£', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' });
                }
            } catch (err) {
                console.error("Failed to fetch currency settings:", err);
                setError(err.response?.data?.message || "Failed to load currency settings.");
                setCurrency({ code: 'GBP', symbol: '£', decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.', formatTemplate: '{symbol}{amount}' });
            } finally {
                setLoading(false);
            }
        };

        fetchCurrencySettings();
    }, [user, authLoading]); // Re-fetch when user or authLoading state changes

    const updateCurrency = async (newCurrencyData) => {
        if (!user || user.role !== 'admin') {
            setError("Only admins can update currency settings.");
            return false; // Indicate failure
        }
        setLoading(true);
        setError(null);
        try {
            const res = await api.put('/settings', { defaultCurrency: newCurrencyData });
            setCurrency(res.data.settings.defaultCurrency);
            setLoading(false);
            return true;
        } catch (err) {
            console.error("Failed to update currency setting:", err);
            setError(err.response?.data?.message || "Failed to update currency setting.");
            setLoading(false);
            return false;
        }
    };


    const formatCurrency = (amount) => {
        if (currency && typeof amount === 'number') {
            const { symbol, decimalPlaces, thousandSeparator, decimalSeparator, formatTemplate } = currency;
            const fixedAmount = amount.toFixed(decimalPlaces);
            const parts = fixedAmount.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
            const formattedAmount = parts.join(decimalSeparator);

            return formatTemplate
                .replace('{symbol}', symbol)
                .replace('{amount}', formattedAmount)
                .replace('{code}', currency.code); // Also allow {code} in formatTemplate
        }
        return `£${amount?.toFixed(2) || '0.00'}`;
    };


    return (
        <CurrencyContext.Provider value={{ currency, loading, error, updateCurrency, formatCurrency }}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
};