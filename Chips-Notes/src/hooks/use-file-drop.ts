import { useCallback, useState, type DragEvent } from 'react';
import { detectFileTypes, type FileDragData } from '../core/drag-drop-manager';

interface UseFileDropOptions {
    disabled?: boolean;
    onDrop?: (data: FileDragData) => void;
}

export function useFileDrop(options: UseFileDropOptions = {}) {
    const { disabled = false, onDrop } = options;
    const [isFileDragOver, setIsFileDragOver] = useState(false);

    const handleDragEnter = useCallback((event: DragEvent) => {
        if (disabled) return;
        const hasFiles = event.dataTransfer?.types.includes('Files');
        if (hasFiles) {
            setIsFileDragOver(true);
        }
    }, [disabled]);

    const handleDragOver = useCallback((event: DragEvent) => {
        if (disabled) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    }, [disabled]);

    const handleDragLeave = useCallback((event: DragEvent) => {
        if (disabled) return;
        const relatedTarget = event.relatedTarget as HTMLElement;
        if (!relatedTarget || !(event.currentTarget as HTMLElement).contains(relatedTarget)) {
            setIsFileDragOver(false);
        }
    }, [disabled]);

    const handleDrop = useCallback((event: DragEvent): FileDragData | null => {
        if (disabled) return null;
        event.preventDefault();
        setIsFileDragOver(false);

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return null;

        const types = detectFileTypes(Array.from(files));
        const data: FileDragData = {
            files: Array.from(files),
            types,
        };

        if (onDrop) {
            onDrop(data);
        }

        return data;
    }, [disabled, onDrop]);

    return {
        isFileDragOver,
        handleDragEnter,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
