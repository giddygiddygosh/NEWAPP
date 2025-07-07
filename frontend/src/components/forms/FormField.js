// ServiceOS/frontend/src/components/forms/FormField.js

import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';

// Import Heroicons
import {
    PencilIcon, TrashIcon,
    Bars2Icon, // Drag handle icon
} from '@heroicons/react/24/outline'; 

// Define draggable item types (must match in other components)
const ItemTypes = {
    FORM_FIELD: 'formField',
    FIELD_TYPE: 'fieldType',
    ROW: 'row',
};


const FormField = ({ field, index, moveField, removeField, editField, currentColumnId, currentRowId }) => { 
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.FORM_FIELD,
        item: { id: field.id, index, currentColumnId, currentRowId }, 
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [field.id, index, moveField, currentColumnId, currentRowId]);

    const [, drop] = useDrop(() => ({
        accept: ItemTypes.FORM_FIELD,
        hover(item, monitor) {
            if (item.currentColumnId !== currentColumnId || item.currentRowId !== currentRowId) {
                return;
            }

            if (!field.ref.current) {
                return;
            }
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) return;

            const hoverBoundingRect = field.ref.current.getBoundingClientRect();
            const clientOffset = monitor.getClientOffset();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            moveField(item.id, currentColumnId, currentRowId, hoverIndex, item.currentColumnId, item.currentRowId);
            item.index = hoverIndex;
        },
    }), [index, moveField, currentColumnId, currentRowId, field.id]);

    const dragHandleRef = useRef(null);

    drag(drop(field.ref));


    return (
        <div ref={field.ref} style={{ opacity: isDragging ? 0.5 : 1 }}
             className="relative p-4 mb-3 bg-gray-100 border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-all duration-150 ease-in-out">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                    <Bars2Icon ref={dragHandleRef} className="h-6 w-6 text-gray-400 mr-2 cursor-grab" />
                    <p className="font-semibold text-gray-800">{field.label} ({field.type}) {field.required && <span className="text-red-500">*</span>}</p>
                </div>
                <div className="flex space-x-2">
                    <button type="button" onClick={() => editField(field)} className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-100 transition-colors">
                        <PencilIcon className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => removeField(currentRowId, currentColumnId, field.id)} className="text-red-600 hover:text-red-800 p-1 rounded-md hover:bg-red-100 transition-colors">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            {field.type === 'textarea' ? (
                <textarea placeholder={field.placeholder || ''} className="w-full border border-gray-300 p-2 rounded text-gray-700 h-20" disabled></textarea>
            ) : field.type === 'select' ? (
                <select className="w-full border border-gray-300 p-2 rounded text-gray-700" disabled>
                    <option>{field.placeholder || 'Select an option'}</option>
                    {field.options && field.options.map((opt, i) => <option key={i}>{opt}</option>)}
                </select>
            ) : field.type === 'checkbox' ? (
                <input type="checkbox" disabled className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            ) : (
                <input type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : 'text'}
                        placeholder={field.placeholder || ''}
                        className="w-full border border-gray-300 p-2 rounded text-gray-700"
                        disabled />
            )}
        </div>
    );
};

export default FormField;