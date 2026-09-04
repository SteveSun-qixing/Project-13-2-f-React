import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCanvas } from '../../layouts/InfiniteCanvas/CanvasContext';
import type { BaseWindowConfig, Position, Size } from '../../types/window';
import './CardWindowBase.css';

export interface CardWindowBaseProps<TWindowConfig extends BaseWindowConfig = BaseWindowConfig> {
    config: TWindowConfig;
    draggable?: boolean;
    resizable?: boolean;
    resizableAxes?: 'x' | 'both';
    heightMode?: 'auto' | 'fixed';
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
    children?: React.ReactNode;
}

export function CardWindowBase<TWindowConfig extends BaseWindowConfig = BaseWindowConfig>({
    config,
    draggable = true,
    resizable = true,
    resizableAxes = 'x',
    heightMode = 'auto',
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
    children,
}: CardWindowBaseProps<TWindowConfig>) {
    const canvasContext = useCanvas();
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const dragStart = useRef({ x: 0, y: 0 });
    const initialPosition = useRef({ x: 0, y: 0 });

    const resizeStart = useRef({ x: 0, y: 0 });
    const initialSize = useRef({ width: 0, height: 0 });

    const windowStyle = useMemo(() => {
        const width = config.size.width;
        const collapsedHeight = Math.round((width * 16) / 9);

        return {
            transform: `translate(${config.position.x}px, ${config.position.y}px)`,
            width: `${width}px`,
            height: config.state === 'collapsed'
                ? `${collapsedHeight}px`
                : (heightMode === 'fixed' ? `${config.size.height}px` : 'auto'),
            zIndex: config.zIndex,
        };
    }, [config.position, config.size.height, config.size.width, config.state, config.zIndex, heightMode]);

    const windowClass = [
        'card-window-base',
        isDragging ? 'card-window-base--dragging' : '',
        isResizing ? 'card-window-base--resizing' : '',
        config.state === 'minimized' ? 'card-window-base--minimized' : '',
        config.state === 'collapsed' ? 'card-window-base--collapsed' : '',
        config.state === 'normal' ? 'card-window-base--normal' : '',
        'card-window-base--focused',
    ].filter(Boolean).join(' ');

    const handleDragStart = (e: React.MouseEvent) => {
        const targetElement = e.target as HTMLElement;
        if (
            targetElement.closest('.card-window-base__action')
            || targetElement.closest('button')
            || targetElement.closest('input')
            || targetElement.closest('textarea')
            || targetElement.closest('select')
            || targetElement.closest('[role="button"]')
        ) {
            return;
        }
        if (!draggable) return;

        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        initialPosition.current = { ...config.position };

        e.preventDefault();
    };

    const handleDragMove = (e: MouseEvent) => {
        const zoom = canvasContext ? canvasContext.zoom : 1;
        const deltaX = (e.clientX - dragStart.current.x) / zoom;
        const deltaY = (e.clientY - dragStart.current.y) / zoom;

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
    }, [isDragging, canvasContext, onUpdatePosition]);

    const handleResizeStart = (e: React.MouseEvent) => {
        if (!resizable) return;
        e.stopPropagation();
        setIsResizing(true);
        resizeStart.current = { x: e.clientX, y: e.clientY };
        initialSize.current = { ...config.size };
        e.preventDefault();
    };

    const handleResizeMove = (e: MouseEvent) => {
        const zoom = canvasContext ? canvasContext.zoom : 1;
        const deltaX = (e.clientX - resizeStart.current.x) / zoom;
        const deltaY = (e.clientY - resizeStart.current.y) / zoom;

        if (onUpdateSize) {
            onUpdateSize({
                width: Math.max(minWidth, initialSize.current.width + deltaX),
                height: resizableAxes === 'both'
                    ? Math.max(minHeight, initialSize.current.height + deltaY)
                    : config.size.height,
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
    }, [isResizing, canvasContext, onUpdateSize]);

    return (
        <div
            className={windowClass}
            style={windowStyle}
            onMouseDown={() => onFocus?.()}
        >
            <div className="card-window-base__header" onMouseDown={handleDragStart}>
                {headerSlot || <span className="card-window-base__title">{config.title}</span>}

                <div className="card-window-base__actions">
                    {actionsSlot || (
                        <>
                            {config.minimizable !== false && (
                                <button
                                    type="button"
                                    className="card-window-base__action"
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onMinimize?.(); }}
                                >
                                    <span className="card-window-base__action-icon">−</span>
                                </button>
                            )}
                            <button
                                type="button"
                                className="card-window-base__action"
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onCollapse?.(); }}
                            >
                                <span className="card-window-base__action-icon">
                                    {config.state === 'collapsed' ? '▽' : '△'}
                                </span>
                            </button>
                            {config.closable !== false && (
                                <button
                                    type="button"
                                    className="card-window-base__action card-window-base__action--close"
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose?.(); }}
                                >
                                    <span className="card-window-base__action-icon">×</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="card-window-base__content">
                {children}
            </div>

            {resizable && (
                <div
                    className={[
                        'card-window-base__resize-handle',
                        resizableAxes === 'both'
                            ? 'card-window-base__resize-handle--both'
                            : 'card-window-base__resize-handle--x',
                    ].join(' ')}
                    onMouseDown={handleResizeStart}
                />
            )}
        </div>
    );
}
