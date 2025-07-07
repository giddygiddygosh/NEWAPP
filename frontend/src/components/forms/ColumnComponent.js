// ServiceOS/frontend/src/components/forms/ColumnComponent.js

import React from 'react';
import { useDrop } from 'react-dnd';
import { v4 as uuidv4 } from 'uuid';
import FormField from './FormField'; 

// Item types (must match in other components)
const ItemTypes = {
    FORM_FIELD: 'formField',
    FIELD_TYPE: 'fieldType',
    ROW: 'row',
};

const ColumnComponent = ({ column, rowId, moveField, removeField, editField, addFieldToColumn }) => {
    // Drop target for fields (either new types from toolbox or existing fields)
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: [ItemTypes.FORM_FIELD, ItemTypes.FIELD_TYPE],
        drop: (item, monitor) => {
            const hoverIndex = column.fields.length; // Always drop at the end of the column

            if (item.type === ItemTypes.FIELD_TYPE) {
                // If a new field type is dropped from the toolbox
                const newField = {
                    id: uuidv4(),
                    label: item.label,
                    name: item.fieldType.toLowerCase() + '_' + uuidv4().slice(0, 4), // Generate unique name
                    type: item.fieldType,
                    placeholder: '',
                    required: false,
                    options: [],
                    ref: React.createRef(),
                };
                addFieldToColumn(rowId, column.id, newField, hoverIndex); // Pass hoverIndex
            } else if (item.type === ItemTypes.FORM_FIELD) {
                // If an existing field is dropped from another column/row
                moveField(item.id, column.id, rowId, hoverIndex); // Move to end of current column
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [column.id, rowId, addFieldToColumn, column.fields.length, moveField]);

    const isActive = isOver && canDrop;

    return (
        <div
            ref={drop}
            className={`
                relative min-h-[120px] border-2 border-dashed rounded-lg p-3
                ${isActive ? 'border-blue-500 bg-blue-50' : canDrop ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'}
                transition-colors duration-150 ease-in-out
                flex flex-col items-center justify-center
            `}
        >
            {column.fields.length === 0 && (
                <p className={`text-gray-400 text-sm ${isActive ? 'text-blue-600' : ''}`}>
                    Drop fields here
                </p>
            )}
            <div className="w-full">
                {column.fields.map((field, fieldIndex) => (
                    <FormField
                        key={field.id}
                        field={field}
                        index={fieldIndex}
                        moveField={moveField} // Pass moveField down for field-level reordering
                        removeField={removeField} // Pass removeField down for field-level removal
                        editField={editField} // Pass editField down for field-level editing
                        currentColumnId={column.id} // Pass current column ID
                        currentRowId={rowId} // Pass current row ID
                    />
                ))}
            </div>
        </div>
    );
};

export default ColumnComponent;