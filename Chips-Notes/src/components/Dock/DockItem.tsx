import React, { useState } from 'react';
import type { IconDescriptor } from 'chips-sdk';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './DockItem.css';

export interface DockItemProps {
    toolId: string;
    icon?: IconDescriptor;
    title: string;
    minimized?: boolean;
    onRestore: (toolId: string) => void;
}

export function DockItem({ toolId, icon, title, minimized = false, onRestore }: DockItemProps) {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const tooltipId = `dock-item-tooltip-${toolId}`;

    return (
        <div
            className={`dock-item ${minimized ? 'dock-item--minimized' : ''}`}
            onMouseEnter={() => setIsTooltipVisible(true)}
            onMouseLeave={() => setIsTooltipVisible(false)}
        >
            <button
                type="button"
                className="dock-item__btn"
                title="" // We use custom tooltip
                aria-label={title}
                aria-describedby={isTooltipVisible ? tooltipId : undefined}
                aria-pressed={!minimized}
                onFocus={() => setIsTooltipVisible(true)}
                onBlur={() => setIsTooltipVisible(false)}
                onClick={() => onRestore(toolId)}
            >
                <div className="dock-item__icon-wrapper">
                    <span className="dock-item__icon">
                        <RuntimeIcon icon={icon} fallbackIcon={ENGINE_ICONS.settings} />
                    </span>
                </div>
            </button>

            {/* Tooltip */}
            {isTooltipVisible && (
                <div id={tooltipId} className="dock-item__tooltip" role="tooltip">
                    {title}
                </div>
            )}
        </div>
    );
}
