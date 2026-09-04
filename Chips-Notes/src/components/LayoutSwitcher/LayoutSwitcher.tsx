import React, { useCallback } from 'react';
import { useLayoutSwitch } from '../../hooks/use-layout-switch';
import { getLayoutSwitcherIcon } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import type { LayoutType } from '../../types/editor';

interface LayoutSwitcherProps {
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
    disabled?: boolean;
    onBeforeSwitch?: (from: LayoutType, to: LayoutType) => void;
    onAfterSwitch?: (from: LayoutType, to: LayoutType) => void;
}

export function LayoutSwitcher({
    size = 'medium',
    showLabel = true,
    disabled = false,
    onBeforeSwitch,
    onAfterSwitch,
}: LayoutSwitcherProps) {
    const {
        currentLayout,
        isSwitching,
        isInfiniteCanvas,
        toggleLayout,
    } = useLayoutSwitch({
        enableTransition: true,
        transitionDuration: 300,
        preserveCardState: true,
        onBeforeSwitch,
        onAfterSwitch,
    });

    const handleClick = useCallback(async () => {
        if (disabled || isSwitching) return;
        await toggleLayout();
    }, [disabled, isSwitching, toggleLayout]);

    const currentLabel = isInfiniteCanvas
        ? '无限画布'
        : '工作台';
    const targetLabel = isInfiniteCanvas
        ? '切换到工作台'
        : '切换到无限画布';

    const sizeClass = `layout-switcher__button--${size}`;
    const switchingClass = isSwitching ? 'layout-switcher__button--switching' : '';

    return (
        <div className="layout-switcher">
            <button
                type="button"
                className={`layout-switcher__button ${sizeClass} ${switchingClass}`}
                onClick={handleClick}
                disabled={disabled || isSwitching}
                title={targetLabel}
            >
                <span className="layout-switcher__icon">
                    <RuntimeIcon icon={getLayoutSwitcherIcon(currentLayout)} />
                </span>
                {showLabel && (
                    <span className="layout-switcher__label">{currentLabel}</span>
                )}
            </button>
        </div>
    );
}
