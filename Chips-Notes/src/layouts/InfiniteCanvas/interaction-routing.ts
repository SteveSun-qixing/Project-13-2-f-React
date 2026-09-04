export type CanvasInteractionSurface =
    | 'desktop-background'
    | 'composite-delegate'
    | 'local-window'
    | 'ignore';

const isElement = (target: EventTarget | null): target is Element => {
    return target instanceof Element;
};

export function resolveCanvasInteractionSurface(
    target: EventTarget | null,
    canvasElement?: HTMLElement | null,
): CanvasInteractionSurface {
    if (!isElement(target)) {
        return 'ignore';
    }

    if (target.closest('.base-window')) {
        return 'local-window';
    }

    const cardWindow = target.closest('.card-window-base');
    if (cardWindow) {
        if (target.closest('[data-chips-composite-scroll-surface="delegate"]')) {
            return 'composite-delegate';
        }
        return 'local-window';
    }

    if (target.closest('.card-cover')) {
        return 'local-window';
    }

    if (canvasElement && target === canvasElement) {
        return 'desktop-background';
    }

    if (target.closest('.infinite-canvas__grid') || target.closest('.desktop-layer')) {
        return 'desktop-background';
    }

    return 'ignore';
}
