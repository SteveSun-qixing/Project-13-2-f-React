import React from 'react';
import { createKeyboardMap, createRovingTabIndex } from '../../utils/a11y';
import type { IconDescriptor } from 'chips-sdk';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './MainArea.css';

const MAIN_AREA_TAB_KEYBOARD_MAP = createKeyboardMap({
    activate: ['Enter', ' '],
});

export interface TabInfo {
    id: string;
    title: string;
    modified?: boolean;
    closable?: boolean;
    icon?: IconDescriptor;
}

export interface MainAreaProps {
    activeTabId?: string | null;
    tabs?: TabInfo[];
    showTabs?: boolean;
    emptyText?: string;
    emptyIcon?: IconDescriptor;
    ariaLabel?: string;
    tabListLabel?: string;
    modifiedLabel?: string;
    closeTabLabel?: (title: string) => string;
    previewFallbackLabel?: (title: string) => string;
    onTabChange?: (tabId: string) => void;
    onTabClose?: (tabId: string) => void;
    tabContentRenderer?: (tab: TabInfo) => React.ReactNode;
    emptyActionsSlot?: React.ReactNode;
}

export const MainArea = React.memo(function MainArea({
    activeTabId,
    tabs = [],
    showTabs = true,
    emptyText = '无已打开的卡片',
    emptyIcon = ENGINE_ICONS.document,
    ariaLabel,
    tabListLabel,
    modifiedLabel = 'Modified',
    closeTabLabel,
    previewFallbackLabel,
    onTabChange,
    onTabClose,
    tabContentRenderer,
    emptyActionsSlot,
}: MainAreaProps) {
    const hasTabs = tabs.length > 0;
    const tabRefs = React.useRef(new Map<string, HTMLDivElement>());
    const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTabId));
    const rovingModel = React.useMemo(
        () => createRovingTabIndex(
            tabs.map((tab) => ({ id: tab.id })),
            {
                activeIndex,
                orientation: 'horizontal',
                loop: false,
            },
        ),
        [activeIndex, tabs],
    );

    const setTabRef = React.useCallback((tabId: string) => (node: HTMLDivElement | null) => {
        if (node) {
            tabRefs.current.set(tabId, node);
        } else {
            tabRefs.current.delete(tabId);
        }
    }, []);

    const handleTabMiddleClick = (e: React.MouseEvent, tabId: string) => {
        if (e.button === 1) {
            e.preventDefault();
            onTabClose?.(tabId);
        }
    };

    const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
        e.preventDefault();
    };

    const handleTabKeyDown = (event: React.KeyboardEvent, tab: TabInfo) => {
        const nextIndex = rovingModel.getIndexByKey(event, { orientation: 'horizontal', loop: false });
        if (nextIndex >= 0) {
            event.preventDefault();
            const nextTab = tabs[nextIndex];
            if (!nextTab) {
                return;
            }
            onTabChange?.(nextTab.id);
            requestAnimationFrame(() => {
                tabRefs.current.get(nextTab.id)?.focus();
            });
            return;
        }

        const action = MAIN_AREA_TAB_KEYBOARD_MAP.getAction(event);
        if (action === 'activate') {
            event.preventDefault();
            onTabChange?.(tab.id);
        }
    };

    return (
        <main className="main-area" aria-label={ariaLabel}>
            {showTabs && hasTabs && (
                <div className="main-area__tabs" role="tablist" aria-label={tabListLabel}>
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            ref={setTabRef(tab.id)}
                            className={`main-area__tab ${activeTabId === tab.id ? 'main-area__tab--active' : ''} ${tab.modified ? 'main-area__tab--modified' : ''}`}
                            role="tab"
                            id={`main-area-tab-${tab.id}`}
                            aria-selected={activeTabId === tab.id}
                            aria-controls={`main-area-panel-${tab.id}`}
                            tabIndex={activeTabId === tab.id ? 0 : -1}
                            onClick={() => onTabChange?.(tab.id)}
                            onMouseDown={e => handleTabMiddleClick(e, tab.id)}
                            onContextMenu={e => handleTabContextMenu(e, tab.id)}
                            onKeyDown={e => handleTabKeyDown(e, tab)}
                        >
                            {tab.icon && (
                                <span className="main-area__tab-icon">
                                    <RuntimeIcon icon={tab.icon} />
                                </span>
                            )}
                            <span className="main-area__tab-title">{tab.title}</span>
                            {tab.modified && (
                                <span className="main-area__tab-indicator" aria-label={modifiedLabel}>
                                    ●
                                </span>
                            )}
                            {tab.closable && (
                                <button
                                    type="button"
                                    className="main-area__tab-close"
                                    aria-label={closeTabLabel?.(tab.title) ?? `Close ${tab.title}`}
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        onTabClose?.(tab.id);
                                    }}
                                >
                                    <RuntimeIcon icon={ENGINE_ICONS.close} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="main-area__content">
                {hasTabs ? (
                    tabs.map(tab => (
                        <div
                            key={tab.id}
                            id={`main-area-panel-${tab.id}`}
                            className="main-area__panel"
                            role="tabpanel"
                            style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
                            aria-hidden={activeTabId !== tab.id}
                            aria-labelledby={`main-area-tab-${tab.id}`}
                        >
                            {tabContentRenderer ? tabContentRenderer(tab) : (
                                <div className="main-area__card-preview">
                                    <p>{previewFallbackLabel?.(tab.title) ?? tab.title}</p>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="main-area__empty" role="status">
                        <span className="main-area__empty-icon" aria-hidden="true">
                            <RuntimeIcon icon={emptyIcon} />
                        </span>
                        <p className="main-area__empty-text">{emptyText}</p>
                        {emptyActionsSlot}
                    </div>
                )}
            </div>
        </main>
    );
});
