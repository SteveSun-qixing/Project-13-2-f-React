import React, { useState, useCallback, type DragEvent, type ReactNode } from 'react';
import { useFileDrop } from '../../hooks/use-file-drop';
import type { FileDragData, FileDropType } from '../../core/drag-drop-manager';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './FileDropZone.css';

interface FileDropZoneProps {
    disabled?: boolean;
    acceptTypes?: FileDropType[];
    overlay?: boolean;
    onDrop?: (data: FileDragData) => void;
    onDragStateChange?: (isDragOver: boolean) => void;
    children?: ReactNode;
}

export function FileDropZone({
    disabled = false,
    acceptTypes,
    overlay = false,
    onDrop,
    onDragStateChange,
    children,
}: FileDropZoneProps) {
    const [localDragOver, setLocalDragOver] = useState(false);

    const handleDragEnter = useCallback((event: DragEvent) => {
        if (disabled) return;
        setLocalDragOver(true);
        onDragStateChange?.(true);
    }, [disabled, onDragStateChange]);

    const handleDragOver = useCallback((event: DragEvent) => {
        if (disabled) return;
        event.preventDefault();
    }, [disabled]);

    const handleDragLeave = useCallback((event: DragEvent) => {
        const relatedTarget = event.relatedTarget as HTMLElement;
        if (!relatedTarget || !(event.currentTarget as HTMLElement).contains(relatedTarget)) {
            setLocalDragOver(false);
            onDragStateChange?.(false);
        }
    }, [disabled, onDragStateChange]);

    const handleDrop = useCallback((data: FileDragData | null) => {
        if (disabled || !data) return;

        setLocalDragOver(false);
        onDragStateChange?.(false);

        if (acceptTypes && acceptTypes.length > 0) {
            const isAccepted = data.types.some(t => acceptTypes.includes(t));
            if (!isAccepted) {
                console.warn('File types not accepted:', data.types);
                return;
            }
        }

        onDrop?.(data);
    }, [disabled, acceptTypes, onDrop, onDragStateChange]);

    const { handleDrop: doHandleDrop } = useFileDrop({
        disabled,
        onDrop: handleDrop,
    });

    const isDragOverActive = !disabled && localDragOver;

    return (
        <div
            className={`file-drop-zone ${isDragOverActive ? 'file-drop-zone--active' : ''} ${disabled ? 'file-drop-zone--disabled' : ''} ${overlay ? 'file-drop-zone--overlay' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={doHandleDrop}
        >
            {children}

            {isDragOverActive && (
                <div className="file-drop-zone__overlay">
                    <div className="file-drop-zone__indicator">
                        <span className="file-drop-zone__icon">
                            <RuntimeIcon icon={ENGINE_ICONS.upload} />
                        </span>
                        <span className="file-drop-zone__text">
                            将文件拖放到此处
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
