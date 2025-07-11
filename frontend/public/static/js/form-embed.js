// C:\Users\darre\App\frontend\public\static\js\form-embed.js

(function() {
    // Helper function for checking emptiness, consistent with backend
    const isValueEmpty = (value) => {
        return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    };

    // Default styles for fields if not provided by formDefinition or global settings
    // These are for client-side rendering only, not saved to DB
    const defaultFieldStyles = {
        inputBorderColor: '#D1D5DB',
        inputBorderWidth: 1,
        inputBorderStyle: 'solid',
        inputBorderRadius: '0.375rem',
        inputTextColor: '#111827',
        inputBackgroundColor: '#FFFFFF',
    };

    // This function will be exposed globally for the embed snippet to call
    window.renderServiceOSForm = async (formId, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`ServiceOS Form Embed: Container with ID '${containerId}' not found.`);
            return;
        }

        container.innerHTML = '<div style="text-align: center; padding: 20px;"><div style="display: inline-block; border: 4px solid rgba(0,0,0,.1); border-left-color: #2563EB; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></div><p style="margin-top: 10px; color: #555;">Loading form...</p></div>' +
                                '<style>' +
                                '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' +
                                '</style>';

        try {
            const apiBaseUrl = 'http://localhost:5004/api'; // Make sure this matches your backend API URL
            const response = await fetch(`${apiBaseUrl}/public/forms/${formId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch form: ${response.status}`);
            }
            const formDefinition = await response.json();

            container.innerHTML = '';

            const formElement = document.createElement('form');
            formElement.id = `serviceos-rendered-form-${formId}`;
            formElement.className = 'serviceos-form p-6 space-y-4'; 

            if (formDefinition.settings && formDefinition.settings.styles) {
                const styles = formDefinition.settings.styles;
                formElement.style.backgroundColor = styles.backgroundColor || '#FFFFFF';
            }

            // --- Function to render individual fields ---
            const renderField = (field) => {
                const fieldWrapper = document.createElement('div');
                fieldWrapper.className = 'form-field-wrapper'; 

                const labelElement = document.createElement('label');
                labelElement.htmlFor = field.name; // Use the field.name as ID/for
                labelElement.textContent = field.label + (field.required ? ' *' : '');
                labelElement.className = 'block text-sm font-medium mb-1';
                if (formDefinition.settings?.styles?.labelColor) {
                    labelElement.style.color = formDefinition.settings.styles.labelColor;
                }
                fieldWrapper.appendChild(labelElement);

                let inputElement;

                switch (field.type) {
                    case 'textarea':
                        inputElement = document.createElement('textarea');
                        inputElement.rows = 4;
                        break;
                    case 'select':
                        inputElement = document.createElement('select');
                        field.options.forEach(optionValue => { // Assuming options are simple strings now
                            const option = document.createElement('option');
                            option.value = optionValue;
                            option.textContent = optionValue;
                            inputElement.appendChild(option);
                        });
                        break;
                    case 'radio': 
                        // For radio groups, we need a container for the options
                        const radioGroupWrapper = document.createElement('div');
                        radioGroupWrapper.className = 'flex flex-wrap gap-x-4'; // Tailwind for horizontal radios
                        field.options.forEach(optionValue => {
                            const radioContainer = document.createElement('div');
                            radioContainer.className = 'flex items-center';
                            const radioInput = document.createElement('input');
                            radioInput.type = 'radio';
                            radioInput.id = `${field.name}-${optionValue.toLowerCase().replace(/\s/g, '-')}`;
                            radioInput.name = field.name; // Crucial for radio group
                            radioInput.value = optionValue;
                            radioInput.required = field.required; // Apply required to at least one radio
                            radioInput.className = 'h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 mr-2';
                            
                            const radioLabel = document.createElement('label');
                            radioLabel.htmlFor = radioInput.id;
                            radioLabel.textContent = optionValue;
                            radioLabel.className = 'text-sm text-gray-700';

                            radioContainer.appendChild(radioInput);
                            radioContainer.appendChild(radioLabel);
                            radioGroupWrapper.appendChild(radioContainer);
                        });
                        fieldWrapper.appendChild(radioGroupWrapper);
                        inputElement = null; // No single inputElement to append below
                        break;
                    case 'checkbox': 
                        inputElement = document.createElement('input');
                        inputElement.type = 'checkbox';
                        inputElement.className = 'h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
                        break;
                    case 'date':
                    case 'time':
                    case 'email':
                    case 'tel': // Changed from 'phone' to 'tel' for HTML5 input type
                    case 'file': 
                        inputElement = document.createElement('input');
                        inputElement.type = field.type === 'phone' ? 'tel' : field.type; // Map 'phone' type to 'tel' HTML type
                        break;
                    case 'address': 
                        // Simplified for embed, a real address input would be more complex
                        inputElement = document.createElement('input');
                        inputElement.type = 'text';
                        inputElement.placeholder = field.placeholder || 'Enter address';
                        console.warn(`ServiceOS Form Embed: 'address' field type requires more complex rendering (e.g. Google Places). Using simple text input.`);
                        break;
                    default: // text, number, etc.
                        inputElement = document.createElement('input');
                        inputElement.type = field.type; // Assume direct HTML type if not specified above
                        break;
                }

                if (inputElement) { 
                    inputElement.id = field.name;
                    inputElement.name = field.name; // Use the name from the field definition
                    inputElement.placeholder = field.placeholder || '';
                    inputElement.required = field.required;
                    inputElement.className = 'mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

                    // Apply individual field styles, falling back to global/default styles
                    const fieldStyles = field.styles || {};
                    const globalStyles = formDefinition.settings?.styles || {};

                    inputElement.style.borderColor = fieldStyles.inputBorderColor || globalStyles.borderColor || defaultFieldStyles.inputBorderColor;
                    inputElement.style.borderWidth = `${fieldStyles.inputBorderWidth || globalStyles.globalBorderWidth || defaultFieldStyles.inputBorderWidth}px`;
                    inputElement.style.borderStyle = fieldStyles.inputBorderStyle || globalStyles.globalBorderStyle || defaultFieldStyles.inputBorderStyle;
                    inputElement.style.borderRadius = fieldStyles.inputBorderRadius || globalStyles.borderRadius || defaultFieldStyles.inputBorderRadius;
                    inputElement.style.color = fieldStyles.inputTextColor || defaultFieldStyles.inputTextColor;
                    inputElement.style.backgroundColor = fieldStyles.inputBackgroundColor || defaultFieldStyles.inputBackgroundColor;
                    
                    fieldWrapper.appendChild(inputElement);
                }
                
                return fieldWrapper;
            };
            // --- End Function to render individual fields ---


            formDefinition.formSchema.forEach(row => { // Changed from formDefinition.schema to formDefinition.formSchema
                const rowElement = document.createElement('div');
                rowElement.className = 'flex flex-wrap -mx-2 mb-4'; 

                row.columns.forEach(col => {
                    const colElement = document.createElement('div');
                    colElement.className = `px-2 mb-4 w-full md:w-${parseFloat(col.width.replace('%', '')) / 100 * 12}/12`; 
                    colElement.style.width = col.width; 

                    col.fields.forEach(field => {
                        colElement.appendChild(renderField(field));
                    });
                    rowElement.appendChild(colElement);
                });
                formElement.appendChild(rowElement);
            });

            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Submit Form';
            submitButton.className = 'w-full py-2 px-4 rounded-md text-white font-semibold transition-colors duration-200 shadow-md';
            if (formDefinition.settings?.styles?.primaryColor) {
                submitButton.style.backgroundColor = formDefinition.settings.styles.primaryColor;
            } else {
                submitButton.style.backgroundColor = '#2563EB'; 
            }
            formElement.appendChild(submitButton);

            container.appendChild(formElement);

            // --- Form Submission Logic ---
            formElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';

                // Create a flat map of field definitions for client-side lookup based on field.name
                const clientSideFormFieldMap = {};
                formDefinition.formSchema.forEach(row => { // Changed to formDefinition.formSchema
                    row.columns.forEach(col => {
                        col.fields.forEach(field => {
                            clientSideFormFieldMap[field.name] = field; // Use field.name as the key
                        });
                    });
                });

                const formData = [];
                const formInputs = formElement.querySelectorAll('input, textarea, select');
                formInputs.forEach(input => {
                    const fieldDef = clientSideFormFieldMap[input.name]; // Get the full field definition

                    if (!fieldDef) {
                        console.warn(`ServiceOS Form Embed: No definition found for input name: ${input.name}. Skipping.`);
                        return; // Skip fields not found in the definition
                    }

                    let value;
                    if (input.type === 'checkbox') {
                        value = input.checked;
                    } else if (input.type === 'radio') {
                        if (!input.checked) {
                            return; // Only include the value of the selected radio button
                        }
                        value = input.value;
                    } else {
                        value = input.value;
                    }
                    
                    // Push an object that includes the 'mapping' if it exists in the definition
                    formData.push({
                        name: input.name, // Will be hardcoded for CRM fields, dynamic for others
                        value: value,
                        mapping: fieldDef.mapping // Include the mapping from the definition if available
                    });
                });

                // --- DEBUG LOG START ---
                console.log('DEBUG (form-embed.js): Final formData array before sending:', formData);
                console.log('DEBUG (form-embed.js): JSON stringified body:', JSON.stringify({ formData: formData }));
                // --- DEBUG LOG END ---


                let validationErrors = [];
                formDefinition.formSchema.forEach(row => { // Changed to formDefinition.formSchema
                    row.columns.forEach(col => {
                        col.fields.forEach(field => {
                            if (field.required) {
                                const submittedItem = formData.find(item => item.name === field.name);
                                if (!submittedItem || isValueEmpty(submittedItem.value)) {
                                    validationErrors.push(`${field.label} is required.`);
                                }
                            }
                        });
                    });
                });

                if (validationErrors.length > 0) {
                    alert('Please fill out all required fields:\n' + validationErrors.join('\n'));
                    submitButton.disabled = false;
                    submitButton.textContent = 'Submit Form';
                    return;
                }
                
                try {
                    const submissionResponse = await fetch(`${apiBaseUrl}/public/forms/${formId}/submit`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ formData: formData }) // Send the formData array under the 'formData' key
                    });

                    const result = await submissionResponse.json();

                    if (!submissionResponse.ok) {
                        throw new Error(result.message || 'Form submission failed.');
                    }

                    alert(result.message || 'Form submitted successfully!');
                    formElement.reset(); 
                    container.innerHTML = `<div style="text-align: center; padding: 40px; color: #28a745; font-size: 1.2em;">${result.message || 'Thank you for your submission!'}</div>`;
                } catch (submitError) {
                    console.error('ServiceOS Form Embed: Submission error:', submitError);
                    alert(`Submission Failed: ${submitError.message}`);
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Submit Form';
                }
            });
            // --- End Form Submission Logic ---

        } catch (err) {
            console.error('ServiceOS Form Embed: Error rendering form:', err);
            container.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">Failed to load form: ${err.message}. Please check the form ID and ensure it is published.</div>`;
        }
    };
})();