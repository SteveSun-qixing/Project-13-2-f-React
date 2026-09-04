import React, { useCallback, useMemo } from 'react';
import { Empty } from 'antd';
import { DockItem } from './DockItem';
import { useUI } from '../../context/UIContext';
import { ENGINE_ICONS } from '../../icons/descriptors';
import './Dock.css';

export interface DockProps {
    onOpenSettings?: () => void;
}

export const Dock = React.memo(function Dock({ onOpenSettings }: DockProps) {
    const { dockPosition, dockVisible, windows, focusWindow, updateWindow } = useUI();

    const allTools = windows.filter(w => w.type === 'tool');

    const minimizedToolIds = useMemo(
        () => new Set(
            windows
                .filter(w => w.type === 'tool' && w.state === 'minimized')
                .map(w => w.id),
        ),
        [windows],
    );

    const handleToolClick = useCallback((toolId: string) => {
        const tool = windows.find(w => w.id === toolId);
        if (!tool) return;
        if (tool.state === 'minimized') {
            updateWindow(toolId, { state: 'normal' });
        }
        focusWindow(toolId);
    }, [focusWindow, updateWindow, windows]);

    const handleOpenSettings = useCallback(() => {
        onOpenSettings?.();
    }, [onOpenSettings]);

    if (!dockVisible) return null;

    return (
        <div
            className={`dock dock--${dockPosition}`}
            role="toolbar"
            aria-label="工作台程序坞"
            data-chips-surface="dock"
        >
            {windows.length === 0 && (
                <div
                    role="status"
                    style={
                        dockPosition === 'bottom'
                            ? { display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', color: '#86868b' }
                            : { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0', color: '#86868b', maxWidth: 96 }
                    }
                >
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        imageStyle={{ height: 28 }}
                        description={null}
                        style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>打开或新建卡片开始编辑</span>
                </div>
            )}

            {allTools.map((tool) => (
                <DockItem
                    key={tool.id}
                    toolId={tool.id}
                    icon={tool.icon}
                    title={tool.title}
                    minimized={minimizedToolIds.has(tool.id)}
                    onRestore={handleToolClick}
                />
            ))}

            {allTools.length > 0 && <div className="dock__divider" role="separator" aria-orientation={dockPosition === 'bottom' ? 'vertical' : 'horizontal'} />}

            <DockItem
                toolId="__engine-settings__"
                icon={ENGINE_ICONS.settings}
                title="引擎设置"
                minimized={false}
                onRestore={handleOpenSettings}
            />
        </div>
    );
});
