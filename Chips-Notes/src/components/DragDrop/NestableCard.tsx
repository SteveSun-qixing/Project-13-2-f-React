import React, { useState, useCallback, type ReactNode } from 'react';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './NestableCard.css';

interface NestableCardProps {
    id: string;
    children?: ReactNode;
    draggable?: boolean;
    collapsible?: boolean;
    collapsed?: boolean;
    onDragStart?: (id: string) => void;
    onDragEnd?: (id: string, success: boolean) => void;
    onToggleCollapse?: (id: string) => void;
}

export function NestableCard({
    id,
    children,
    draggable = true,
    collapsible = false,
    collapsed = false,
    onDragStart,
    onDragEnd,
    onToggleCollapse,
}: NestableCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(collapsed);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (!draggable) return;
        setIsDragging(true);
        e.dataTransfer.setData('text/plain', id);
        onDragStart?.(id);
    }, [draggable, id, onDragStart]);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        setIsDragging(false);
        onDragEnd?.(id, e.defaultPrevented === false);
    }, [id, onDragEnd]);

    const handleToggleCollapse = useCallback(() => {
        if (!collapsible) return;
        setIsCollapsed(!isCollapsed);
        onToggleCollapse?.(id);
    }, [collapsible, isCollapsed, id, onToggleCollapse]);

    return (
        <div
            className={`nestable-card ${isDragging ? 'nestable-card--dragging' : ''} ${isCollapsed ? 'nestable-card--collapsed' : ''}`}
            draggable={draggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {collapsible && (
                <button
                    type="button"
                    className="nestable-card__toggle"
                    onClick={handleToggleCollapse}
                >
                    <RuntimeIcon icon={isCollapsed ? ENGINE_ICONS.chevronRight : ENGINE_ICONS.chevronDown} />
                </button>
            )}
            <div className="nestable-card__content">
                {children}
            </div>
        </div>
    );
}
