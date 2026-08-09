// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProvider } from '@chips/ui';
import { AppShell } from '../../src/app/AppShell';

const sceneState = vi.hoisted(() => ({
  shouldThrow: true,
}));

const editorStateMock = vi.hoisted(() => ({
  state: 'ready' as string,
  setState: vi.fn(),
}));

const workspaceServiceMock = vi.hoisted(() => ({
  refresh: vi.fn(async () => undefined),
}));

vi.mock('../../src/scenes/WorkspaceScene', () => ({
  WorkspaceScene: () => {
    if (sceneState.shouldThrow) {
      throw new Error('模拟工作区场景崩溃');
    }
    return <div className="mock-scene">scene-ok</div>;
  },
}));

vi.mock('../../src/context/EditorContext', () => ({
  useEditor: () => editorStateMock,
}));

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: workspaceServiceMock,
}));

describe('AppShell error boundary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    sceneState.shouldThrow = true;
    editorStateMock.state = 'ready';
    editorStateMock.setState.mockReset();
    editorStateMock.setState.mockImplementation((next: string) => {
      editorStateMock.state = next;
    });
    workspaceServiceMock.refresh.mockReset();
    workspaceServiceMock.refresh.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function findButton(label: string): HTMLButtonElement | null {
    const normalizedLabel = label.replace(/\s+/g, '');
    return (
      Array.from(container.querySelectorAll('button')).find((button) => {
        const text = button.textContent?.replace(/\s+/g, '') ?? '';
        return text.includes(normalizedLabel);
      }) ?? null
    );
  }

  it('keeps the AppChrome shell alive and shows a recoverable Result when the workspace scene crashes', async () => {
    await act(async () => {
      root.render(
        <CommandProvider>
          <AppShell />
        </CommandProvider>,
      );
    });

    expect(container.querySelector('.chips-app-chrome')).not.toBeNull();
    expect(container.textContent).toContain('工作区渲染出错');
    expect(container.textContent).toContain('模拟工作区场景崩溃');
    expect(findButton('重试')).not.toBeNull();
    expect(findButton('重置工作区')).not.toBeNull();
    expect(container.querySelector('.mock-scene')).toBeNull();
  });

  it('retry re-mounts the workspace scene once the crash cause is resolved', async () => {
    await act(async () => {
      root.render(
        <CommandProvider>
          <AppShell />
        </CommandProvider>,
      );
    });
    expect(findButton('重试')).not.toBeNull();

    sceneState.shouldThrow = false;
    await act(async () => {
      findButton('重试')?.click();
    });

    expect(container.querySelector('.mock-scene')).not.toBeNull();
    expect(container.textContent).not.toContain('工作区渲染出错');
  });

  it('reset workspace remounts the scene, marks the editor as loading and refreshes workspace files', async () => {
    await act(async () => {
      root.render(
        <CommandProvider>
          <AppShell />
        </CommandProvider>,
      );
    });
    expect(findButton('重置工作区')).not.toBeNull();

    sceneState.shouldThrow = false;
    await act(async () => {
      findButton('重置工作区')?.click();
      await Promise.resolve();
    });

    expect(editorStateMock.setState).toHaveBeenCalledWith('loading');
    expect(workspaceServiceMock.refresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.mock-scene')).not.toBeNull();
  });
});
