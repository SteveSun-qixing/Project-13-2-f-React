// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseWindow } from '../../src/components/BaseWindow/BaseWindow';

describe('BaseWindow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('exposes window actions and moves or resizes through keyboard paths', async () => {
    const onUpdatePosition = vi.fn();
    const onUpdateSize = vi.fn();
    const onCollapse = vi.fn();
    const onMinimize = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <BaseWindow
          config={{
            id: 'tool-window',
            type: 'tool',
            title: '文件管理器',
            position: { x: 40, y: 80 },
            size: { width: 320, height: 240 },
            state: 'normal',
            zIndex: 5,
          }}
          onUpdatePosition={onUpdatePosition}
          onUpdateSize={onUpdateSize}
          onCollapse={onCollapse}
          onMinimize={onMinimize}
          onClose={onClose}
        >
          <div>content</div>
        </BaseWindow>,
      );
    });

    const windowNode = container.querySelector('.base-window') as HTMLDivElement | null;
    const titlebar = container.querySelector('.base-window__header') as HTMLDivElement | null;
    const resizeHandle = container.querySelector('.base-window__resize-handle') as HTMLDivElement | null;
    const buttons = Array.from(container.querySelectorAll('.base-window__action')) as HTMLButtonElement[];

    expect(windowNode?.getAttribute('role')).toBe('region');
    expect(titlebar?.getAttribute('aria-label')).toBe('文件管理器 标题栏');
    expect(buttons[0]?.getAttribute('aria-label')).toBe('最小化 文件管理器');
    expect(buttons[1]?.getAttribute('aria-expanded')).toBe('true');
    expect(buttons[2]?.getAttribute('aria-label')).toBe('关闭 文件管理器');
    expect(resizeHandle?.getAttribute('role')).toBe('separator');

    await act(async () => {
      titlebar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onUpdatePosition).toHaveBeenLastCalledWith({ x: 48, y: 80 });

    await act(async () => {
      titlebar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onCollapse).toHaveBeenCalledTimes(1);

    await act(async () => {
      resizeHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    });
    expect(onUpdateSize).toHaveBeenLastCalledWith({ width: 320, height: 264 });

    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      buttons[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
