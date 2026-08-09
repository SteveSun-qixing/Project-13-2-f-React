import React, { ReactNode, useCallback } from 'react';
import { CardWindow } from '../../components/CardWindow/CardWindow';
import { BoxWindow } from '../../components/BoxWindow/BoxWindow';
import { useUI } from '../../context/UIContext';
import type { BoxWindowConfig, CardWindowConfig } from '../../types/window';
import './DesktopLayer.css';

interface DesktopLayerProps {
    style?: React.CSSProperties;
    children?: ReactNode;
}

interface CardWindowSlotProps {
    window: CardWindowConfig;
    onUpdateConfig: (windowId: string, updates: Partial<CardWindowConfig>) => void;
    onClose: (windowId: string) => void;
    onFocus: (windowId: string) => void;
}

function CardWindowSlot({ window, onUpdateConfig, onClose, onFocus }: CardWindowSlotProps) {
    const handleUpdateConfig = useCallback(
        (updates: Partial<CardWindowConfig>) => onUpdateConfig(window.id, updates),
        [onUpdateConfig, window.id],
    );
    const handleClose = useCallback(() => onClose(window.id), [onClose, window.id]);
    const handleFocus = useCallback(() => onFocus(window.id), [onFocus, window.id]);

    return (
        <CardWindow
            config={window}
            onUpdateConfig={handleUpdateConfig}
            onClose={handleClose}
            onFocus={handleFocus}
        />
    );
}

interface BoxWindowSlotProps {
    window: BoxWindowConfig;
    onUpdateConfig: (windowId: string, updates: Partial<BoxWindowConfig>) => void;
    onClose: (windowId: string) => void;
    onFocus: (windowId: string) => void;
}

function BoxWindowSlot({ window, onUpdateConfig, onClose, onFocus }: BoxWindowSlotProps) {
    const handleUpdateConfig = useCallback(
        (updates: Partial<BoxWindowConfig>) => onUpdateConfig(window.id, updates),
        [onUpdateConfig, window.id],
    );
    const handleClose = useCallback(() => onClose(window.id), [onClose, window.id]);
    const handleFocus = useCallback(() => onFocus(window.id), [onFocus, window.id]);

    return (
        <BoxWindow
            config={window}
            onUpdateConfig={handleUpdateConfig}
            onClose={handleClose}
            onFocus={handleFocus}
        />
    );
}

export function DesktopLayer({ style, children }: DesktopLayerProps) {
    const { windows, updateWindow, removeWindow, bringToFront } = useUI();

    const handleUpdateCardConfig = useCallback((windowId: string, updates: Partial<CardWindowConfig>) => {
        updateWindow(windowId, updates);
    }, [updateWindow]);

    const handleUpdateBoxConfig = useCallback((windowId: string, updates: Partial<BoxWindowConfig>) => {
        updateWindow(windowId, updates);
    }, [updateWindow]);

    const handleCloseWindow = useCallback((windowId: string) => {
        removeWindow(windowId);
    }, [removeWindow]);

    const handleFocusWindow = useCallback((windowId: string) => {
        bringToFront(windowId);
    }, [bringToFront]);

    const visibleCardWindows = windows
        .filter((window): window is CardWindowConfig => window.type === 'card' && window.state !== 'minimized')
        .sort((left, right) => left.zIndex - right.zIndex);
    const visibleBoxWindows = windows
        .filter((window): window is BoxWindowConfig => window.type === 'box' && window.state !== 'minimized')
        .sort((left, right) => left.zIndex - right.zIndex);

    return (
        <div className="desktop-layer" style={style}>
            {children}
            {visibleCardWindows.map((window) => (
                <CardWindowSlot
                    key={window.id}
                    window={window}
                    onUpdateConfig={handleUpdateCardConfig}
                    onClose={handleCloseWindow}
                    onFocus={handleFocusWindow}
                />
            ))}
            {visibleBoxWindows.map((window) => (
                <BoxWindowSlot
                    key={window.id}
                    window={window}
                    onUpdateConfig={handleUpdateBoxConfig}
                    onClose={handleCloseWindow}
                    onFocus={handleFocusWindow}
                />
            ))}
        </div>
    );
}
