// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportPanel } from '../../src/components/CardSettings/panels/ExportPanel';

const { saveCard, packCard, saveFile, statFile, moduleInvoke, moduleJobGet, moduleListProviders } = vi.hoisted(() => ({
  saveCard: vi.fn(async () => undefined),
  packCard: vi.fn(async () => '/exports/story-board.card'),
  saveFile: vi.fn(async () => '/exports/story-board.card'),
  statFile: vi.fn(async () => ({
    isFile: true,
    isDirectory: false,
    size: 1024,
    mtimeMs: Date.now(),
  })),
  moduleInvoke: vi.fn(async () => ({ mode: 'job', jobId: 'job-1' })),
  moduleJobGet: vi.fn(async () => ({
    jobId: 'job-1',
    pluginId: 'chips.module.file-conversion',
    capability: 'converter.file.convert',
    method: 'convert',
    status: 'completed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    output: {
      outputPath: '/exports/story-board.zip',
    },
  })),
  moduleListProviders: vi.fn(async () => [
    {
      status: 'enabled',
    },
  ]),
}));


vi.mock('../../src/context/CardContext', () => ({
  useCard: () => ({
    getCard: () => ({
      id: 'card-1',
      path: '/workspace/card-1.card',
      metadata: {
        name: 'card-1',
        themeId: 'theme-sample',
      },
    }),
    saveCard,
  }),
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    platform: {
      saveFile,
    },
    card: {
      pack: packCard,
    },
    file: {
      stat: statFile,
    },
    module: {
      listProviders: moduleListProviders,
      invoke: moduleInvoke,
      job: {
        get: moduleJobGet,
      },
    },
  }),
}));

describe('ExportPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveCard.mockReset();
    saveCard.mockImplementation(async () => undefined);
    packCard.mockReset();
    packCard.mockImplementation(async () => '/exports/story-board.card');
    saveFile.mockReset();
    saveFile.mockImplementation(async () => '/exports/story-board.card');
    statFile.mockReset();
    statFile.mockImplementation(async () => ({
      isFile: true,
      isDirectory: false,
      size: 1024,
      mtimeMs: Date.now(),
    }));
    moduleInvoke.mockReset();
    moduleInvoke.mockImplementation(async () => ({ mode: 'job', jobId: 'job-1' }));
    moduleJobGet.mockReset();
    moduleJobGet.mockImplementation(async () => ({
      jobId: 'job-1',
      pluginId: 'chips.module.file-conversion',
      capability: 'converter.file.convert',
      method: 'convert',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      output: {
        outputPath: '/exports/story-board.zip',
      },
    }));
    moduleListProviders.mockReset();
    moduleListProviders.mockImplementation(async () => [
      {
        status: 'enabled',
      },
    ]);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('exports the current unpacked card directory through the formal save and card.pack chain', async () => {
    const onBeforeExport = vi.fn();

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" onBeforeExport={onBeforeExport} />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-card"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveFile).toHaveBeenCalledWith({
      title: '保存 .card 文件',
      defaultPath: '/workspace/card-1-export.card',
    });
    expect(onBeforeExport).toHaveBeenCalledTimes(1);
    expect(saveCard).toHaveBeenCalledWith('card-1');
    expect(packCard).toHaveBeenCalledWith('/workspace/card-1.card', '/exports/story-board.card');
    expect(statFile).toHaveBeenCalledWith('/exports/story-board.card');
    expect(document.body.textContent).toContain('导出完成：/exports/story-board.card');
  });

  it('exports HTML through the formal converter.file.convert module pipeline', async () => {
    saveFile.mockResolvedValueOnce('/exports/story-board');
    moduleInvoke.mockResolvedValueOnce({ mode: 'job', jobId: 'job-html' });
    moduleJobGet.mockResolvedValueOnce({
      jobId: 'job-html',
      pluginId: 'chips.module.file-conversion',
      capability: 'converter.file.convert',
      method: 'convert',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      output: {
        outputPath: '/exports/story-board.zip',
      },
    });
    statFile.mockResolvedValueOnce({
      isFile: true,
      isDirectory: false,
      size: 2048,
      mtimeMs: Date.now(),
    });

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-html"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveFile).toHaveBeenCalledWith({
      title: '保存 HTML 导出包',
      defaultPath: '/workspace/card-1.zip',
    });
    expect(saveCard).toHaveBeenCalledWith('card-1');
    expect(moduleInvoke).toHaveBeenCalledWith({
      capability: 'converter.file.convert',
      method: 'convert',
      input: {
        source: {
          type: 'card',
          path: '/workspace/card-1.card',
        },
        target: {
          type: 'html',
        },
        output: {
          path: '/exports/story-board.zip',
          overwrite: true,
        },
        options: {
          locale: 'zh-CN',
          themeId: 'theme-sample',
          html: {
            packageMode: 'zip',
            includeAssets: true,
            includeManifest: true,
          },
        },
      },
    });
    expect(moduleJobGet).toHaveBeenCalledWith('job-html');
    expect(statFile).toHaveBeenCalledWith('/exports/story-board.zip');
    expect(document.body.textContent).toContain('导出完成：/exports/story-board.zip');
  });

  it('exports PDF through the formal converter.file.convert module pipeline', async () => {
    saveFile.mockResolvedValueOnce('/exports/story-board');
    moduleInvoke.mockResolvedValueOnce({
      mode: 'sync',
      output: {
        outputPath: '/exports/story-board.pdf',
      },
    } as never);

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-pdf"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveFile).toHaveBeenCalledWith({
      title: '保存 PDF 文件',
      defaultPath: '/workspace/card-1.pdf',
    });
    expect(moduleInvoke).toHaveBeenCalledWith({
      capability: 'converter.file.convert',
      method: 'convert',
      input: {
        source: {
          type: 'card',
          path: '/workspace/card-1.card',
        },
        target: {
          type: 'pdf',
        },
        output: {
          path: '/exports/story-board.pdf',
          overwrite: true,
        },
        options: {
          locale: 'zh-CN',
          themeId: 'theme-sample',
        },
      },
    });
    expect(statFile).toHaveBeenCalledWith('/exports/story-board.pdf');
    expect(document.body.textContent).toContain('导出完成：/exports/story-board.pdf');
  });

  it('exports PNG images through the formal converter.file.convert module pipeline', async () => {
    saveFile.mockResolvedValueOnce('/exports/story-board');
    moduleInvoke.mockResolvedValueOnce({
      mode: 'sync',
      output: {
        outputPath: '/exports/story-board.png',
      },
    } as never);

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-image"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveFile).toHaveBeenCalledWith({
      title: '保存图片文件',
      defaultPath: '/workspace/card-1.png',
    });
    expect(moduleInvoke).toHaveBeenCalledWith({
      capability: 'converter.file.convert',
      method: 'convert',
      input: {
        source: {
          type: 'card',
          path: '/workspace/card-1.card',
        },
        target: {
          type: 'image',
        },
        output: {
          path: '/exports/story-board.png',
          overwrite: true,
        },
        options: {
          locale: 'zh-CN',
          themeId: 'theme-sample',
          image: {
            format: 'png',
          },
        },
      },
    });
    expect(statFile).toHaveBeenCalledWith('/exports/story-board.png');
    expect(document.body.textContent).toContain('导出完成：/exports/story-board.png');
  });

  it('stops cleanly when the user cancels the save dialog', async () => {
    saveFile.mockResolvedValueOnce(null as never);

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-card"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(saveCard).not.toHaveBeenCalled();
    expect(packCard).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('导出完成');
  });

  it('shows an error when Host packing fails after the card has been saved', async () => {
    packCard.mockRejectedValueOnce(new Error('pack failed'));

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-card"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveCard).toHaveBeenCalledWith('card-1');
    expect(document.body.textContent).toContain('导出失败：pack failed');
  });

  it('shows an error when the save dialog route itself fails', async () => {
    saveFile.mockRejectedValueOnce(new Error('dialog unavailable'));

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-card"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveCard).not.toHaveBeenCalled();
    expect(packCard).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('导出失败：dialog unavailable');
  });

  it('shows an error when the conversion module job fails', async () => {
    saveFile.mockResolvedValueOnce('/exports/story-board');
    moduleInvoke.mockResolvedValueOnce({ mode: 'job', jobId: 'job-pdf' });
    moduleJobGet.mockResolvedValueOnce({
      jobId: 'job-pdf',
      pluginId: 'chips.module.file-conversion',
      capability: 'converter.file.convert',
      method: 'convert',
      status: 'failed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      error: {
        code: 'CONVERTER_PDF_PRINT_FAILED',
        message: 'pdf export failed',
      },
    } as never);

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-pdf"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveCard).toHaveBeenCalledWith('card-1');
    expect(document.body.textContent).toContain('导出失败：pdf export failed');
  });

  it('treats a missing packaged file as a real export failure instead of a false success', async () => {
    statFile.mockResolvedValueOnce({
      isFile: false,
      isDirectory: false,
      size: 0,
      mtimeMs: Date.now(),
    });

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="export-format-card"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveCard).toHaveBeenCalledWith('card-1');
    expect(packCard).toHaveBeenCalledWith('/workspace/card-1.card', '/exports/story-board.card');
    expect(statFile).toHaveBeenCalledWith('/exports/story-board.card');
    expect(document.body.textContent).toContain('导出失败：导出目标文件未生成');
  });

  it('hides conversion formats when their module providers are not installed', async () => {
    moduleListProviders.mockResolvedValue([]);

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.querySelector('[data-testid="export-format-card"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="export-format-html"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="export-format-pdf"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="export-format-image"]')).toBeNull();
  });

  it('hides conversion formats when the availability check fails', async () => {
    moduleListProviders.mockRejectedValue(new Error('bridge unavailable'));

    await act(async () => {
      root.render(<ExportPanel cardId="card-1" />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.querySelector('[data-testid="export-format-card"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="export-format-html"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="export-format-pdf"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="export-format-image"]')).toBeNull();
  });
});
