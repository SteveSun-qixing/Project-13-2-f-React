import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AnyWindowConfig, BoxWindowConfig, CardWindowConfig, ToolWindowConfig } from '../types/window';
import { getWindowManager, type WindowManagerState } from '../core/window-manager';
import { globalEventEmitter } from '../core/event-emitter';

interface UIState {
    windows: AnyWindowConfig[];
    focusedWindowId: string | null;
    theme: string;
    dockPosition: 'bottom' | 'left' | 'right';
    dockVisible: boolean;
    layout: 'infinite-canvas' | 'workbench';
}

interface UIContextType extends UIState {
    setTheme: (theme: string) => void;
    setDockPosition: (pos: 'bottom' | 'left' | 'right') => void;
    setDockVisible: (visible: boolean) => void;
    setLayout: (layout: 'infinite-canvas' | 'workbench') => void;
    addWindow: (window: AnyWindowConfig) => void;
    removeWindow: (windowId: string) => void;
    updateWindow: (windowId: string, updates: Partial<AnyWindowConfig>) => void;
    focusWindow: (windowId: string) => void;
    bringToFront: (windowId: string) => void;
    createCardWindow: (cardId: string, options?: Partial<CardWindowConfig>) => string;
    createBoxWindow: (boxId: string, boxPath: string, options?: Partial<BoxWindowConfig>) => string;
    createToolWindow: (component: string, options?: Partial<ToolWindowConfig>) => string;
    closeWindow: (windowId: string) => void;
    tileWindows: () => void;
    cascadeWindows: () => void;
    minimizeAllWindows: () => void;
    restoreAllWindows: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [windows, setWindows] = useState<AnyWindowConfig[]>([]);
    const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
    const [theme, setTheme] = useState('chips-official.default-theme');
    const [dockPosition, setDockPosition] = useState<'bottom' | 'left' | 'right'>('bottom');
    const [dockVisible, setDockVisible] = useState(true);
    const [layout, setLayout] = useState<'infinite-canvas' | 'workbench'>('infinite-canvas');

    const windowManager = getWindowManager();

    useEffect(() => {
        const unsubscribe = windowManager.subscribe((state: WindowManagerState) => {
            setWindows(state.windows);
            setFocusedWindowId(state.focusedWindowId);
        });

        const handleWindowCreated = (data: any) => {
            const state = windowManager.getState();
            setWindows(state.windows);
            if (data.windowId) {
                setFocusedWindowId(data.windowId);
            }
        };

        const handleWindowClosed = (data: any) => {
            const state = windowManager.getState();
            setWindows(state.windows);
            setFocusedWindowId(null);
        };

        const handleWindowFocused = (data: any) => {
            if (data.windowId) {
                setFocusedWindowId(data.windowId);
            }
        };

        globalEventEmitter.on('window:created', handleWindowCreated);
        globalEventEmitter.on('window:closed', handleWindowClosed);
        globalEventEmitter.on('window:focused', handleWindowFocused);

        return () => {
            unsubscribe();
            globalEventEmitter.off('window:created', handleWindowCreated);
            globalEventEmitter.off('window:closed', handleWindowClosed);
            globalEventEmitter.off('window:focused', handleWindowFocused);
        };
    }, [windowManager]);

    const addWindow = useCallback((windowInfo: AnyWindowConfig) => {
        const currentWindows = windowManager.getState().windows;
        windowManager.setWindows([...currentWindows.filter((w: AnyWindowConfig) => w.id !== windowInfo.id), windowInfo]);
    }, [windowManager]);

    const removeWindow = useCallback((windowId: string) => {
        windowManager.closeWindow(windowId);
    }, [windowManager]);

    const updateWindow = useCallback((windowId: string, updates: Partial<AnyWindowConfig>) => {
        windowManager.updateWindow(windowId, updates);
    }, [windowManager]);

    const focusWindow = useCallback((windowId: string) => {
        windowManager.focusWindow(windowId);
    }, [windowManager]);

    const bringToFront = useCallback((windowId: string) => {
        windowManager.focusWindow(windowId);
    }, [windowManager]);

    const createCardWindow = useCallback((cardId: string, options?: Partial<CardWindowConfig>) => {
        return windowManager.createCardWindow(cardId, options);
    }, [windowManager]);

    const createBoxWindow = useCallback((boxId: string, boxPath: string, options?: Partial<BoxWindowConfig>) => {
        return windowManager.createBoxWindow(boxId, boxPath, options);
    }, [windowManager]);

    const createToolWindow = useCallback((component: string, options?: Partial<ToolWindowConfig>) => {
        return windowManager.createToolWindow(component, options);
    }, [windowManager]);

    const closeWindow = useCallback((windowId: string) => {
        windowManager.closeWindow(windowId);
    }, [windowManager]);

    const tileWindows = useCallback(() => {
        windowManager.tileWindows();
    }, [windowManager]);

    const cascadeWindows = useCallback(() => {
        windowManager.cascadeWindows();
    }, [windowManager]);

    const minimizeAllWindows = useCallback(() => {
        windowManager.minimizeAllWindows();
    }, [windowManager]);

    const restoreAllWindows = useCallback(() => {
        windowManager.restoreAllWindows();
    }, [windowManager]);

    return (
        <UIContext.Provider
            value={{
                windows,
                focusedWindowId,
                theme,
                dockPosition,
                dockVisible,
                layout,
                setTheme,
                setDockPosition,
                setDockVisible,
                setLayout,
                addWindow,
                removeWindow,
                updateWindow,
                focusWindow,
                bringToFront,
                createCardWindow,
                createBoxWindow,
                createToolWindow,
                closeWindow,
                tileWindows,
                cascadeWindows,
                minimizeAllWindows,
                restoreAllWindows,
            }}
        >
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
}
