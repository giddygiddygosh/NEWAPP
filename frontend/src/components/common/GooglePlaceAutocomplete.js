import React, { useEffect, useRef, useState, useCallback } from 'react';
import ModernInput from './ModernInput';
import { useMapsApi } from '../../App';

function GooglePlaceAutocomplete({ label, onAddressSelect, placeholder = "Enter an address" }) {
    const { isMapsLoaded, isMapsLoadError } = useMapsApi();
    const autocompleteInputRef = useRef(null);
    const autocompleteInstance = useRef(null);
    const [inputValue, setInputValue] = useState('');

    const handlePlaceSelected = useCallback(() => {
        const place = autocompleteInstance.current.getPlace();
        if (!place || !place.formatted_address) return;
        
        setInputValue(place.formatted_address);
        if (onAddressSelect) {
            onAddressSelect(place.formatted_address);
        }
    }, [onAddressSelect]);

    useEffect(() => {
        if (isMapsLoaded && autocompleteInputRef.current && !autocompleteInstance.current) {
            autocompleteInstance.current = new window.google.maps.places.Autocomplete(
                autocompleteInputRef.current,
                { types: ['address'], componentRestrictions: { country: 'gb' }, fields: ["formatted_address"] }
            );
            autocompleteInstance.current.addListener('place_changed', handlePlaceSelected);
        }
    }, [isMapsLoaded, handlePlaceSelected]);

    if (isMapsLoadError) return <ModernInput label={label} value="Error loading Google Maps." readOnly />;
    if (!isMapsLoaded) return <ModernInput label={label} value="Loading address service..." readOnly />;

    return (
        <ModernInput
            label={label}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            ref={autocompleteInputRef} // Pass the ref directly to the corrected ModernInput
        />
    );
}

export default GooglePlaceAutocomplete;