/**
 * 拖放管理器
 * @module core/drag-drop-manager
 * @description 统一管理编辑器中的所有拖放操作
 */

import { guessMimeType } from 'chips-sdk';
import { globalEventEmitter } from './event-emitter';

export type DragSourceType = 'file' | 'card-library' | 'layout-library' | 'base-card' | 'card';

export type DropTargetType = 'canvas' | 'card' | 'card-slot' | 'trash';

export type DropEffect = 'copy' | 'move' | 'link' | 'none';

export type FileDropType = 'image' | 'video' | 'audio' | 'card-file' | 'box-file' | 'document' | 'unknown';

export interface DragSourceConfig {
    type: DragSourceType;
    data: unknown;
    allowedTargets?: DropTargetType[];
    effect?: DropEffect;
    canDrag?: () => boolean;
    onDragStart?: () => void;
    onDragEnd?: (success: boolean) => void;
}

export interface DropTargetConfig {
    type: DropTargetType;
    id: string;
    acceptedSources?: DragSourceType[];
    canDrop?: (source: DragSource) => boolean;
    onDrop?: (source: DragSource, position: Position) => void | Promise<void>;
    onDragEnter?: (source: DragSource) => void;
    onDragLeave?: (source: DragSource) => void;
    onDragOver?: (source: DragSource, position: Position) => void;
}

export interface DragSource {
    id: string;
    type: DragSourceType;
    data: unknown;
    config: DragSourceConfig;
}

export interface DropTarget {
    id: string;
    type: DropTargetType;
    config: DropTargetConfig;
    rect?: DOMRect;
}

export interface Position {
    x: number;
    y: number;
}

export interface InsertPosition {
    targetId: string;
    index: number;
    position: 'before' | 'after' | 'inside';
}

export interface DragDropState {
    isDragging: boolean;
    source: DragSource | null;
    hoverTarget: DropTarget | null;
    position: Position | null;
    insertPosition: InsertPosition | null;
    canDrop: boolean;
    dropEffect: DropEffect;
}

export interface FileDragData {
    files: File[];
    types: FileDropType[];
}

export interface BaseCardDragData {
    cardId: string;
    baseCardId: string;
    baseCardType: string;
    originalIndex: number;
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const AUDIO_MIMES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/aac'];
const DOCUMENT_MIMES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];

export function detectFileType(file: File): FileDropType {
    const { type, name } = file;
    const ext = name.split('.').pop()?.toLowerCase();

    if (ext === 'chip') return 'card-file';
    if (ext === 'box') return 'box-file';

    if (IMAGE_MIMES.includes(type)) return 'image';
    if (VIDEO_MIMES.includes(type)) return 'video';
    if (AUDIO_MIMES.includes(type)) return 'audio';
    if (DOCUMENT_MIMES.includes(type)) return 'document';

    const mimeFromExtension = guessMimeType(name);
    if (mimeFromExtension.startsWith('image/')) return 'image';
    if (mimeFromExtension.startsWith('video/')) return 'video';
    if (mimeFromExtension.startsWith('audio/')) return 'audio';
    if (mimeFromExtension === 'application/pdf' || mimeFromExtension === 'text/plain' || mimeFromExtension === 'text/markdown') {
        return 'document';
    }

    return 'unknown';
}

export function detectFileTypes(files: FileList | File[]): FileDropType[] {
    return Array.from(files).map(detectFileType);
}

let dragDropManagerInstance: DragDropManager | null = null;

export class DragDropManager {
    private sources = new Map<string, DragSourceConfig>();
    private targets = new Map<string, DropTargetConfig>();
    private state: DragDropState = {
        isDragging: false,
        source: null,
        hoverTarget: null,
        position: null,
        insertPosition: null,
        canDrop: false,
        dropEffect: 'none',
    };
    private dragCounter = 0;

    getState(): DragDropState {
        return { ...this.state };
    }

    subscribe(listener: (state: DragDropState) => void): () => void {
        const handler = (): void => listener(this.getState());
        globalEventEmitter.on('dragdrop:state-changed', handler);
        return () => globalEventEmitter.off('dragdrop:state-changed', handler);
    }

    private setState(updates: Partial<DragDropState>): void {
        this.state = { ...this.state, ...updates };
        globalEventEmitter.emit('dragdrop:state-changed', this.state);
        globalEventEmitter.emit('dragdrop:changed', this.state);
    }

    registerSource(id: string, config: DragSourceConfig): void {
        this.sources.set(id, config);
    }

    unregisterSource(id: string): void {
        this.sources.delete(id);
    }

    registerTarget(id: string, config: DropTargetConfig): void {
        this.targets.set(id, config);
    }

    unregisterTarget(id: string): void {
        this.targets.delete(id);
    }

    getSource(id: string): DragSourceConfig | undefined {
        return this.sources.get(id);
    }

    getTarget(id: string): DropTargetConfig | undefined {
        return this.targets.get(id);
    }

    startDrag(config: DragSourceConfig): DragSource {
        if (config.canDrag && !config.canDrag()) {
            throw new Error('Cannot drag this source');
        }

        const id = `drag-${++this.dragCounter}`;
        const source: DragSource = {
            id,
            type: config.type,
            data: config.data,
            config,
        };

        this.setState({
            isDragging: true,
            source,
            hoverTarget: null,
            position: null,
            insertPosition: null,
            canDrop: false,
            dropEffect: config.effect || 'copy',
        });

        config.onDragStart?.();
        globalEventEmitter.emit('dragdrop:started', { source });

        return source;
    }

    updatePosition(position: Position): void {
        if (!this.state.isDragging) return;
        this.setState({ position });
    }

    setHoverTarget(targetId: string | null, rect?: DOMRect): void {
        if (!this.state.isDragging) return;

        if (!targetId) {
            const prevTarget = this.state.hoverTarget;
            if (prevTarget && this.state.source) {
                prevTarget.config.onDragLeave?.(this.state.source);
            }
            this.setState({ hoverTarget: null, canDrop: false });
            return;
        }

        const config = this.targets.get(targetId);
        if (!config) return;

        const target: DropTarget = { id: targetId, type: config.type, config, rect };

        const prevTarget = this.state.hoverTarget;
        if (prevTarget && prevTarget.id !== targetId && this.state.source) {
            prevTarget.config.onDragLeave?.(this.state.source);
        }

        if ((!prevTarget || prevTarget.id !== targetId) && this.state.source) {
            config.onDragEnter?.(this.state.source);
        }

        this.setState({
            hoverTarget: target,
            canDrop: this.state.source ? this.checkCanDrop(this.state.source, target) : false,
        });
    }

    setInsertPosition(insertPosition: InsertPosition | null): void {
        if (!this.state.isDragging) return;
        this.setState({ insertPosition });
    }

    async drop(): Promise<boolean> {
        const { source, hoverTarget, position, canDrop } = this.state;

        if (!source || !hoverTarget || !canDrop || !position) {
            this.endDrag(false);
            return false;
        }

        try {
            await hoverTarget.config.onDrop?.(source, position);
            this.endDrag(true);
            return true;
        } catch (error) {
            console.error('[DragDropManager] Drop failed:', error);
            this.endDrag(false);
            return false;
        }
    }

    async handleDrop(source: DragSource, target: DropTarget, position: Position): Promise<boolean> {
        if (!this.checkCanDrop(source, target)) {
            return false;
        }

        try {
            await target.config.onDrop?.(source, position);
            return true;
        } catch (error) {
            console.error('[DragDropManager] Drop failed:', error);
            return false;
        }
    }

    endDrag(success = false): void {
        const source = this.state.source;
        const hoverTarget = this.state.hoverTarget;

        if (hoverTarget && source) {
            hoverTarget.config.onDragLeave?.(source);
        }

        source?.config.onDragEnd?.(success);

        this.setState({
            isDragging: false,
            source: null,
            hoverTarget: null,
            position: null,
            insertPosition: null,
            canDrop: false,
            dropEffect: 'none',
        });

        globalEventEmitter.emit('dragdrop:ended', { success });
    }

    cancelDrag(): void {
        this.endDrag(false);
    }

    checkCanDrop(source: DragSource, target: DropTarget): boolean {
        const { acceptedSources, canDrop } = target.config;

        if (acceptedSources && !acceptedSources.includes(source.type)) {
            return false;
        }

        const { allowedTargets } = source.config;
        if (allowedTargets && !allowedTargets.includes(target.type)) {
            return false;
        }

        if (canDrop && !canDrop(source)) {
            return false;
        }

        return true;
    }

    calculateInsertIndex(
        items: Array<{ rect: DOMRect; id: string }>,
        position: Position,
        direction: 'horizontal' | 'vertical' = 'vertical'
    ): number {
        if (items.length === 0) return 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;
            const { rect } = item;

            if (direction === 'vertical') {
                const midY = rect.top + rect.height / 2;
                if (position.y < midY) return i;
            } else {
                const midX = rect.left + rect.width / 2;
                if (position.x < midX) return i;
            }
        }

        return items.length;
    }

    isPointInRect(position: Position, rect: DOMRect): boolean {
        return (
            position.x >= rect.left &&
            position.x <= rect.right &&
            position.y >= rect.top &&
            position.y <= rect.bottom
        );
    }

    findTargetAtPoint(position: Position, targetRects: Map<string, DOMRect>): string | null {
        for (const [id, rect] of targetRects) {
            if (this.isPointInRect(position, rect)) {
                return id;
            }
        }
        return null;
    }

    reset(): void {
        this.setState({
            isDragging: false,
            source: null,
            hoverTarget: null,
            position: null,
            insertPosition: null,
            canDrop: false,
            dropEffect: 'none',
        });
    }
}

export function createDragDropManager(): DragDropManager {
    return new DragDropManager();
}

export function useDragDropManager(): DragDropManager {
    if (!dragDropManagerInstance) {
        dragDropManagerInstance = createDragDropManager();
    }
    return dragDropManagerInstance;
}

export function getDragDropManager(): DragDropManager {
    return useDragDropManager();
}

export function resetDragDropManager(): void {
    if (dragDropManagerInstance) {
        dragDropManagerInstance.reset();
    }
    dragDropManagerInstance = null;
}
