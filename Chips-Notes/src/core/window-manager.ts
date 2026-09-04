/**
 * 窗口管理器
 * @module core/window-manager
 * @description 负责创建、管理、销毁窗口
 */

import { generateScopedId } from '../utils/id';
import { globalEventEmitter } from './event-emitter';
import type {
    CardWindowConfig,
    BoxWindowConfig,
    ToolWindowConfig,
    WindowPosition,
    WindowSize,
    WindowState,
    AnyWindowConfig
} from '../types/window';

export interface WindowManagerOptions {
    defaultCardWindowSize?: WindowSize;
    defaultBoxWindowSize?: WindowSize;
    defaultToolWindowSize?: WindowSize;
    cascadeOffset?: number;
    tileGap?: number;
}

const DEFAULT_OPTIONS: Required<WindowManagerOptions> = {
    defaultCardWindowSize: { width: 400, height: 600 },
    defaultBoxWindowSize: { width: 736, height: 508 },
    defaultToolWindowSize: { width: 300, height: 400 },
    cascadeOffset: 30,
    tileGap: 20,
};

function omitUndefinedOptions<T extends Record<string, unknown>>(options?: Partial<T>): Partial<T> {
    if (!options) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
}

export type WindowManagerState = {
    windows: AnyWindowConfig[];
    focusedWindowId: string | null;
};

export type WindowManagerListener = (state: WindowManagerState) => void;

let windowManagerInstance: WindowManager | null = null;

export class WindowManager {
    private options: Required<WindowManagerOptions>;
    private listeners: Set<WindowManagerListener> = new Set();
    private state: WindowManagerState = {
        windows: [],
        focusedWindowId: null,
    };

    constructor(options: WindowManagerOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state));
        globalEventEmitter.emit('window:state-changed', this.state);
    }

    subscribe(listener: WindowManagerListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getState(): WindowManagerState {
        return { ...this.state };
    }

    private getNextPosition(): WindowPosition {
        const offset = (this.state.windows.length % 10) * this.options.cascadeOffset;
        return {
            x: 100 + offset,
            y: 100 + offset,
        };
    }

    private getMaxZIndex(): number {
        if (this.state.windows.length === 0) return 100;
        return Math.max(...this.state.windows.map(w => w.zIndex));
    }

    private setState(newState: Partial<WindowManagerState>): void {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    setWindows(windows: AnyWindowConfig[]): void {
        this.state.windows = windows;
        this.notify();
    }

    getWindows(): AnyWindowConfig[] {
        return this.state.windows;
    }

    createCardWindow(
        cardId: string,
        options?: Partial<Omit<CardWindowConfig, 'id' | 'type' | 'cardId'>>
    ): string {
        const windowId = generateScopedId('card-window');
        const position = this.getNextPosition();
        const zIndex = this.getMaxZIndex() + 1;
        const normalizedOptions = omitUndefinedOptions(options);

        const config: CardWindowConfig = {
            id: windowId,
            type: 'card',
            title: normalizedOptions.title || 'Untitled Card',
            cardId,
            position: normalizedOptions.position ?? position,
            size: normalizedOptions.size ?? this.options.defaultCardWindowSize,
            state: 'normal',
            zIndex,
            isEditing: false,
            resizable: true,
            draggable: true,
            closable: true,
            minimizable: true,
            ...normalizedOptions,
        };

        this.setWindows([...this.state.windows, config]);
        this.focusWindow(windowId);

        globalEventEmitter.emit('window:created', { windowId, type: 'card', cardId });
        return windowId;
    }

    createBoxWindow(
        boxId: string,
        boxPath: string,
        options?: Partial<Omit<BoxWindowConfig, 'id' | 'type' | 'boxId' | 'boxPath'>>
    ): string {
        const windowId = generateScopedId('box-window');
        const position = this.getNextPosition();
        const zIndex = this.getMaxZIndex() + 1;
        const normalizedOptions = omitUndefinedOptions(options);

        const config: BoxWindowConfig = {
            id: windowId,
            type: 'box',
            title: normalizedOptions.title || 'Untitled Box',
            boxId,
            boxPath,
            position: normalizedOptions.position ?? position,
            size: normalizedOptions.size ?? this.options.defaultBoxWindowSize,
            state: 'normal',
            zIndex,
            resizable: true,
            draggable: true,
            closable: true,
            minimizable: true,
            ...normalizedOptions,
        };

        this.setWindows([...this.state.windows, config]);
        this.focusWindow(windowId);

        globalEventEmitter.emit('window:created', { windowId, type: 'box', boxId, boxPath });
        return windowId;
    }

    createToolWindow(
        component: string,
        options?: Partial<Omit<ToolWindowConfig, 'id' | 'type' | 'component'>>
    ): string {
        const windowId = generateScopedId('tool-window');
        const position = this.getNextPosition();
        const zIndex = this.getMaxZIndex() + 1;
        const normalizedOptions = omitUndefinedOptions(options);

        const config: ToolWindowConfig = {
            id: windowId,
            type: 'tool',
            title: normalizedOptions.title || component,
            component,
            position: normalizedOptions.position ?? position,
            size: normalizedOptions.size ?? this.options.defaultToolWindowSize,
            state: 'normal',
            zIndex,
            icon: normalizedOptions.icon,
            resizable: true,
            draggable: true,
            closable: true,
            minimizable: true,
            dockable: true,
            ...normalizedOptions,
        };

        this.setWindows([...this.state.windows, config]);
        this.focusWindow(windowId);

        globalEventEmitter.emit('window:created', { windowId, type: 'tool', component });
        return windowId;
    }

    closeWindow(windowId: string): void {
        const window = this.getWindow(windowId);
        if (!window) return;

        this.setWindows(this.state.windows.filter(w => w.id !== windowId));

        if (this.state.focusedWindowId === windowId) {
            this.blurWindow();
        }

        globalEventEmitter.emit('window:closed', { windowId, type: window.type });
    }

    focusWindow(windowId: string): void {
        const window = this.getWindow(windowId);
        if (!window) return;

        const zIndex = this.getMaxZIndex() + 1;
        this.setWindows(
            this.state.windows.map(w =>
                w.id === windowId ? { ...w, zIndex } : w
            )
        );
        this.setState({ focusedWindowId: windowId });

        globalEventEmitter.emit('window:focused', { windowId });
    }

    blurWindow(): void {
        this.setState({ focusedWindowId: null });
        globalEventEmitter.emit('window:blurred', {});
    }

    moveWindow(windowId: string, position: WindowPosition): void {
        this.setWindows(
            this.state.windows.map(w =>
                w.id === windowId ? { ...w, position } : w
            )
        );
        globalEventEmitter.emit('window:moved', { windowId, position });
    }

    resizeWindow(windowId: string, size: WindowSize): void {
        this.setWindows(
            this.state.windows.map(w =>
                w.id === windowId ? { ...w, size } : w
            )
        );
        globalEventEmitter.emit('window:resized', { windowId, size });
    }

    updateWindow(windowId: string, updates: Partial<AnyWindowConfig>): void {
        this.setWindows(
            this.state.windows.map(w =>
                w.id === windowId ? { ...w, ...updates } as AnyWindowConfig : w
            )
        );
        globalEventEmitter.emit('window:updated', { windowId, updates });
    }

    setWindowState(windowId: string, state: WindowState): void {
        this.updateWindow(windowId, { state });
        globalEventEmitter.emit('window:state-changed', { windowId, state });
    }

    minimizeWindow(windowId: string): void {
        this.setWindowState(windowId, 'minimized');
    }

    restoreWindow(windowId: string): void {
        this.setWindowState(windowId, 'normal');
    }

    toggleCollapse(windowId: string): void {
        const window = this.getWindow(windowId);
        if (!window) return;

        const newState = window.state === 'collapsed' ? 'normal' : 'collapsed';
        this.setWindowState(windowId, newState);
    }

    getWindow(windowId: string): AnyWindowConfig | undefined {
        return this.state.windows.find(w => w.id === windowId);
    }

    getAllWindows(): AnyWindowConfig[] {
        return [...this.state.windows];
    }

    getCardWindows(): CardWindowConfig[] {
        return this.state.windows.filter(w => w.type === 'card') as CardWindowConfig[];
    }

    getBoxWindows(): BoxWindowConfig[] {
        return this.state.windows.filter(w => w.type === 'box') as BoxWindowConfig[];
    }

    getToolWindows(): ToolWindowConfig[] {
        return this.state.windows.filter(w => w.type === 'tool') as ToolWindowConfig[];
    }

    getFocusedWindow(): AnyWindowConfig | null {
        if (!this.state.focusedWindowId) return null;
        return this.getWindow(this.state.focusedWindowId) || null;
    }

    hasWindow(windowId: string): boolean {
        return this.state.windows.some(w => w.id === windowId);
    }

    tileWindows(options?: {
        windowWidth?: number;
        windowHeight?: number;
        gap?: number;
        startX?: number;
        startY?: number;
    }): void {
        const windows = this.state.windows.filter(w => w.state === 'normal');
        if (windows.length === 0) return;

        const windowWidth = options?.windowWidth ?? 400;
        const windowHeight = options?.windowHeight ?? 300;
        const gap = options?.gap ?? this.options.tileGap;
        const startX = options?.startX ?? 50;
        const startY = options?.startY ?? 50;

        const cols = Math.ceil(Math.sqrt(windows.length));

        windows.forEach((window, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            this.moveWindow(window.id, {
                x: col * (windowWidth + gap) + startX,
                y: row * (windowHeight + gap) + startY,
            });

            this.resizeWindow(window.id, { width: windowWidth, height: windowHeight });
        });
    }

    cascadeWindows(options?: {
        startX?: number;
        startY?: number;
    }): void {
        const windows = this.state.windows.filter(w => w.state === 'normal');
        if (windows.length === 0) return;

        const startX = options?.startX ?? 50;
        const startY = options?.startY ?? 50;

        windows.forEach((window, index) => {
            this.moveWindow(window.id, {
                x: startX + index * this.options.cascadeOffset,
                y: startY + index * this.options.cascadeOffset,
            });
            this.focusWindow(window.id);
        });
    }

    closeAllWindows(): void {
        const windows = [...this.state.windows];
        windows.forEach(window => this.closeWindow(window.id));
    }

    minimizeAllWindows(): void {
        const windows = this.state.windows.filter(w => w.state === 'normal');
        windows.forEach(window => this.minimizeWindow(window.id));
    }

    restoreAllWindows(): void {
        const windows = this.state.windows.filter(w => w.state === 'minimized');
        windows.forEach(window => this.restoreWindow(window.id));
    }

    findWindowByCardId(cardId: string): CardWindowConfig | undefined {
        return this.getCardWindows().find(w => w.cardId === cardId);
    }

    findWindowByBoxId(boxId: string): BoxWindowConfig | undefined {
        return this.getBoxWindows().find(w => w.boxId === boxId);
    }

    findWindowsByComponent(component: string): ToolWindowConfig[] {
        return this.getToolWindows().filter(w => w.component === component);
    }

    reset(): void {
        this.setWindows([]);
        this.setState({ focusedWindowId: null });
        globalEventEmitter.emit('window:reset', {});
    }
}

export function createWindowManager(options?: WindowManagerOptions): WindowManager {
    return new WindowManager(options);
}

export function useWindowManager(): WindowManager {
    if (!windowManagerInstance) {
        windowManagerInstance = createWindowManager();
    }
    return windowManagerInstance;
}

export function getWindowManager(): WindowManager {
    return useWindowManager();
}

export function resetWindowManager(): void {
    if (windowManagerInstance) {
        windowManagerInstance.reset();
    }
    windowManagerInstance = null;
}
