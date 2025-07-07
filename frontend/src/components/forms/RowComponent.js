// ServiceOS/frontend/src/components/forms/RowComponent.js

import React, { useRef, useCallback } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { v4 as uuidv4 } from 'uuid';
import ModernSelect from '../common/ModernSelect';
import ColumnComponent from './ColumnComponent';
import FormField from './FormField';

// Heroicons for row management
import { PlusCircleIcon, TrashIcon, AdjustmentsHorizontalIcon, Bars2Icon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';


// Item types (must match in other components)
const ItemTypes = {
    FORM_FIELD: 'formField',
    FIELD_TYPE: 'fieldType',
    ROW: 'row',
};


const RowComponent = ({ row, rowIndex, removeRow, updateRowColumns, moveField, removeField, editField, addFieldToColumn, moveRow }) => {
    const ref = useRef(null);

    // Drop target for fields (either new types from toolbox or existing fields)
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: [ItemTypes.FORM_FIELD, ItemTypes.FIELD_TYPE],
        drop: (item, monitor) => {
            if (monitor.didDrop()) {
                return;
            }

            if (item.type === ItemTypes.FIELD_TYPE) {
                const newField = {
                    id: uuidv4(),
                    label: item.label,
                    name: item.fieldType.toLowerCase() + '_' + uuidv4().slice(0, 4),
                    type: item.fieldType,
                    placeholder: '',
                    required: false,
                    options: [],
                    ref: React.createRef(),
                };
                if (row.columns.length > 0) {
                    addFieldToColumn(row.id, row.columns[0].id, newField, row.columns[0].fields.length);
                }
            } else if (item.type === ItemTypes.FORM_FIELD) {
                if (item.currentColumnId !== row.columns[0].id || item.currentRowId !== row.id) {
                    moveField(item.id, row.columns[0].id, row.id, row.columns[0].fields.length, item.currentColumnId, item.currentRowId);
                }
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [row.id, row.columns, addFieldToColumn, moveField]);

    // Drag source for rows (to reorder rows)
    const [{ isDragging: isRowDragging }, dragRow] = useDrag(() => ({
        type: ItemTypes.ROW,
        item: { id: row.id, index: rowIndex },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [row.id, rowIndex]);

    // Drop target for rows (to reorder rows)
    const [, dropRow] = useDrop(() => ({
        accept: ItemTypes.ROW,
        hover(item, monitor) {
            if (!ref.current) {
                return;
            }
            const dragIndex = item.index;
            const hoverIndex = rowIndex;

            if (dragIndex === hoverIndex) return;

            const hoverBoundingRect = ref.current.getBoundingClientRect();
            const clientOffset = monitor.getClientOffset();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            moveRow(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    }), [rowIndex, moveRow]);

    // Connect refs for row drag-and-drop
    dragRow(dropRow(ref));

    const isActive = isOver && canDrop;

    const columnOptions = [
        { value: '1', label: '1 Column' },
        { value: '2', label: '2 Columns' },
        { value: '3', label: '3 Columns' },
    ];

    const currentColumnCount = row.columns.length.toString();

    return (
        <div ref={ref} style={{ opacity: isRowDragging ? 0.5 : 1 }}
             className="relative bg-white p-4 mb-4 rounded-lg shadow-md border border-gray-200">
            {/* Row Controls */}
            <div className="absolute top-2 right-2 flex space-x-2 z-10">
                 <button type="button" ref={dragRow} className="text-gray-500 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100 cursor-grab">
                    <Bars2Icon className="h-5 w-5" />
                 </button>
                 <button
                    type="button"
                    onClick={() => moveRow(rowIndex, rowIndex - 1)}
                    className="text-gray-500 hover:text-blue-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
                    title="Move Row Up"
                 >
                    <ArrowUpIcon className="h-5 w-5" />
                 </button>
                 <button
                    type="button"
                    onClick={() => moveRow(rowIndex, rowIndex + 1)}
                    className="text-gray-500 hover:text-blue-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
                    title="Move Row Down"
                 >
                    <ArrowDownIcon className="h-5 w-5" />
                 </button>

                 <ModernSelect
                    name="columnLayout"
                    value={currentColumnCount}
                    onChange={(e) => updateRowColumns(row.id, parseInt(e.target.value))}
                    options={columnOptions}
                    className="w-28 text-sm"
                    label=""
                 />
                 <button type="button" onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-100">
                    <TrashIcon className="h-5 w-5" />
                 </button>
            </div>
            
            {/* Columns Container */}
            <div ref={drop} className={`grid gap-4 ${
                row.columns.length === 1 ? 'grid-cols-1' :
                row.columns.length === 2 ? 'md:grid-cols-2' :
                'md:grid-cols-3'
            } mt-6 min-h-[100px] items-start`}>
                {row.columns.map(column => (
                    <ColumnComponent
                        key={column.id}
                        column={column}
                        rowId={row.id}
                        moveField={moveField}
                        removeField={removeField}
                        editField={editField}
                        addFieldToColumn={addFieldToColumn}
                    />
                ))}
            </div>
        </div>
    );
};

export default RowComponent;