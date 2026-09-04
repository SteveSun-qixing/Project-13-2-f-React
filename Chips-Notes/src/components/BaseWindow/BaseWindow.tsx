import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { createKeyboardMap, getKeyboardAction } from '../../utils/a11y';
import { formatMessage } from '../../lib/messages';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import type { BaseWindowConfig, Position, Size } from '../../types/window';
import './BaseWindow.css';

const WINDOW_TITLEBAR_KEYBOARD_MAP = createKeyboardMap({
    moveLeft: 'ArrowLeft',
    moveRight: 'ArrowRight',
    moveUp: 'ArrowUp',
    moveDown: 'ArrowDown',
    collapse: ['Enter', ' '],
});

const WINDOW_RESIZE_KEYBOARD_MAP = createKeyboardMap({
    shrinkWidth: 'ArrowLeft',
    growWidth: 'ArrowRight',
    shrinkHeight: 'ArrowUp',
    growHeight: 'ArrowDown',
});

export interface BaseWindowProps {
    config: BaseWindowConfig;
    draggable?: boolean;
    resizable?: boolean;
    minWidth?: number;
    minHeight?: number;
    onUpdatePosition?: (position: Position) => void;
    onUpdateSize?: (size: Size) => void;
    onFocus?: () => void;
    onClose?: () => void;
    onMinimize?: () => void;
    onCollapse?: () => void;
    headerSlot?: React.ReactNode;
    actionsSlot?: React.ReactNode;
    ariaLabel?: string;
    ariaRole?: React.AriaRole;
    children?: React.ReactNode;
}

export const BaseWindow = React.memo(function BaseWindow({
    config,
    draggable = true,
    resizable = true,
    minWidth = 200,
    minHeight = 100,
    onUpdatePosition,
    onUpdateSize,
    onFocus,
    onClose,
    onMinimize,
    onCollapse,
    headerSlot,
    actionsSlot,
    ariaLabel,
    ariaRole = 'region',
    children,
}: BaseWindowProps) {
    const titleId = useId();
    const contentId = useId();
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const dragStart = useRef({ x: 0, y: 0 });
    const initialPosition = useRef({ x: 0, y: 0 });

    const resizeStart = useRef({ x: 0, y: 0 });
    const initialSize = useRef({ width: 0, height: 0 });

    const windowStyle = useMemo(() => ({
        transform: `translate(${config.position.x}px, ${config.position.y}px)`,
        width: `${config.size.width}px`,
        height: config.state === 'collapsed' ? 'auto' : `${config.size.height}px`,
        zIndex: config.zIndex,
    }), [config.position, config.size, config.state, config.zIndex]);

    const windowClass = [
        'base-window',
        isDragging ? 'base-window--dragging' : '',
        isResizing ? 'base-window--resizing' : '',
        config.state === 'minimized' ? 'base-window--minimized' : '',
        config.state === 'collapsed' ? 'base-window--collapsed' : '',
        'base-window--focused', // Default focused for styling
    ].filter(Boolean).join(' ');

    const handleDragStart = (e: React.MouseEvent) => {
        if (e.button !== 0) {
            return;
        }
        if ((e.target as HTMLElement).closest('button, input, textarea, select, [role="button"]')) {
            return;
        }
        if (!draggable) return;

        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        initialPosition.current = { ...config.position };

        e.preventDefault();
    };

    const handleTitlebarKeyDown = (event: React.KeyboardEvent) => {
        if ((event.target as HTMLElement).closest('button, input, textarea, select, [role="button"]')) {
            return;
        }

        const action = getKeyboardAction(event, WINDOW_TITLEBAR_KEYBOARD_MAP);
        if (!action) {
            return;
        }

        if (action === 'collapse') {
            event.preventDefault();
            onCollapse?.();
            return;
        }

        if (!draggable || !onUpdatePosition) {
            return;
        }

        const step = event.shiftKey ? 24 : 8;
        const nextPosition = { ...config.position };
        if (action === 'moveLeft') {
            nextPosition.x -= step;
        }
        if (action === 'moveRight') {
            nextPosition.x += step;
        }
        if (action === 'moveUp') {
            nextPosition.y -= step;
        }
        if (action === 'moveDown') {
            nextPosition.y += step;
        }

        event.preventDefault();
        onUpdatePosition(nextPosition);
    };

    const handleDragMove = (e: MouseEvent) => {
        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;

        if (onUpdatePosition) {
            onUpdatePosition({
                x: initialPosition.current.x + deltaX,
                y: initialPosition.current.y + deltaY,
            });
        }
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('mouseup', handleDragEnd);
        } else {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
        }
        return () => {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
        };
    }, [isDragging, onUpdatePosition]);

    const handleResizeStart = (e: React.MouseEvent) => {
        if (!resizable) return;
        e.stopPropagation();
        setIsResizing(true);
        resizeStart.current = { x: e.clientX, y: e.clientY };
        initialSize.current = { ...config.size };
        e.preventDefault();
    };

    const handleResizeKeyDown = (event: React.KeyboardEvent) => {
        if (!resizable || !onUpdateSize) {
            return;
        }

        const action = getKeyboardAction(event, WINDOW_RESIZE_KEYBOARD_MAP);
        if (!action) {
            return;
        }

        const step = event.shiftKey ? 24 : 8;
        const nextSize = { ...config.size };
        if (action === 'shrinkWidth') {
            nextSize.width = Math.max(minWidth, nextSize.width - step);
        }
        if (action === 'growWidth') {
            nextSize.width = nextSize.width + step;
        }
        if (action === 'shrinkHeight') {
            nextSize.height = Math.max(minHeight, nextSize.height - step);
        }
        if (action === 'growHeight') {
            nextSize.height = nextSize.height + step;
        }

        event.preventDefault();
        onUpdateSize(nextSize);
    };

    const handleResizeMove = (e: MouseEvent) => {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;

        if (onUpdateSize) {
            onUpdateSize({
                width: Math.max(minWidth, initialSize.current.width + deltaX),
                height: Math.max(minHeight, initialSize.current.height + deltaY),
            });
        }
    };

    const handleResizeEnd = () => {
        setIsResizing(false);
    };

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
        } else {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        }
        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [isResizing, onUpdateSize]);

    return (
        <div
            className={windowClass}
            style={windowStyle}
            role={ariaRole}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : titleId}
            aria-describedby={contentId}
            data-chips-surface="tool-window"
            onMouseDown={() => onFocus?.()}
            onFocusCapture={() => onFocus?.()}
        >
            <div
                className="base-window__header"
                tabIndex={draggable || onCollapse ? 0 : undefined}
                aria-label={formatMessage('window.titlebar_label', { title: config.title })}
                onMouseDown={handleDragStart}
                onKeyDown={handleTitlebarKeyDown}
            >
                {headerSlot || <span id={titleId} className="base-window__title">{config.title}</span>}

                <div className="base-window__actions" role="toolbar" aria-label={formatMessage('window.actions_label', { title: config.title })}>
                    {actionsSlot || (
                        <>
                            {config.minimizable !== false && (
                                <button
                                    type="button"
                                    className="base-window__action"
                                    aria-label={formatMessage('window.minimize_window', { title: config.title })}
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onMinimize?.(); }}
                                >
                                    <RuntimeIcon className="base-window__action-icon" icon={ENGINE_ICONS.remove} />
                                </button>
                            )}
                            <button
                                type="button"
                                className="base-window__action"
                                aria-label={config.state === 'collapsed'
                                    ? formatMessage('window.expand_window', { title: config.title })
                                    : formatMessage('window.collapse_window', { title: config.title })}
                                aria-expanded={config.state !== 'collapsed'}
                                aria-controls={contentId}
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onCollapse?.(); }}
                            >
                                <RuntimeIcon
                                    className="base-window__action-icon"
                                    icon={config.state === 'collapsed' ? ENGINE_ICONS.chevronDown : ENGINE_ICONS.chevronUp}
                                />
                            </button>
                            {config.closable !== false && (
                                <button
                                    type="button"
                                    className="base-window__action base-window__action--close"
                                    aria-label={formatMessage('window.close_window', { title: config.title })}
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose?.(); }}
                                >
                                    <RuntimeIcon className="base-window__action-icon" icon={ENGINE_ICONS.close} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div
                id={contentId}
                className="base-window__content"
                aria-hidden={config.state === 'collapsed'}
                style={{ display: config.state === 'collapsed' ? 'none' : 'flex' }}
            >
                {children}
            </div>

            {resizable && config.state === 'normal' && (
                <div
                    className="base-window__resize-handle"
                    role="separator"
                    tabIndex={0}
                    aria-label={formatMessage('window.resize_handle_label', { title: config.title })}
                    onMouseDown={handleResizeStart}
                    onKeyDown={handleResizeKeyDown}
                />
            )}
        </div>
    );
});
