import { useCallback, useState, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { globalEventEmitter } from '../core/event-emitter';
import type { LayoutType } from '../types/editor';

interface UseLayoutSwitchOptions {
    enableTransition?: boolean;
    transitionDuration?: number;
    preserveCardState?: boolean;
    onBeforeSwitch?: (from: LayoutType, to: LayoutType) => void;
    onAfterSwitch?: (from: LayoutType, to: LayoutType) => void;
}

export function useLayoutSwitch(options: UseLayoutSwitchOptions = {}) {
    const {
        enableTransition = true,
        transitionDuration = 300,
        preserveCardState = true,
        onBeforeSwitch,
        onAfterSwitch,
    } = options;

    const { layout, setLayout } = useUI();
    const [isSwitching, setIsSwitching] = useState(false);

    const isInfiniteCanvas = layout === 'infinite-canvas';
    const isWorkbench = layout === 'workbench';

    const toggleLayout = useCallback(async () => {
        if (isSwitching) return;

        const from = layout;
        const to: LayoutType = layout === 'infinite-canvas' ? 'workbench' : 'infinite-canvas';

        if (onBeforeSwitch) {
            onBeforeSwitch(from, to);
        }

        globalEventEmitter.emit('layout:before-switch', { from, to });

        setIsSwitching(true);

        try {
            if (preserveCardState) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            setLayout(to);

            if (onAfterSwitch) {
                onAfterSwitch(from, to);
            }

            globalEventEmitter.emit('layout:after-switch', { from, to });
        } finally {
            if (enableTransition) {
                setTimeout(() => {
                    setIsSwitching(false);
                }, transitionDuration);
            } else {
                setIsSwitching(false);
            }
        }
    }, [layout, isSwitching, setLayout, preserveCardState, enableTransition, transitionDuration, onBeforeSwitch, onAfterSwitch]);

    const switchTo = useCallback(async (targetLayout: LayoutType) => {
        if (isSwitching || layout === targetLayout) return;

        const from = layout;
        const to = targetLayout;

        if (onBeforeSwitch) {
            onBeforeSwitch(from, to);
        }

        globalEventEmitter.emit('layout:before-switch', { from, to });

        setIsSwitching(true);

        try {
            if (preserveCardState) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            setLayout(to);

            if (onAfterSwitch) {
                onAfterSwitch(from, to);
            }

            globalEventEmitter.emit('layout:after-switch', { from, to });
        } finally {
            if (enableTransition) {
                setTimeout(() => {
                    setIsSwitching(false);
                }, transitionDuration);
            } else {
                setIsSwitching(false);
            }
        }
    }, [layout, isSwitching, setLayout, preserveCardState, enableTransition, transitionDuration, onBeforeSwitch, onAfterSwitch]);

    useEffect(() => {
        const handleBeforeSwitch = ({ from, to }: { from: LayoutType; to: LayoutType }) => {
            if (onBeforeSwitch) {
                onBeforeSwitch(from, to);
            }
        };

        const handleAfterSwitch = ({ from, to }: { from: LayoutType; to: LayoutType }) => {
            if (onAfterSwitch) {
                onAfterSwitch(from, to);
            }
        };

        const beforeSwitchSubscriptionId = globalEventEmitter.on<{ from: LayoutType; to: LayoutType }>('layout:before-switch', handleBeforeSwitch);
        const afterSwitchSubscriptionId = globalEventEmitter.on<{ from: LayoutType; to: LayoutType }>('layout:after-switch', handleAfterSwitch);

        return () => {
            globalEventEmitter.off('layout:before-switch', beforeSwitchSubscriptionId);
            globalEventEmitter.off('layout:after-switch', afterSwitchSubscriptionId);
        };
    }, [onBeforeSwitch, onAfterSwitch]);

    return {
        layout,
        currentLayout: layout,
        isSwitching,
        isInfiniteCanvas,
        isWorkbench,
        toggleLayout,
        switchTo,
    };
}
