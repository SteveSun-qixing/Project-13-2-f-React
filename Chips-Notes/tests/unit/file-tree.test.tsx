// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileTree } from '../../src/components/FileManager/FileTree';
import type { WorkspaceFile } from '../../src/types/workspace';

describe('FileTree', () => {
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

  it('uses workspace root depth instead of absolute path depth for indentation', async () => {
    const files: WorkspaceFile[] = [
      {
        id: 'folder-1',
        name: 'folder',
        path: '/Users/sevenstars/Documents/Workspace/folder',
        type: 'folder',
        createdAt: '2026-03-14T00:00:00.000Z',
        modifiedAt: '2026-03-14T00:00:00.000Z',
        expanded: true,
        children: [
          {
            id: 'card-1',
            name: 'demo.card',
            path: '/Users/sevenstars/Documents/Workspace/folder/demo.card',
            type: 'card',
            createdAt: '2026-03-14T00:00:00.000Z',
            modifiedAt: '2026-03-14T00:00:00.000Z',
          },
        ],
      },
    ];

    await act(async () => {
      root.render(
        <FileTree
          files={files}
          rootPath="/Users/sevenstars/Documents/Workspace"
          selectedPaths={[]}
          renamingPath={null}
          searchQuery=""
          onSelect={() => undefined}
          onOpen={() => undefined}
          onContextMenu={() => undefined}
          onToggle={() => undefined}
          onRename={() => undefined}
          onRenameCancel={() => undefined}
          onDragStart={() => undefined}
        />,
      );
    });

    const items = Array.from(container.querySelectorAll('.file-item')) as HTMLDivElement[];
    expect(items).toHaveLength(2);
    expect(items[0]?.style.paddingLeft).toBe('8px');
    expect(items[1]?.style.paddingLeft).toBe('24px');
  });

  it('uses roving treeitem focus and keyboard navigation for files', async () => {
    const files: WorkspaceFile[] = [
      {
        id: 'folder-1',
        name: 'folder',
        path: '/workspace/folder',
        type: 'folder',
        createdAt: '2026-03-14T00:00:00.000Z',
        modifiedAt: '2026-03-14T00:00:00.000Z',
        expanded: true,
        children: [
          {
            id: 'card-1',
            name: 'demo.card',
            path: '/workspace/folder/demo.card',
            type: 'card',
            createdAt: '2026-03-14T00:00:00.000Z',
            modifiedAt: '2026-03-14T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'box-1',
        name: 'archive.box',
        path: '/workspace/archive.box',
        type: 'box',
        createdAt: '2026-03-14T00:00:00.000Z',
        modifiedAt: '2026-03-14T00:00:00.000Z',
      },
    ];
    const onSelect = vi.fn();
    const onOpen = vi.fn();

    await act(async () => {
      root.render(
        <FileTree
          files={files}
          rootPath="/workspace"
          selectedPaths={[]}
          renamingPath={null}
          searchQuery=""
          multiSelect={true}
          onSelect={onSelect}
          onOpen={onOpen}
          onContextMenu={() => undefined}
          onToggle={() => undefined}
          onRename={() => undefined}
          onRenameCancel={() => undefined}
          onDragStart={() => undefined}
        />,
      );
    });

    const tree = container.querySelector('[role="tree"]') as HTMLDivElement | null;
    const items = Array.from(container.querySelectorAll('[role="treeitem"]')) as HTMLDivElement[];
    expect(tree).not.toBeNull();
    expect(tree?.getAttribute('aria-label')).toBe('文件树');
    expect(tree?.getAttribute('aria-multiselectable')).toBe('true');
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1]);
    expect(items[0]?.getAttribute('aria-expanded')).toBe('true');
    expect(items[0]?.getAttribute('aria-level')).toBe('1');
    expect(items[1]?.getAttribute('aria-level')).toBe('2');

    await act(async () => {
      tree?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(onSelect).toHaveBeenLastCalledWith(['/workspace/folder/demo.card'], [files[0]?.children?.[0]]);
    const updatedItems = Array.from(container.querySelectorAll('[role="treeitem"]')) as HTMLDivElement[];
    expect(updatedItems.map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
    expect(document.activeElement).toBe(updatedItems[1]);

    await act(async () => {
      tree?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onOpen).toHaveBeenCalledWith(files[0]?.children?.[0]);
  });

  it('claims Enter locally with preventDefault so the global shortcut dispatcher skips it', async () => {
    const files: WorkspaceFile[] = [
      {
        id: 'folder-1',
        name: 'folder',
        path: '/workspace/folder',
        type: 'folder',
        createdAt: '2026-03-14T00:00:00.000Z',
        modifiedAt: '2026-03-14T00:00:00.000Z',
        expanded: true,
        children: [],
      },
      {
        id: 'card-1',
        name: 'demo.card',
        path: '/workspace/demo.card',
        type: 'card',
        createdAt: '2026-03-14T00:00:00.000Z',
        modifiedAt: '2026-03-14T00:00:00.000Z',
      },
    ];
    const onOpen = vi.fn();
    const onToggle = vi.fn();

    await act(async () => {
      root.render(
        <FileTree
          files={files}
          rootPath="/workspace"
          selectedPaths={[]}
          renamingPath={null}
          searchQuery=""
          onSelect={() => undefined}
          onOpen={onOpen}
          onContextMenu={() => undefined}
          onToggle={onToggle}
          onRename={() => undefined}
          onRenameCancel={() => undefined}
          onDragStart={() => undefined}
        />,
      );
    });

    const tree = container.querySelector('[role="tree"]') as HTMLDivElement | null;
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    await act(async () => {
      tree?.dispatchEvent(enterEvent);
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    expect(enterEvent.defaultPrevented).toBe(true);
  });

  it('leaves F2 and Delete untouched locally, preserving the no-global-dispatch guarantee', async () => {
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
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    const onRename = vi.fn();

    await act(async () => {
      root.render(
        <FileTree
          files={files}
          rootPath="/workspace"
          selectedPaths={[]}
          renamingPath={null}
          searchQuery=""
          onSelect={() => undefined}
          onOpen={onOpen}
          onContextMenu={() => undefined}
          onToggle={onToggle}
          onRename={onRename}
          onRenameCancel={() => undefined}
          onDragStart={() => undefined}
        />,
      );
    });

    const tree = container.querySelector('[role="tree"]') as HTMLDivElement | null;
    const f2Event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true });
    const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });

    await act(async () => {
      tree?.dispatchEvent(f2Event);
      tree?.dispatchEvent(deleteEvent);
    });

    expect(f2Event.defaultPrevented).toBe(false);
    expect(deleteEvent.defaultPrevented).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });
});
