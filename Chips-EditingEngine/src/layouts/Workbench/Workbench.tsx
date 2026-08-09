import React, { useCallback, useState, useEffect } from 'react';
import { SidePanel } from './SidePanel';
import { MainArea, type TabInfo } from './MainArea';
import { formatMessage } from '../../lib/messages';
import './Workbench.css';

const LEFT_PANEL_PLACEHOLDER = (
    <div className="workbench__placeholder" role="status">
        {formatMessage('workbench.left_panel_empty')}
    </div>
);

const RIGHT_PANEL_PLACEHOLDER = (
    <div className="workbench__placeholder" role="status">
        {formatMessage('workbench.right_panel_empty')}
    </div>
);

export interface WorkbenchLayoutConfig {
    leftPanelWidth?: number;
    rightPanelWidth?: number;
    leftPanelExpanded?: boolean;
    rightPanelExpanded?: boolean;
    showLeftPanel?: boolean;
    showRightPanel?: boolean;
}

export interface WorkbenchProps {
    initialConfig?: WorkbenchLayoutConfig;
    onLayoutChange?: (config: WorkbenchLayoutConfig) => void;
    activeTabId?: string | null;
    tabs?: TabInfo[];
    onTabChange?: (tabId: string) => void;
    onTabClose?: (tabId: string) => void;
    leftPanelContent?: React.ReactNode;
    rightPanelContent?: React.ReactNode;
    tabContentRenderer?: (tab: TabInfo) => React.ReactNode;
    emptyActionsSlot?: React.ReactNode;
}

export function Workbench({
    initialConfig = {},
    onLayoutChange,
    activeTabId,
    tabs = [],
    onTabChange,
    onTabClose,
    leftPanelContent,
    rightPanelContent,
    tabContentRenderer,
    emptyActionsSlot,
}: WorkbenchProps) {
    const [config, setConfig] = useState<WorkbenchLayoutConfig>({
        leftPanelWidth: 280,
        rightPanelWidth: 320,
        leftPanelExpanded: true,
        rightPanelExpanded: true,
        showLeftPanel: true,
        showRightPanel: true,
        ...initialConfig,
    });

    const {
        leftPanelWidth = 280,
        rightPanelWidth = 320,
        leftPanelExpanded = true,
        rightPanelExpanded = true,
        showLeftPanel = true,
        showRightPanel = true,
    } = config;

    const updateConfig = useCallback((updates: Partial<WorkbenchLayoutConfig>) => {
        const nextConfig = { ...config, ...updates };
        setConfig(nextConfig);
        onLayoutChange?.(nextConfig);
    }, [config, onLayoutChange]);

    const handleLeftPanelWidthChange = useCallback((width: number) => updateConfig({ leftPanelWidth: width }), [updateConfig]);
    const handleLeftPanelExpandedChange = useCallback((expanded: boolean) => updateConfig({ leftPanelExpanded: expanded }), [updateConfig]);
    const handleRightPanelWidthChange = useCallback((width: number) => updateConfig({ rightPanelWidth: width }), [updateConfig]);
    const handleRightPanelExpandedChange = useCallback((expanded: boolean) => updateConfig({ rightPanelExpanded: expanded }), [updateConfig]);

    const handleCloseTabLabel = useCallback((title: string) => formatMessage('workbench.close_tab', { title }), []);
    const handlePreviewFallbackLabel = useCallback((title: string) => formatMessage('workbench.preview_fallback', { title }), []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                updateConfig({ leftPanelExpanded: !leftPanelExpanded });
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                updateConfig({ rightPanelExpanded: !rightPanelExpanded });
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [leftPanelExpanded, rightPanelExpanded, updateConfig]);

    const workbenchStyle = {
        '--left-panel-width': `${leftPanelExpanded ? leftPanelWidth : 40}px`,
        '--right-panel-width': `${rightPanelExpanded ? rightPanelWidth : 40}px`,
    } as React.CSSProperties;

    return (
        <div
            className="workbench"
            style={workbenchStyle}
            role="group"
            aria-label={formatMessage('workbench.aria_label')}
            data-chips-surface="workbench"
        >
            {showLeftPanel && (
                <SidePanel
                    position="left"
                    width={leftPanelWidth}
                    expanded={leftPanelExpanded}
                    minWidth={180}
                    maxWidth={480}
                    title={formatMessage('workbench.left_panel_title')}
                    toggleLabel={leftPanelExpanded
                        ? formatMessage('workbench.left_panel_collapse')
                        : formatMessage('workbench.left_panel_expand')}
                    collapsedLabel={formatMessage('workbench.left_panel_expand')}
                    resizeLabel={formatMessage('workbench.left_panel_resize')}
                    onWidthChange={handleLeftPanelWidthChange}
                    onExpandedChange={handleLeftPanelExpandedChange}
                >
                    {leftPanelContent || LEFT_PANEL_PLACEHOLDER}
                </SidePanel>
            )}

            <MainArea
                activeTabId={activeTabId}
                tabs={tabs}
                showTabs={true}
                ariaLabel={formatMessage('workbench.main_area_label')}
                tabListLabel={formatMessage('workbench.tabs_label')}
                emptyText={formatMessage('workbench.empty_text')}
                modifiedLabel={formatMessage('workbench.tab_modified')}
                closeTabLabel={handleCloseTabLabel}
                previewFallbackLabel={handlePreviewFallbackLabel}
                onTabChange={onTabChange}
                onTabClose={onTabClose}
                tabContentRenderer={tabContentRenderer}
                emptyActionsSlot={emptyActionsSlot}
            />

            {showRightPanel && (
                <SidePanel
                    position="right"
                    width={rightPanelWidth}
                    expanded={rightPanelExpanded}
                    minWidth={200}
                    maxWidth={500}
                    title={formatMessage('workbench.right_panel_title')}
                    toggleLabel={rightPanelExpanded
                        ? formatMessage('workbench.right_panel_collapse')
                        : formatMessage('workbench.right_panel_expand')}
                    collapsedLabel={formatMessage('workbench.right_panel_expand')}
                    resizeLabel={formatMessage('workbench.right_panel_resize')}
                    onWidthChange={handleRightPanelWidthChange}
                    onExpandedChange={handleRightPanelExpandedChange}
                >
                    {rightPanelContent || RIGHT_PANEL_PLACEHOLDER}
                </SidePanel>
            )}
        </div>
    );
}
