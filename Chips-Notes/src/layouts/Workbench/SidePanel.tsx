import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createKeyboardMap, getKeyboardAction } from '../../utils/a11y';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './SidePanel.css';

export type SidePanelPosition = 'left' | 'right';

const SIDE_PANEL_RESIZE_KEYBOARD_MAP = createKeyboardMap({
    decrease: 'ArrowLeft',
    increase: 'ArrowRight',
    min: 'Home',
    max: 'End',
});

export interface SidePanelProps {
    position?: SidePanelPosition;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    expanded?: boolean;
    title?: string;
    toggleLabel?: string;
    collapsedLabel?: string;
    resizeLabel?: string;
    resizable?: boolean;
    collapsedWidth?: number;
    headerSlot?: ReactNode;
    children?: ReactNode;
    onWidthChange?: (width: number) => void;
    onExpandedChange?: (expanded: boolean) => void;
}

export const SidePanel = React.memo(function SidePanel({
    position = 'left',
    width = 280,
    minWidth = 180,
    maxWidth = 480,
    expanded = true,
    title = '',
    toggleLabel,
    collapsedLabel,
    resizeLabel,
    resizable = true,
    collapsedWidth = 40,
    headerSlot,
    children,
    onWidthChange,
    onExpandedChange,
}: SidePanelProps) {
    const [currentWidth, setCurrentWidth] = useState(width);
    const [isResizing, setIsResizing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(expanded);

    const resizeStartX = useRef(0);
    const resizeStartWidth = useRef(0);

    useEffect(() => {
        setCurrentWidth(width);
    }, [width]);

    useEffect(() => {
        setIsExpanded(expanded);
    }, [expanded]);

    const displayWidth = isExpanded ? currentWidth : collapsedWidth;

    const toggleExpand = () => {
        const nextState = !isExpanded;
        setIsExpanded(nextState);
        onExpandedChange?.(nextState);
    };

    const expand = () => {
        if (!isExpanded) {
            setIsExpanded(true);
            onExpandedChange?.(true);
        }
    };

    const setWidth = (w: number) => {
        const clamped = Math.max(minWidth, Math.min(maxWidth, w));
        setCurrentWidth(clamped);
        onWidthChange?.(clamped);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        if (!resizable || !isExpanded) return;
        e.preventDefault();
        setIsResizing(true);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = currentWidth;

        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    };

    const handleResizeMove = (e: MouseEvent) => {
        const deltaX = e.clientX - resizeStartX.current;
        const newWidth = position === 'left'
            ? resizeStartWidth.current + deltaX
            : resizeStartWidth.current - deltaX;
        setWidth(newWidth);
    };

    const handleResizeEnd = () => {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
    };

    const handleResizeDoubleClick = () => {
        setWidth(width);
    };

    const handleResizeKeyDown = (event: React.KeyboardEvent) => {
        if (!resizable || !isExpanded) {
            return;
        }

        const action = getKeyboardAction(event, SIDE_PANEL_RESIZE_KEYBOARD_MAP);
        if (!action) {
            return;
        }

        event.preventDefault();

        if (action === 'min') {
            setWidth(minWidth);
            return;
        }
        if (action === 'max') {
            setWidth(maxWidth);
            return;
        }

        const step = event.shiftKey ? 24 : 8;
        const direction = action === 'increase' ? 1 : -1;
        const signedStep = position === 'left' ? direction * step : direction * -step;
        setWidth(currentWidth + signedStep);
    };

    const handleCollapsedTriggerKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        expand();
    };

    const panelClass = [
        'side-panel',
        `side-panel--${position}`,
        isExpanded ? 'side-panel--expanded' : 'side-panel--collapsed',
        isResizing ? 'side-panel--resizing' : ''
    ].filter(Boolean).join(' ');

    const handleClass = [
        'side-panel__resize-handle',
        `side-panel__resize-handle--${position === 'left' ? 'right' : 'left'}`
    ].join(' ');

    return (
        <aside
            className={panelClass}
            style={{ width: `${displayWidth}px`, '--panel-width': `${displayWidth}px` } as React.CSSProperties}
            role="complementary"
            aria-expanded={isExpanded}
            aria-label={title}
        >
            {(title || headerSlot) && (
                <header className="side-panel__header">
                    {headerSlot || <span className="side-panel__title">{title}</span>}
                    <button
                        type="button"
                        className="side-panel__toggle"
                        aria-label={toggleLabel}
                        aria-expanded={isExpanded}
                        onClick={toggleExpand}
                    >
                        <span className="side-panel__toggle-icon">
                            <RuntimeIcon icon={isExpanded
                                ? (position === 'left' ? ENGINE_ICONS.chevronLeft : ENGINE_ICONS.chevronRight)
                                : (position === 'left' ? ENGINE_ICONS.chevronRight : ENGINE_ICONS.chevronLeft)} />
                        </span>
                    </button>
                </header>
            )}

            <div className="side-panel__content" style={{ display: isExpanded ? 'flex' : 'none' }}>
                {children}
            </div>

            {!isExpanded && (
                <button
                    type="button"
                    className="side-panel__collapsed-trigger"
                    aria-label={collapsedLabel ?? title}
                    onClick={expand}
                    onKeyDown={handleCollapsedTriggerKeyDown}
                >
                    <span className="side-panel__collapsed-icon">
                        <RuntimeIcon icon={position === 'left' ? ENGINE_ICONS.chevronRight : ENGINE_ICONS.chevronLeft} />
                    </span>
                </button>
            )}

            {resizable && isExpanded && (
                <div
                    className={handleClass}
                    role="separator"
                    tabIndex={0}
                    aria-label={resizeLabel}
                    aria-orientation="vertical"
                    aria-valuemin={minWidth}
                    aria-valuemax={maxWidth}
                    aria-valuenow={currentWidth}
                    onMouseDown={handleResizeStart}
                    onDoubleClick={handleResizeDoubleClick}
                    onKeyDown={handleResizeKeyDown}
                />
            )}
        </aside>
    );
});
