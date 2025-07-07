// ServiceOS/frontend/src/components/common/GooglePlaceAutocomplete.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ModernInput from './ModernInput';

// --- Configuration ---
const Maps_API_KEY = process.env.REACT_APP_MAPS_API_KEY;
const MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${Maps_API_KEY}&libraries=places`;

// --- Helper function to load the Google Maps script ---
const loadScript = (callback) => {
    if (window.google && window.google.maps && window.google.maps.places) {
        callback();
        return;
    }
    if (window.googleMapsScriptLoading) {
        const interval = setInterval(() => {
            if (window.google && window.google.maps && window.google.maps.places) {
                clearInterval(interval);
                callback();
            }
        }, 100);
        return;
    }
    window.googleMapsScriptLoading = true;
    
    const script = document.createElement('script');
    script.src = MAPS_API_URL;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
        window.googleMapsScriptLoading = false;
        callback();
    };
    script.onerror = (e) => {
        console.error('Google Maps script could not be loaded:', e);
        window.googleMapsScriptLoading = false;
    };
    document.head.appendChild(script);
};

// --- The GooglePlaceAutocomplete Component ---
function GooglePlaceAutocomplete({ label, address, onChange, placeholder = "Enter a location", id }) {
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const autocompleteInputRef = useRef(null);
    const autocompleteInstance = useRef(null);
    const [inputValue, setInputValue] = useState('');

    // --- MOVE: handlePlaceChange is now declared BEFORE it's used in useEffect ---
    const handlePlaceChange = useCallback((place) => {
        let streetNumber = '', route = '', city = '', county = '', postcode = '', country = '';

        if (place && place.address_components) {
            for (const component of place.address_components) {
                const type = component.types[0];
                switch (type) {
                    case 'street_number': streetNumber = component.long_name; break;
                    case 'route': route = component.long_name; break;
                    case 'postal_town': city = component.long_name; break;
                    case 'locality': if (!city) city = component.long_name; break;
                    case 'administrative_area_level_2': county = component.long_name; break;
                    case 'administrative_area_level_1': if (!county) county = component.long_name; break;
                    case 'postal_code': postcode = component.long_name; break;
                    case 'country': country = component.long_name; break;
                    default: break;
                }
            }
        }

        const newAddress = {
            street: `${streetNumber} ${route}`.trim(),
            city, county, postcode, country
        };

        setInputValue(place?.formatted_address || newAddress.street || '');
        onChange({ target: { name: 'address', value: newAddress } });

    }, [onChange]); // IMPORTANT: inputValue is no longer a dependency here, as setInputValue is direct.

    // Effect to set the initial value of the input on component mount/address prop change
    useEffect(() => {
        const fullAddressString = [address.street, address.city, address.county, address.postcode, address.country]
                                  .filter(part => part && part.trim() !== '')
                                  .join(', ');
        setInputValue(fullAddressString);
    }, [address]);


    // Effect to load the script
    useEffect(() => {
        loadScript(() => setIsScriptLoaded(true));
    }, []);

    // Effect to initialize the autocomplete instance
    useEffect(() => {
        if (isScriptLoaded && autocompleteInputRef.current && window.google && window.google.maps && window.google.maps.places && !autocompleteInstance.current) {
            console.log("Google Maps script loaded, initializing Autocomplete on:", autocompleteInputRef.current);
            autocompleteInstance.current = new window.google.maps.places.Autocomplete(
                autocompleteInputRef.current,
                {
                    types: ['address'],
                    componentRestrictions: { country: 'gb' },
                    fields: ["address_components", "formatted_address"]
                }
            );

            // Now handlePlaceChange is guaranteed to be initialized
            autocompleteInstance.current.addListener('place_changed', () => {
                const place = autocompleteInstance.current.getPlace();
                handlePlaceChange(place);
            });
        }
    }, [isScriptLoaded, handlePlaceChange]); // Keep handlePlaceChange as dependency

    // Handle user typing into the input field
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        onChange({
            target: {
                name: 'address',
                value: {
                    street: value,
                    city: '',
                    county: '',
                    postcode: '',
                    country: ''
                }
            }
        });
    };

    // Render loading/error states
    if (Maps_API_KEY === undefined || Maps_API_KEY === '') {
        return <ModernInput label={label} value="Google Maps API Key is missing or invalid." readOnly className="text-red-500" />;
    }
    if (!isScriptLoaded) {
        return <ModernInput label={label} value="Loading address autocomplete..." readOnly className="text-gray-500" />;
    }

    return (
        <ModernInput
            label={label}
            name="google-autocomplete-address"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            id={id}
            inputRef={autocompleteInputRef} // Pass the ref for ModernInput to apply to its internal <input>
        />
    );
}

export default GooglePlaceAutocomplete;