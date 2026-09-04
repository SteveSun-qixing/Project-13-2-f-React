import React, { Suspense, useCallback } from 'react';
import { BaseWindow } from './BaseWindow';
import { useUI } from '../../context/UIContext';
import { ToolComponentRegistry } from '../ToolComponentRegistry';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import { formatMessage } from '../../lib/messages';
import type { Position, Size, ToolWindowConfig } from '../../types/window';
import './ToolWindow.css';

interface ToolWindowProps {
    config: ToolWindowConfig;
}

export const ToolWindow = React.memo(function ToolWindow({ config }: ToolWindowProps) {
    const { updateWindow, removeWindow, bringToFront } = useUI();

    const handleFocus = useCallback(() => {
        bringToFront(config.id);
    }, [bringToFront, config.id]);

    const handleUpdatePosition = useCallback((position: Position) => {
        updateWindow(config.id, { position });
    }, [config.id, updateWindow]);

    const handleUpdateSize = useCallback((size: Size) => {
        updateWindow(config.id, { size });
    }, [config.id, updateWindow]);

    const handleClose = useCallback(() => {
        removeWindow(config.id);
    }, [config.id, removeWindow]);

    const handleCollapse = useCallback(() => {
        updateWindow(config.id, {
            state: config.state === 'collapsed' ? 'normal' : 'collapsed'
        });
    }, [config.id, config.state, updateWindow]);

    const handleMinimize = useCallback(() => {
        updateWindow(config.id, { state: 'minimized' });
    }, [config.id, updateWindow]);

    const ToolComponent = ToolComponentRegistry[config.component];

    return (
        <BaseWindow
            config={config}
            onFocus={handleFocus}
            onUpdatePosition={handleUpdatePosition}
            onUpdateSize={handleUpdateSize}
            onClose={handleClose}
            onCollapse={handleCollapse}
            onMinimize={handleMinimize}
            ariaLabel={formatMessage('tool_window.aria_label', { title: config.title })}
            headerSlot={
                <div className="tool-window__header">
                    {config.icon && <RuntimeIcon className="tool-window__icon" icon={config.icon} />}
                    <span className="tool-window__title">{config.title}</span>
                </div>
            }
        >
            <div className="tool-window__content">
                <Suspense fallback={<div className="tool-window__loading" role="status">{formatMessage('tool_window.loading')}</div>}>
                    {ToolComponent ? (
                        React.createElement(ToolComponent as any, {
                            visible: true,
                            onClose: handleClose
                        })
                    ) : (
                        <div className="tool-window__missing" role="alert">
                            {formatMessage('tool_window.missing_component', { component: config.component })}
                        </div>
                    )}
                </Suspense>
            </div>
        </BaseWindow>
    );
});
