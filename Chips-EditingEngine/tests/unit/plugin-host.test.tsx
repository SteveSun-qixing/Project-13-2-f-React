// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorRuntimeProvider } from '../../src/editor-runtime/context';
import { PluginHost } from '../../src/components/EditPanel/PluginHost';
import { fileService } from '../../src/services/file-service';
import { resourceService } from '../../src/services/resource-service';

const mockRenderEditor = vi.fn();
let editorChangeHandler: ((nextConfig: Record<string, unknown>) => void) | null = null;
let editorImportResource:
  | ((input: { file: File; preferredPath?: string }) => Promise<{ path: string }>)
  | null = null;
let editorResolveResourceUrl:
  | ((resourcePath: string) => Promise<string>)
  | null = null;
let editorConvertTiffToPng:
  | ((input: { resourcePath: string; outputPath: string; overwrite?: boolean }) => Promise<{
      path: string;
      mimeType: 'image/png';
      sourceMimeType: 'image/tiff';
      width?: number;
      height?: number;
    }>)
  | null = null;
let editorExtractVideoThumbnail:
  | ((input: {
      resourcePath: string;
      outputPath: string;
      overwrite?: boolean;
      options?: {
        timeSeconds?: number;
        format?: 'png' | 'jpeg';
        width?: number;
        height?: number;
        fit?: 'contain' | 'cover';
        quality?: number;
      };
    }) => Promise<{
      path: string;
      mimeType: 'image/png' | 'image/jpeg';
      sourceMimeType: string;
      width: number;
      height: number;
      format: 'png' | 'jpeg';
      frameTimeSeconds: number;
      durationSeconds?: number;
    }>)
  | null = null;

vi.mock('../../src/basecard-runtime/registry', () => ({
  getBasecardDescriptor: () => ({
    pluginId: 'mock.basecard',
    cardType: 'base.mock',
    displayName: 'Mock Basecard',
    commitDebounceMs: 260,
    createInitialConfig: (baseCardId: string) => ({ id: baseCardId }),
    normalizeConfig: (input: Record<string, unknown>, baseCardId: string) => ({
      ...input,
      id: baseCardId,
    }),
    validateConfig: () => ({
      valid: true,
      errors: {},
    }),
    collectResourcePaths: (config: Record<string, unknown>) => {
      const resourcePaths: string[] = [];
      if (config.content_source === 'file' && typeof config.content_file === 'string') {
        resourcePaths.push(config.content_file);
      }
      for (const image of Array.isArray(config.images) ? config.images : []) {
        if (
          image
          && typeof image === 'object'
          && (image as { source?: unknown }).source === 'file'
          && typeof (image as { file_path?: unknown }).file_path === 'string'
        ) {
          resourcePaths.push((image as { file_path: string }).file_path);
        }
      }
      return resourcePaths;
    },
    renderView: () => () => undefined,
    renderEditor: mockRenderEditor,
  }),
  getBasecardRegistryVersion: () => 0,
  subscribeBasecardRegistry: () => () => undefined,
}));


vi.mock('../../src/services/file-service', () => ({
  fileService: {
    readText: vi.fn(async (path: string) => `text:${path}`),
    readBinary: vi.fn(async () => new Uint8Array([1, 2, 3])),
    writeBinary: vi.fn(async () => undefined),
    exists: vi.fn(async () => false),
    delete: vi.fn(async () => undefined),
  },
}));

vi.mock('../../src/services/resource-service', () => ({
  resourceService: {
    convertTiffToPng: vi.fn(async ({
      outputFile,
    }: {
      resourceId: string;
      outputFile: string;
      overwrite?: boolean;
    }) => ({
      outputFile,
      mimeType: 'image/png' as const,
      sourceMimeType: 'image/tiff' as const,
      width: 320,
      height: 320,
    })),
    extractVideoFrame: vi.fn(async ({
      outputFile,
    }: {
      resourceId: string;
      outputFile: string;
      overwrite?: boolean;
      options?: {
        timeSeconds?: number;
        format?: 'png' | 'jpeg';
        width?: number;
        height?: number;
        fit?: 'contain' | 'cover';
        quality?: number;
      };
    }) => ({
      outputFile,
      mimeType: 'image/png' as const,
      sourceMimeType: 'video/mp4',
      width: 640,
      height: 360,
      format: 'png' as const,
      frameTimeSeconds: 1.5,
      durationSeconds: 12,
    })),
  },
}));

describe('PluginHost', () => {
  let container: HTMLDivElement;
  let root: Root;
  const createObjectURL = vi.fn<[Blob | MediaSource], string>(() => 'blob:existing-resource');
  const revokeObjectURL = vi.fn<[string], void>();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    editorChangeHandler = null;
    editorImportResource = null;
    editorResolveResourceUrl = null;
    editorConvertTiffToPng = null;
    editorExtractVideoThumbnail = null;
    mockRenderEditor.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.mocked(fileService.exists).mockResolvedValue(false);
    vi.mocked(resourceService.convertTiffToPng).mockResolvedValue({
      outputFile: '/workspace/card-1.card/.card/.__editor-base-1-temp.png',
      mimeType: 'image/png',
      sourceMimeType: 'image/tiff',
      width: 320,
      height: 320,
    });
    vi.mocked(resourceService.extractVideoFrame).mockResolvedValue({
      outputFile: '/workspace/card-1.card/.card/.__editor-base-1-video-frame.png',
      mimeType: 'image/png',
      sourceMimeType: 'video/mp4',
      width: 640,
      height: 360,
      format: 'png',
      frameTimeSeconds: 1.5,
      durationSeconds: 12,
    });
    mockRenderEditor.mockImplementation(({
      onChange,
      importResource,
      resolveResourceUrl,
      convertTiffToPng,
      extractVideoThumbnail,
    }) => {
      editorChangeHandler = onChange;
      editorImportResource = importResource;
      editorResolveResourceUrl = resolveResourceUrl ?? null;
      editorConvertTiffToPng = convertTiffToPng ?? null;
      editorExtractVideoThumbnail = extractVideoThumbnail ?? null;
      return () => undefined;
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('debounces rapid editor changes before committing card config updates', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'init' }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'a' });
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'ab' });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(259);
      await Promise.resolve();
    });

    expect(onConfigChange).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange).toHaveBeenLastCalledWith(
      {
        id: 'base-1',
        card_type: 'RichTextCard',
        content_format: 'markdown',
        content_source: 'inline',
        content_text: 'ab',
      },
      undefined,
    );
  });

  it('does not flush an intermediate draft between separated editor change frames', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'init' }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'a' });
      await Promise.resolve();
    });

    await act(async () => {
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'ab' });
      await Promise.resolve();
    });

    expect(onConfigChange).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(259);
      await Promise.resolve();
    });

    expect(onConfigChange).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange).toHaveBeenCalledWith(
      {
        id: 'base-1',
        card_type: 'RichTextCard',
        content_format: 'markdown',
        content_source: 'inline',
        content_text: 'ab',
      },
      undefined,
    );
  });

  it('flushes the last pending editor draft before unmount', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'init' }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'final' });
      await Promise.resolve();
    });

    expect(onConfigChange).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange).toHaveBeenCalledWith(
      {
        id: 'base-1',
        card_type: 'RichTextCard',
        content_format: 'markdown',
        content_source: 'inline',
        content_text: 'final',
      },
      undefined,
    );
  });

  it('keeps the editor mounted while draft config changes are still local', async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'init' }}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    expect(mockRenderEditor).toHaveBeenCalledTimes(1);

    await act(async () => {
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'a' });
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'ab' });
      await Promise.resolve();
    });

    expect(mockRenderEditor).toHaveBeenCalledTimes(1);
  });

  it('commits immediately after a draft starts referencing newly imported resources', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="ImageCard"
            baseCardId="base-1"
            config={{ id: 'base-1', images: [] }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });
    const file = new File(['image'], 'photo.png', { type: 'image/png' });

    await act(async () => {
      const imported = await editorImportResource?.({
        file,
        preferredPath: 'photo.png',
      });
      editorChangeHandler?.({
        id: 'base-1',
        images: [
          {
            id: 'image-1',
            source: 'file',
            file_path: imported?.path ?? 'photo.png',
          },
        ],
      });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange).toHaveBeenCalledWith(
      {
        id: 'base-1',
        images: [
          {
            id: 'image-1',
            source: 'file',
            file_path: 'photo.png',
          },
        ],
      },
      {
        imports: [
          expect.objectContaining({
            path: 'photo.png',
            mimeType: 'image/png',
          }),
        ],
        deletions: [],
      },
    );
  });

  it('reuses an already referenced resource path instead of allocating a new file name', async () => {
    vi.mocked(fileService.exists).mockResolvedValue(true);

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{
              id: 'base-1',
              card_type: 'RichTextCard',
              content_format: 'markdown',
              content_source: 'file',
              content_file: 'notes/article.md',
            }}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    let imported: { path: string } | undefined;
    await act(async () => {
      imported = await editorImportResource?.({
        file: new File(['# updated'], 'article.md', { type: 'text/markdown' }),
        preferredPath: 'notes/article.md',
      });
      await Promise.resolve();
    });

    expect(imported).toEqual({ path: 'notes/article.md' });
  });

  it('commits referenced resource-only updates without remounting the editor', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{
              id: 'base-1',
              card_type: 'RichTextCard',
              content_format: 'markdown',
              content_source: 'file',
              content_file: 'notes/article.md',
            }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    expect(mockRenderEditor).toHaveBeenCalledTimes(1);

    await act(async () => {
      await editorImportResource?.({
        file: new File(['# updated'], 'article.md', { type: 'text/markdown' }),
        preferredPath: 'notes/article.md',
      });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(260);
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange).toHaveBeenCalledWith(
      {
        id: 'base-1',
        card_type: 'RichTextCard',
        content_format: 'markdown',
        content_source: 'file',
        content_file: 'notes/article.md',
      },
      {
        imports: [
          expect.objectContaining({
            path: 'notes/article.md',
            mimeType: 'text/markdown',
          }),
        ],
        deletions: [],
      },
    );
    expect(mockRenderEditor).toHaveBeenCalledTimes(1);
  });

  it('resolves persisted image resources to card-root file urls for editor previews', async () => {
    const resolvedUrls: string[] = [];
    mockRenderEditor.mockReset();
    mockRenderEditor.mockImplementation(({ resolveResourceUrl }) => {
      void resolveResourceUrl?.('gallery/封面 图.png').then((url: string) => {
        resolvedUrls.push(url);
      });
      return () => undefined;
    });

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="ImageCard"
            baseCardId="base-1"
            config={{
              id: 'base-1',
              images: [
                {
                  id: 'image-1',
                  source: 'file',
                  file_path: 'gallery/封面 图.png',
                },
              ],
            }}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(resolvedUrls).toEqual([
      'file:///workspace/card-1.card/gallery/%E5%B0%81%E9%9D%A2%20%E5%9B%BE.png',
    ]);
  });

  it('keeps using blob previews for committed imports until card persistence finishes', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="ImageCard"
            baseCardId="base-1"
            config={{ id: 'base-1', images: [] }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    const file = new File(['image'], 'photo.png', { type: 'image/png' });

    await act(async () => {
      await editorImportResource?.({
        file,
        preferredPath: 'photo.png',
      });
      editorChangeHandler?.({
        id: 'base-1',
        images: [
          {
            id: 'image-1',
            source: 'file',
            file_path: 'photo.png',
          },
        ],
      });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(editorResolveResourceUrl).not.toBeNull();
    expect(mockRenderEditor).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="ImageCard"
            baseCardId="base-1"
            config={{
              id: 'base-1',
              images: [
                {
                  id: 'image-1',
                  source: 'file',
                  file_path: 'photo.png',
                },
              ],
            }}
            pendingResourceImports={new Map([
              ['photo.png', { path: 'photo.png', data: new Uint8Array([1, 2, 3]), mimeType: 'image/png' }],
            ])}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    const resolvedUrl = await editorResolveResourceUrl?.('photo.png');
    expect(resolvedUrl?.startsWith('blob:')).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();
    expect(mockRenderEditor).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached editor preview urls when pending imports are replaced in place', async () => {
    createObjectURL
      .mockReturnValueOnce('blob:photo-v1')
      .mockReturnValueOnce('blob:photo-v2');

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="ImageCard"
            baseCardId="base-1"
            config={{
              id: 'base-1',
              images: [
                {
                  id: 'image-1',
                  source: 'file',
                  file_path: 'photo.png',
                },
              ],
            }}
            pendingResourceImports={new Map([
              ['photo.png', { path: 'photo.png', data: new Uint8Array([1, 2, 3]), mimeType: 'image/png', token: 'v1' }],
            ])}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    expect(mockRenderEditor).toHaveBeenCalledTimes(1);
    await expect(editorResolveResourceUrl?.('photo.png')).resolves.toBe('blob:photo-v1');

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="ImageCard"
            baseCardId="base-1"
            config={{
              id: 'base-1',
              images: [
                {
                  id: 'image-1',
                  source: 'file',
                  file_path: 'photo.png',
                },
              ],
            }}
            pendingResourceImports={new Map([
              ['photo.png', { path: 'photo.png', data: new Uint8Array([4, 5, 6]), mimeType: 'image/png', token: 'v2' }],
            ])}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    await expect(editorResolveResourceUrl?.('photo.png')).resolves.toBe('blob:photo-v2');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-v1');
    expect(mockRenderEditor).toHaveBeenCalledTimes(1);
  });

  it('stages TIFF conversion results back into the editor session for music cover extraction', async () => {
    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="MusicCard"
            baseCardId="base-1"
            config={{ id: 'base-1', card_type: 'MusicCard', audio_file: 'tracks/demo.mp3' }}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    expect(editorConvertTiffToPng).not.toBeNull();

    await act(async () => {
      await editorImportResource?.({
        file: new File(['tiff'], 'source.tiff', { type: 'image/tiff' }),
        preferredPath: 'source.tiff',
      });
      await Promise.resolve();
    });

    let converted:
      | {
          path: string;
          mimeType: 'image/png';
          sourceMimeType: 'image/tiff';
          width?: number;
          height?: number;
        }
      | undefined;

    await act(async () => {
      converted = await editorConvertTiffToPng?.({
        resourcePath: 'source.tiff',
        outputPath: 'cover.png',
        overwrite: true,
      });
      await Promise.resolve();
    });

    expect(vi.mocked(resourceService.convertTiffToPng)).toHaveBeenCalledWith({
      resourceId: expect.stringMatching(/^\/workspace\/card-1\.card\/\.card\/\.__editor-base-1-.*\.tiff$/),
      outputFile: expect.stringMatching(/^\/workspace\/card-1\.card\/\.card\/\.__editor-base-1-.*\.png$/),
      overwrite: true,
    });
    expect(converted).toEqual({
      path: 'cover.png',
      mimeType: 'image/png',
      sourceMimeType: 'image/tiff',
      width: 320,
      height: 320,
    });

    const resolvedUrl = await editorResolveResourceUrl?.('cover.png');
    expect(resolvedUrl?.startsWith('blob:')).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();
    expect(vi.mocked(fileService.delete)).toHaveBeenCalled();
  });

  it('keeps the mounted editor stable when its own committed config is reflected back through props', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'init' }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    expect(mockRenderEditor).toHaveBeenCalledTimes(1);

    await act(async () => {
      editorChangeHandler?.({ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'updated' });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(260);
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledWith(
      {
        id: 'base-1',
        card_type: 'RichTextCard',
        content_format: 'markdown',
        content_source: 'inline',
        content_text: 'updated',
      },
      undefined,
    );

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{ id: 'base-1', card_type: 'RichTextCard', content_format: 'markdown', content_source: 'inline', content_text: 'updated' }}
            onConfigChange={onConfigChange}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
    });

    expect(mockRenderEditor).toHaveBeenCalledTimes(1);
  });

  it('resolves pending text resources through runtime resource urls', async () => {
    const resolvedUrls: string[] = [];
    mockRenderEditor.mockReset();
    mockRenderEditor.mockImplementation(({ resolveResourceUrl }) => {
      void resolveResourceUrl?.('docs/article.md').then((resourceUrl: string) => {
        resolvedUrls.push(resourceUrl);
      });
      return () => undefined;
    });

    await act(async () => {
      root.render(
        <EditorRuntimeProvider>
          <PluginHost
            cardId="card-1"
            cardPath="/workspace/card-1.card"
            cardType="RichTextCard"
            baseCardId="base-1"
            config={{
              id: 'base-1',
              card_type: 'RichTextCard',
              content_format: 'markdown',
              content_source: 'file',
              content_file: 'docs/article.md',
            }}
            pendingResourceImports={new Map([
              ['docs/article.md', { path: 'docs/article.md', data: new TextEncoder().encode('# Pending Markdown') }],
            ])}
          />
        </EditorRuntimeProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(resolvedUrls).toHaveLength(1);
    expect(resolvedUrls[0]?.startsWith('blob:')).toBe(true);
  });
});
