// ServiceOS/frontend/src/components/forms/DraggableFieldType.js

import React from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
    FORM_FIELD: 'formField',
    FIELD_TYPE: 'fieldType',
    ROW: 'row',
};

const DraggableFieldType = ({ type, label, icon: IconComponent }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.FIELD_TYPE,
        item: { type: ItemTypes.FIELD_TYPE, fieldType: type, label },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }));

    return (
        <div
            ref={drag}
            className={`
                p-3 bg-blue-100 border border-blue-200 rounded-md mb-2
                cursor-grab flex items-center text-blue-800 font-medium
                hover:bg-blue-200 transition-colors duration-150 ease-in-out
                ${isDragging ? 'opacity-50 shadow-lg' : 'opacity-100 shadow-sm'}
            `}
        >
            {IconComponent && <IconComponent className="h-5 w-5 mr-3 text-blue-600" />}
            {label}
        </div>
    );
};

export default DraggableFieldType;