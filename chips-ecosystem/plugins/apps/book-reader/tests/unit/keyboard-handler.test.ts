// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { KeyboardHandler } from '../../src/interaction/keyboard-handler';
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

describe('KeyboardHandler', () => {
  it('会把方向键映射成阅读导航意图', () => {
    const handler = new KeyboardHandler(createCallbacks());
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

    expect(handler.resolveIntent(event)).toEqual({
      type: 'navigate',
      direction: 'next',
    });
  });

  it('在输入控件内不会触发阅读快捷键', () => {
    const handler = new KeyboardHandler(createCallbacks());
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: input,
    });

    expect(handler.resolveIntent(event)).toEqual({
      type: 'none',
    });
  });

  it('attach 后会响应键盘事件并调用对应回调', () => {
    const callbacks = createCallbacks();
    const handler = new KeyboardHandler(callbacks);
    const detach = handler.attach(document);

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ']',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(callbacks.onClosePanel).toHaveBeenCalledTimes(1);
    expect(callbacks.onAdjustFont).toHaveBeenCalledWith(0.1);

    detach();
  });
});
