// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolWindow } from '../../src/components/BaseWindow/ToolWindow';

const uiMock = vi.hoisted(() => ({
  updateWindow: vi.fn(),
  removeWindow: vi.fn(),
  bringToFront: vi.fn(),
}));

vi.mock('../../src/context/UIContext', () => ({
  useUI: () => uiMock,
}));

vi.mock('../../src/components/ToolComponentRegistry', () => ({
  ToolComponentRegistry: {
    FileManager: () => <div data-testid="tool-component">tool-content</div>,
  },
}));

vi.mock('../../src/components/BaseWindow/BaseWindow', () => ({
  BaseWindow: ({ headerSlot, children }: { headerSlot?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <div data-testid="window-header">{headerSlot}</div>
      <div data-testid="window-body">{children}</div>
    </div>
  ),
}));

describe('ToolWindow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    uiMock.updateWindow.mockClear();
    uiMock.removeWindow.mockClear();
    uiMock.bringToFront.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders tool window icons through RuntimeIcon instead of raw descriptor objects', async () => {
    await act(async () => {
      root.render(
        <ToolWindow
          config={{
            id: 'tool-file-manager',
            type: 'tool',
            component: 'FileManager',
            title: '文件管理器',
            icon: { name: 'folder', decorative: true, opsz: 24 },
            position: { x: 0, y: 0 },
            size: { width: 320, height: 240 },
            state: 'normal',
            zIndex: 1,
          }}
        />,
      );
    });

    const icon = container.querySelector('.tool-window__icon svg');
    expect(icon).not.toBeNull();
    expect(container.textContent).toContain('文件管理器');
    expect(container.querySelector('[data-testid="tool-component"]')).not.toBeNull();
  });
});
