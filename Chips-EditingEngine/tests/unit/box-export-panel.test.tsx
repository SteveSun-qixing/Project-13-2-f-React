// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoxDocumentSessionSnapshot } from '../../src/services/box-document-service';
import { BoxExportPanel } from '../../src/components/BoxWindow/BoxExportPanel';

const { saveBox, saveFile, packBox, statFile } = vi.hoisted(() => ({
  saveBox: vi.fn(async () => undefined),
  saveFile: vi.fn(async () => '/exports/demo.box'),
  packBox: vi.fn(async () => '/exports/demo.box'),
  statFile: vi.fn(async () => ({
    isFile: true,
    isDirectory: false,
    size: 1024,
    mtimeMs: Date.now(),
  })),
}));

vi.mock('../../src/services/box-document-service', () => ({
  boxDocumentService: {
    saveBox,
  },
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    platform: {
      saveFile,
    },
    box: {
      pack: packBox,
    },
  }),
}));

vi.mock('../../src/services/file-service', () => ({
  fileService: {
    stat: statFile,
  },
}));

const SESSION = {
  boxId: 'box-1',
  boxFile: '/workspace/demo.box',
  workspaceDir: '/workspace/.chips-editing-engine/box-sessions/box-1',
  metadata: {
    boxId: 'box-1',
    name: 'Demo Box',
    tags: [],
    coverRatio: '3:4',
  },
  coverHtml: '<html><body>cover</body></html>',
} as unknown as BoxDocumentSessionSnapshot;

describe('BoxExportPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveBox.mockReset();
    saveBox.mockImplementation(async () => undefined);
    saveFile.mockReset();
    saveFile.mockImplementation(async () => '/exports/demo.box');
    packBox.mockReset();
    packBox.mockImplementation(async () => '/exports/demo.box');
    statFile.mockReset();
    statFile.mockImplementation(async () => ({
      isFile: true,
      isDirectory: false,
      size: 1024,
      mtimeMs: Date.now(),
    }));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function clickExport() {
    await act(async () => {
      (document.body.querySelector('[data-testid="box-export-format-box"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('exports the current box through the formal save, saveBox and box.pack chain', async () => {
    const onBeforeExport = vi.fn();

    await act(async () => {
      root.render(
        <BoxExportPanel boxId="box-1" session={SESSION} onBeforeExport={onBeforeExport} />,
      );
    });

    await clickExport();

    expect(saveFile).toHaveBeenCalledWith({
      title: '保存 .box 文件',
      defaultPath: '/workspace/Demo Box.box',
    });
    expect(onBeforeExport).toHaveBeenCalledTimes(1);
    expect(saveBox).toHaveBeenCalledWith('box-1');
    expect(packBox).toHaveBeenCalledWith(SESSION.workspaceDir, {
      outputPath: '/exports/demo.box',
    });
    expect(statFile).toHaveBeenCalledWith('/exports/demo.box');
    expect(document.body.textContent).toContain('导出完成：/exports/demo.box');
  });

  it('stops cleanly when the user cancels the save dialog', async () => {
    saveFile.mockResolvedValueOnce(null as never);

    await act(async () => {
      root.render(<BoxExportPanel boxId="box-1" session={SESSION} />);
    });

    await clickExport();

    expect(saveBox).not.toHaveBeenCalled();
    expect(packBox).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('导出完成');
  });

  it('shows an error when Host packing fails after the box has been saved', async () => {
    packBox.mockRejectedValueOnce(new Error('pack failed'));

    await act(async () => {
      root.render(<BoxExportPanel boxId="box-1" session={SESSION} />);
    });

    await clickExport();

    expect(saveBox).toHaveBeenCalledWith('box-1');
    expect(document.body.textContent).toContain('导出失败：pack failed');
  });

  it('shows an error when the save dialog route itself fails', async () => {
    saveFile.mockRejectedValueOnce(new Error('dialog unavailable'));

    await act(async () => {
      root.render(<BoxExportPanel boxId="box-1" session={SESSION} />);
    });

    await clickExport();

    expect(saveBox).not.toHaveBeenCalled();
    expect(packBox).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('导出失败：dialog unavailable');
  });

  it('treats a missing packaged file as a real export failure instead of a false success', async () => {
    statFile.mockResolvedValueOnce({
      isFile: false,
      isDirectory: false,
      size: 0,
      mtimeMs: Date.now(),
    });

    await act(async () => {
      root.render(<BoxExportPanel boxId="box-1" session={SESSION} />);
    });

    await clickExport();

    expect(saveBox).toHaveBeenCalledWith('box-1');
    expect(packBox).toHaveBeenCalledWith(SESSION.workspaceDir, {
      outputPath: '/exports/demo.box',
    });
    expect(statFile).toHaveBeenCalledWith('/exports/demo.box');
    expect(document.body.textContent).toContain('导出失败：导出目标文件未生成');
  });
});
