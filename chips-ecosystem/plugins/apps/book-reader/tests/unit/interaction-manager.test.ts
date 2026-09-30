// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractionManager } from '../../src/interaction/interaction-manager';
import type { InteractionCallbacks } from '../../src/interaction/types';

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

describe('InteractionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('锁定期间会阻止连续导航，过期后恢复', () => {
    const callbacks = createCallbacks();
    const manager = new InteractionManager({
      callbacks,
      getReadingMode: () => 'paginated',
      getController: () => null,
      hasActivePanel: () => false,
    });

    manager.attachToHost(document);

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);
    expect(manager.canNavigate()).toBe(false);

    vi.setSystemTime(new Date('2026-04-19T00:00:01.000Z'));
    expect(manager.canNavigate()).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(2);

    manager.destroy();
  });

  it('章节 iframe 获得焦点后仍会用键盘事件触发完整阅读导航', () => {
    const callbacks = createCallbacks();
    const manager = new InteractionManager({
      callbacks,
      getReadingMode: () => 'paginated',
      getController: () => null,
      hasActivePanel: () => false,
    });

    manager.attachToFrame(document);

    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);
    expect(callbacks.onNavigate).toHaveBeenLastCalledWith('next');

    manager.destroy();
  });

  it('显式锁定后 canNavigate 会按时间窗口返回 false', () => {
    const manager = new InteractionManager({
      callbacks: createCallbacks(),
      getReadingMode: () => 'paginated',
      getController: () => null,
      hasActivePanel: () => false,
    });

    manager.lockNavigation(180);
    expect(manager.canNavigate()).toBe(false);

    vi.setSystemTime(new Date('2026-04-19T00:00:00.500Z'));
    expect(manager.canNavigate()).toBe(true);
  });

  it('章节 iframe 获得焦点后仍会用键盘事件触发完整阅读导航', () => {
    const callbacks = createCallbacks();
    const manager = new InteractionManager({
      callbacks,
      getReadingMode: () => 'paginated',
      getController: () => null,
      hasActivePanel: () => false,
    });

    manager.attachToFrame(document);

    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onNavigate).toHaveBeenCalledTimes(1);
    expect(callbacks.onNavigate).toHaveBeenLastCalledWith('next');

    manager.destroy();
  });
});
