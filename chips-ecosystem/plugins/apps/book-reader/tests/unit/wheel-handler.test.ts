// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WheelHandler } from '../../src/interaction/wheel-handler';
import type { InteractionCallbacks, InteractionRuntime } from '../../src/interaction/types';

function createCallbacks(): InteractionCallbacks {
  return {
    onNavigate: vi.fn(),
    onNavigateBoundary: vi.fn(),
    onToggleChrome: vi.fn(),
    onClosePanel: vi.fn(),
    onOpenLink: vi.fn(),
    onEpubLink: vi.fn(),
    onAdjustFont: vi.fn(),
    onAdjustWidth: vi.fn(),
  };
}

function createRuntime(readingMode: 'paginated' | 'scroll' = 'paginated'): InteractionRuntime {
  let navigationLockUntil = 0;

  return {
    getReadingMode: () => readingMode,
    getController: () => null,
    hasActivePanel: () => false,
    canNavigate: () => Date.now() >= navigationLockUntil,
    lockNavigation: (durationMs = 0) => {
      navigationLockUntil = Date.now() + durationMs;
    },
  };
}

function dispatchWheel(
  deltaY: number,
  deltaMode: number,
  deltaX = 0,
  legacyWheelDeltaY?: number
): WheelEvent {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX,
    deltaY,
    deltaMode,
  });
  if (typeof legacyWheelDeltaY === 'number') {
    Object.defineProperty(event, 'wheelDeltaY', {
      configurable: true,
      value: legacyWheelDeltaY,
    });
    Object.defineProperty(event, 'wheelDelta', {
      configurable: true,
      value: legacyWheelDeltaY,
    });
  }
  document.dispatchEvent(event);
  return event;
}

describe('WheelHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('分页模式下鼠标滚轮一格就稳定翻一页', () => {
    const callbacks = createCallbacks();
    const runtime = createRuntime('paginated');
    const handler = new WheelHandler(callbacks, runtime);
    const detach = handler.attach(document);

    const firstEvent = dispatchWheel(1, WheelEvent.DOM_DELTA_LINE);
    expect(firstEvent.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);
    expect(callbacks.onNavigate).toHaveBeenLastCalledWith('next');

    vi.setSystemTime(new Date('2026-04-19T00:00:00.120Z'));
    const secondEvent = dispatchWheel(-1, WheelEvent.DOM_DELTA_LINE);
    expect(secondEvent.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(2);
    expect(callbacks.onNavigate).toHaveBeenLastCalledWith('previous');

    detach();
  });

  it('分页模式下像素模式鼠标滚轮也会按一格一页处理', () => {
    const callbacks = createCallbacks();
    const runtime = createRuntime('paginated');
    const handler = new WheelHandler(callbacks, runtime);
    const detach = handler.attach(document);

    const firstEvent = dispatchWheel(12, WheelEvent.DOM_DELTA_PIXEL, 0, -120);
    expect(firstEvent.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);
    expect(callbacks.onNavigate).toHaveBeenLastCalledWith('next');

    vi.setSystemTime(new Date('2026-04-19T00:00:00.120Z'));
    const secondEvent = dispatchWheel(-12, WheelEvent.DOM_DELTA_PIXEL, 0, 120);
    expect(secondEvent.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(2);
    expect(callbacks.onNavigate).toHaveBeenLastCalledWith('previous');

    detach();
  });

  it('分页模式下触摸板一次连续手势最多只翻一页', () => {
    const callbacks = createCallbacks();
    const runtime = createRuntime('paginated');
    const handler = new WheelHandler(callbacks, runtime);
    const detach = handler.attach(document);

    dispatchWheel(24, WheelEvent.DOM_DELTA_PIXEL);
    vi.setSystemTime(new Date('2026-04-19T00:00:00.016Z'));
    dispatchWheel(24, WheelEvent.DOM_DELTA_PIXEL);
    vi.setSystemTime(new Date('2026-04-19T00:00:00.032Z'));
    dispatchWheel(24, WheelEvent.DOM_DELTA_PIXEL);
    vi.setSystemTime(new Date('2026-04-19T00:00:00.048Z'));
    const triggerEvent = dispatchWheel(24, WheelEvent.DOM_DELTA_PIXEL);

    expect(triggerEvent.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);
    expect(callbacks.onNavigate).toHaveBeenLastCalledWith('next');

    vi.setSystemTime(new Date('2026-04-19T00:00:00.064Z'));
    const momentumEvent = dispatchWheel(18, WheelEvent.DOM_DELTA_PIXEL);
    vi.setSystemTime(new Date('2026-04-19T00:00:00.140Z'));
    dispatchWheel(12, WheelEvent.DOM_DELTA_PIXEL);
    vi.setSystemTime(new Date('2026-04-19T00:00:00.220Z'));
    dispatchWheel(8, WheelEvent.DOM_DELTA_PIXEL);

    expect(momentumEvent.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-04-19T00:00:00.520Z'));
    dispatchWheel(32, WheelEvent.DOM_DELTA_PIXEL);
    vi.setSystemTime(new Date('2026-04-19T00:00:00.536Z'));
    dispatchWheel(32, WheelEvent.DOM_DELTA_PIXEL);
    vi.setSystemTime(new Date('2026-04-19T00:00:00.552Z'));
    dispatchWheel(32, WheelEvent.DOM_DELTA_PIXEL);

    expect(callbacks.onNavigate).toHaveBeenCalledTimes(2);

    detach();
  });

  it('分页模式在锁定期间仍会阻止默认滚动偏移', () => {
    const callbacks = createCallbacks();
    const runtime = createRuntime('paginated');
    const handler = new WheelHandler(callbacks, runtime);
    const detach = handler.attach(document);

    dispatchWheel(1, WheelEvent.DOM_DELTA_LINE);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-04-19T00:00:00.020Z'));
    const blockedEvent = dispatchWheel(1, WheelEvent.DOM_DELTA_LINE);
    expect(blockedEvent.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);

    detach();
  });
});
