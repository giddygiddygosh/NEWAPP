// ServiceOS/frontend/src/components/common/AddressInput.js
// This component is extracted directly from your working SettingsPage.js
// and uses @react-google-maps/api's Autocomplete component.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ModernInput from './ModernInput';
import { Autocomplete } from '@react-google-maps/api'; // IMPORTANT: This import is needed!

// Define UK bounds as per SettingsPage for consistency
const UK_BOUNDS = {
    north: 60.86,
    south: 49.88,
    west: -8.65,
    east: 1.77,
};

const AddressInput = ({ label, address, onChange, fieldName, isRequired = false, disabled = false, isMapsLoaded, isMapsLoadError }) => {
    const autocompleteRef = useRef(null); // Ref to hold the Autocomplete instance
    const [searchInputValue, setSearchInputValue] = useState(''); // State for the main search input

    useEffect(() => {
        // Concatenate address parts for the display in the main search input
        const fullAddressString = [address.street, address.city, address.county, address.postcode, address.country]
                                  .filter(part => part && part.trim() !== '')
                                  .join(', ');
        setSearchInputValue(fullAddressString);
    }, [address]);


    const onPlaceChanged = useCallback(() => {
        const place = autocompleteRef.current.getPlace();
        if (place.address_components) {
            let streetNumber = '', route = '', city = '', county = '', postcode = '', country = '';
            for (const component of place.address_components) {
                const type = component.types[0];
                switch (type) {
                    case 'street_number': streetNumber = component.long_name; break;
                    case 'route': route = component.long_name; break;
                    case 'postal_town': city = component.long_name; break;
                    case 'locality': if (!city) city = component.long_name; break;
                    case 'administrative_area_level_2': county = component.long_name; break;
                    case 'postal_code': postcode = component.long_name; break;
                    case 'country': country = component.long_name; break;
                    default: break;
                }
            }
            const newAddress = {
                street: `${streetNumber} ${route}`.trim(),
                city,
                county,
                postcode,
                country
            };
            onChange(newAddress);
            // After selecting a place, update the search input to the full formatted address from Google
            setSearchInputValue(place.formatted_address || newAddress.street);

        } else {
            // If no valid place data after selection, use current input value for street and clear others
            onChange({ street: searchInputValue, city: '', county: '', postcode: '', country: '' });
        }
    }, [onChange, searchInputValue]); // Keep searchInputValue in dependencies for correct fallback

    // Handler for manual input changes in the search box
    const handleSearchInputChange = useCallback((e) => {
        const value = e.target.value;
        setSearchInputValue(value);
        // When user types, immediately update the street field in the parent state and clear other fields.
        onChange({
            street: value,
            city: '', county: '', postcode: '', country: ''
        });
    }, [onChange]);

    // Handler for manual changes to the sub-fields (Street, City, etc.) if they are made editable
    const handleSubFieldChange = useCallback((e, subFieldName) => {
        const { value } = e.target;
        onChange({ ...address, [subFieldName]: value });
    }, [address, onChange]);


    if (isMapsLoadError) {
        return <p className="text-red-500 text-sm">Error loading maps. Please check your API key and network.</p>;
    }

    if (!isMapsLoaded) {
        return <p className="text-gray-500 text-sm">Loading address autocomplete...</p>;
    }

    return (
        <div className="space-y-3">
            {/* The main autocomplete search input - this is where you type and get suggestions */}
            <Autocomplete
                onLoad={(autocomplete) => (autocompleteRef.current = autocomplete)}
                onPlaceChanged={onPlaceChanged}
                options={{
                    types: ['address'],
                    componentRestrictions: { country: ['gb'] }, // Consistent with SettingsPage 'gb' for UK
                    bounds: UK_BOUNDS,
                    strictBounds: false,
                    fields: ["address_components", "formatted_address"] // Request necessary fields
                }}
            >
                {/* ModernInput is rendered as the child of Autocomplete */}
                <ModernInput
                    label={label} // This label will be "Main Address" or "Company Address"
                    name={`${fieldName}-search`} // Use a unique name for the autocomplete input
                    placeholder="Start typing an address..."
                    value={searchInputValue}
                    onChange={handleSearchInputChange} // This handles typing into this specific input
                    disabled={disabled}
                    className="w-full"
                    // No need for inputRef here, Autocomplete handles it internally
                />
            </Autocomplete>

            {/* Individual address fields - these are populated by the autocomplete or can be manually edited */}
            {/* They were previously implicitly readOnly in your image but explicitly set here for clarity. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ModernInput label="Street" name="street" value={address.street || ''} onChange={(e) => handleSubFieldChange(e, 'street')} disabled={disabled} className="w-full" readOnly />
                <ModernInput label="City" name="city" value={address.city || ''} onChange={(e) => handleSubFieldChange(e, 'city')} disabled={disabled} className="w-full" readOnly />
                <ModernInput label="County / State" name="county" value={address.county || ''} onChange={(e) => handleSubFieldChange(e, 'county')} disabled={disabled} className="w-full" readOnly />
                <ModernInput label="Postcode / Zip" name="postcode" value={address.postcode || ''} onChange={(e) => handleSubFieldChange(e, 'postcode')} disabled={disabled} className="w-full" readOnly />
                <ModernInput label="Country" name="country" value={address.country || ''} onChange={(e) => handleSubFieldChange(e, 'country')} disabled={disabled} className="w-full" readOnly />
            </div>
        </div>
    );
};

export default AddressInput;