// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileManager from '../../src/components/FileManager/FileManager';
import { CHIPS_DRAG_DATA_TYPE } from '../../src/components/CardBoxLibrary/types';
import type { WorkspaceFile } from '../../src/types/workspace';

const workspaceServiceMock = vi.hoisted(() => {
  const files: WorkspaceFile[] = [
    {
      id: 'card-1',
      name: 'demo.card',
      path: '/workspace/demo.card',
      type: 'card',
      createdAt: '2026-03-14T00:00:00.000Z',
      modifiedAt: '2026-03-14T00:00:00.000Z',
    },
  ];

  return {
    isInitialized: vi.fn(() => true),
    initialize: vi.fn(async () => undefined),
    getFiles: vi.fn(() => files),
    getState: vi.fn(() => ({ rootPath: '/workspace' })),
    on: vi.fn(),
    off: vi.fn(),
    openFile: vi.fn(),
    renameFile: vi.fn(),
    createCard: vi.fn(),
    createBox: vi.fn(),
    deleteFile: vi.fn(),
    refresh: vi.fn(),
  };
});

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: workspaceServiceMock,
}));

vi.mock('../../src/context/EditorContext', () => ({
  useEditor: () => ({
    state: 'ready',
  }),
}));

describe('FileManager', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    workspaceServiceMock.isInitialized.mockClear();
    workspaceServiceMock.initialize.mockClear();
    workspaceServiceMock.getFiles.mockClear();
    workspaceServiceMock.getState.mockClear();
    workspaceServiceMock.on.mockClear();
    workspaceServiceMock.off.mockClear();
    workspaceServiceMock.openFile.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('serializes workspace card drags with the shared Chips drag payload', async () => {
    await act(async () => {
      root.render(<FileManager />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const cardItem = container.querySelector('.file-item') as HTMLDivElement | null;
    expect(cardItem).not.toBeNull();

    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: 'none',
    };
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: dataTransfer,
    });

    await act(async () => {
      cardItem?.dispatchEvent(dragStartEvent);
    });

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      CHIPS_DRAG_DATA_TYPE,
      JSON.stringify({
        type: 'workspace-file',
        fileId: 'card-1',
        fileType: 'card',
        filePath: '/workspace/demo.card',
        name: 'demo.card',
      }),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '/workspace/demo.card');
    expect(dataTransfer.effectAllowed).toBe('copy');
  });
});
