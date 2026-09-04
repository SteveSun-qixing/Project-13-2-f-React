import React, { ReactNode } from 'react';
import { useUI } from '../../context/UIContext';
import { ToolWindow } from '../../components/BaseWindow/ToolWindow';
import './WindowLayer.css';

interface WindowLayerProps {
    onOpenSettings?: () => void;
    children?: ReactNode;
}

export function WindowLayer({ onOpenSettings }: WindowLayerProps) {
    const { windows } = useUI();
    void onOpenSettings;

    // Filter windows to render in this layer (non-minimized tool windows)
    const visibleToolWindows = windows.filter(
        w => w.type === 'tool' && w.state !== 'minimized'
    );

    return (
        <div className="window-layer">
            {/* Tool Windows */}
            {visibleToolWindows.map((window) => (
                <ToolWindow key={window.id} config={window as any} />
            ))}
        </div>
    );
}
