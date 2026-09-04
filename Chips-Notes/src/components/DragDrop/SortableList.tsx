import React, { useState, useCallback, type ReactNode } from 'react';
import './SortableList.css';

interface SortableItem {
    id: string;
    type?: string;
    data?: unknown;
}

interface SortableListProps {
    items: SortableItem[];
    containerId: string;
    direction?: 'horizontal' | 'vertical';
    disabled?: boolean;
    gap?: number;
    onSort?: (from: number, to: number) => void;
    onDragStart?: (item: SortableItem, index: number) => void;
    onDragEnd?: (success: boolean) => void;
    renderItem: (item: SortableItem, index: number) => ReactNode;
}

export function SortableList({
    items,
    containerId,
    direction = 'vertical',
    disabled = false,
    gap = 8,
    onSort,
    onDragStart,
    onDragEnd,
    renderItem,
}: SortableListProps) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [insertIndex, setInsertIndex] = useState<number | null>(null);

    const handleDragStart = useCallback((item: SortableItem, index: number) => {
        if (disabled) return;
        setDragIndex(index);
        onDragStart?.(item, index);
    }, [disabled, onDragStart]);

    const handleDragEnd = useCallback((success: boolean) => {
        if (dragIndex !== null && insertIndex !== null && dragIndex !== insertIndex) {
            onSort?.(dragIndex, insertIndex);
        }
        setDragIndex(null);
        setInsertIndex(null);
        onDragEnd?.(success);
    }, [dragIndex, insertIndex, onSort, onDragEnd]);

    const containerStyle = {
        display: 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        gap: `${gap}px`,
    } as React.CSSProperties;

    return (
        <div
            className="sortable-list"
            data-container-id={containerId}
            style={containerStyle}
        >
            {items.map((item, index) => (
                <div
                    key={item.id}
                    className={`sortable-list__item ${dragIndex === index ? 'sortable-list__item--dragging' : ''} ${insertIndex === index ? 'sortable-list__item--inserting' : ''}`}
                    draggable={!disabled}
                    onDragStart={() => handleDragStart(item, index)}
                    onDragEnd={(e) => handleDragEnd(e.defaultPrevented === false)}
                >
                    {renderItem(item, index)}
                </div>
            ))}
        </div>
    );
}
