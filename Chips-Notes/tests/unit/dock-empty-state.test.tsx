// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dock } from '../../src/components/Dock/Dock';

const uiStateMock = vi.hoisted(() => ({
  dockPosition: 'bottom' as 'bottom' | 'left' | 'right',
  dockVisible: true,
  windows: [] as Array<Record<string, unknown>>,
  focusWindow: vi.fn(),
  updateWindow: vi.fn(),
}));

vi.mock('../../src/context/UIContext', () => ({
  useUI: () => uiStateMock,
}));

describe('Dock empty state', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    uiStateMock.dockPosition = 'bottom';
    uiStateMock.dockVisible = true;
    uiStateMock.windows = [];
    uiStateMock.focusWindow.mockClear();
    uiStateMock.updateWindow.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders a guiding empty state when no windows are open', async () => {
    await act(async () => {
      root.render(<Dock />);
    });

    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('打开或新建卡片开始编辑');
  });

  it('keeps the settings entry visible while showing the empty state', async () => {
    await act(async () => {
      root.render(<Dock />);
    });

    expect(container.querySelector('button[aria-label="引擎设置"]')).not.toBeNull();
  });

  it('does not render the empty state when tool windows are present', async () => {
    uiStateMock.windows = [
      {
        id: 'window-file-manager',
        type: 'tool',
        component: 'FileManager',
        title: '文件管理器',
        position: { x: 20, y: 20 },
        size: { width: 280, height: 500 },
        state: 'normal',
        zIndex: 1,
      },
    ];

    await act(async () => {
      root.render(<Dock />);
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('button[aria-label="文件管理器"]')).not.toBeNull();
  });

  it('renders the empty state without breaking the vertical dock layout', async () => {
    uiStateMock.dockPosition = 'left';

    await act(async () => {
      root.render(<Dock />);
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('打开或新建卡片开始编辑');
  });
});
