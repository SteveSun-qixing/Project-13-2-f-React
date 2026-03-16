// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginHost } from '../../src/components/EditPanel/PluginHost';
import type { BasecardChangePayload } from 'chips-sdk';

const openSession = vi.fn();
const closeSession = vi.fn();
const renderEditor = vi.fn();
const onReady = vi.fn();
const onHeight = vi.fn();
const onChange = vi.fn();
const onError = vi.fn();

let readyHandler: (() => void) | null = null;
let changeHandler: ((payload: BasecardChangePayload) => void) | null = null;
let capturedResources:
  | {
      resolveResourceUrl?: (resourcePath: string) => Promise<string>;
      releaseResourceUrl?: (resourcePath: string) => void;
      importResource?: (input: { file: File; preferredPath?: string }) => Promise<{ path: string }>;
      deleteResource?: (resourcePath: string) => Promise<void>;
    }
  | null = null;

vi.mock('../../src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/services/file-service', () => ({
  fileService: {
    readBinary: vi.fn(async () => new Uint8Array([1, 2, 3])),
    exists: vi.fn(async () => false),
  },
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    card: {
      basecard: {
        openSession,
        closeSession,
        renderEditor,
        onReady,
        onHeight,
        onChange,
        onError,
      },
    },
  }),
}));

describe('PluginHost', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    readyHandler = null;
    changeHandler = null;
    capturedResources = null;

    openSession.mockReset();
    closeSession.mockReset();
    renderEditor.mockReset();
    onReady.mockReset();
    onHeight.mockReset();
    onChange.mockReset();
    onError.mockReset();

    openSession.mockResolvedValue({
      sessionId: 'session-1',
      pluginId: 'chips.basecard.richtext',
      cardType: 'base.richtext',
      baseCardId: 'base-1',
      displayName: '富文本基础卡片',
      normalizedConfig: { id: 'base-1', body: '<p>init</p>' },
      validation: { valid: true, issues: [] },
      referencedResources: [],
      commitDebounceMs: 260,
      supportsEditor: true,
    });
    closeSession.mockResolvedValue({ closed: true });
    renderEditor.mockImplementation(async ({ resources }: { sessionId: string; resources?: unknown }) => {
      capturedResources = (resources ?? null) as typeof capturedResources;
      return {
        frame: document.createElement('iframe'),
        origin: 'https://example.test',
      };
    });
    onReady.mockImplementation((_frame: HTMLIFrameElement, handler: () => void) => {
      readyHandler = handler;
      return () => undefined;
    });
    onHeight.mockImplementation(() => () => undefined);
    onChange.mockImplementation((_frame: HTMLIFrameElement, handler: (payload: BasecardChangePayload) => void) => {
      changeHandler = handler;
      return () => undefined;
    });
    onError.mockImplementation(() => () => undefined);
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
        <PluginHost
          cardId="card-1"
          cardPath="/workspace/card-1.card"
          cardType="base.richtext"
          baseCardId="base-1"
          config={{ id: 'base-1', body: '<p>init</p>' }}
          onConfigChange={onConfigChange}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      readyHandler?.();
      changeHandler?.({
        baseCardId: 'base-1',
        cardType: 'base.richtext',
        pluginId: 'chips.basecard.richtext',
        normalizedConfig: { id: 'base-1', body: '<p>a</p>' },
        validation: { valid: true, issues: [] },
        referencedResources: [],
      });
      changeHandler?.({
        baseCardId: 'base-1',
        cardType: 'base.richtext',
        pluginId: 'chips.basecard.richtext',
        normalizedConfig: { id: 'base-1', body: '<p>ab</p>' },
        validation: { valid: true, issues: [] },
        referencedResources: [],
      });
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
        body: '<p>ab</p>',
      },
      undefined,
    );
  });

  it('flushes the last pending editor draft before unmount', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <PluginHost
          cardId="card-1"
          cardPath="/workspace/card-1.card"
          cardType="base.richtext"
          baseCardId="base-1"
          config={{ id: 'base-1', body: '<p>init</p>' }}
          onConfigChange={onConfigChange}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      changeHandler?.({
        baseCardId: 'base-1',
        cardType: 'base.richtext',
        pluginId: 'chips.basecard.richtext',
        normalizedConfig: { id: 'base-1', body: '<p>final</p>' },
        validation: { valid: true, issues: [] },
        referencedResources: [],
      });
      await Promise.resolve();
    });

    expect(onConfigChange).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange).toHaveBeenCalledWith(
      {
        id: 'base-1',
        body: '<p>final</p>',
      },
      undefined,
    );
    expect(closeSession).toHaveBeenCalledWith('session-1');
  });

  it('commits immediately after a draft starts referencing newly imported resources', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    openSession.mockResolvedValue({
      sessionId: 'session-image',
      pluginId: 'chips.basecard.image',
      cardType: 'base.image',
      baseCardId: 'base-1',
      displayName: '图片基础卡片',
      normalizedConfig: { id: 'base-1', images: [] },
      validation: { valid: true, issues: [] },
      referencedResources: [],
      commitDebounceMs: 260,
      supportsEditor: true,
    });

    await act(async () => {
      root.render(
        <PluginHost
          cardId="card-1"
          cardPath="/workspace/card-1.card"
          cardType="base.image"
          baseCardId="base-1"
          config={{ id: 'base-1', images: [] }}
          onConfigChange={onConfigChange}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const file = new File(['image'], 'photo.png', { type: 'image/png' });

    await act(async () => {
      const imported = await capturedResources?.importResource?.({
        file,
        preferredPath: 'photo.png',
      });
      changeHandler?.({
        baseCardId: 'base-1',
        cardType: 'base.image',
        pluginId: 'chips.basecard.image',
        normalizedConfig: {
          id: 'base-1',
          images: [
            {
              id: 'image-1',
              source: 'file',
              file_path: imported?.path ?? 'photo.png',
            },
          ],
        },
        validation: { valid: true, issues: [] },
        referencedResources: [imported?.path ?? 'photo.png'],
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

  it('keeps the mounted editor stable when its own committed config is reflected back through props', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    await act(async () => {
      root.render(
        <PluginHost
          cardId="card-1"
          cardPath="/workspace/card-1.card"
          cardType="base.richtext"
          baseCardId="base-1"
          config={{ id: 'base-1', body: '<p>init</p>' }}
          onConfigChange={onConfigChange}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(openSession).toHaveBeenCalledTimes(1);
    expect(renderEditor).toHaveBeenCalledTimes(1);

    await act(async () => {
      changeHandler?.({
        baseCardId: 'base-1',
        cardType: 'base.richtext',
        pluginId: 'chips.basecard.richtext',
        normalizedConfig: { id: 'base-1', body: '<p>updated</p>' },
        validation: { valid: true, issues: [] },
        referencedResources: [],
      });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(260);
      await Promise.resolve();
    });

    await act(async () => {
      root.render(
        <PluginHost
          cardId="card-1"
          cardPath="/workspace/card-1.card"
          cardType="base.richtext"
          baseCardId="base-1"
          config={{ id: 'base-1', body: '<p>updated</p>' }}
          onConfigChange={onConfigChange}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(openSession).toHaveBeenCalledTimes(1);
    expect(renderEditor).toHaveBeenCalledTimes(1);
  });

  it('does not remount the editor when parent rerenders with a new onConfigChange closure after repeated typing', async () => {
    vi.useFakeTimers();

    function Harness() {
      const [config, setConfig] = useState<Record<string, unknown>>({
        id: 'base-1',
        body: '<p>init</p>',
      });

      return (
        <PluginHost
          cardId="card-1"
          cardPath="/workspace/card-1.card"
          cardType="base.richtext"
          baseCardId="base-1"
          config={config}
          onConfigChange={(nextConfig) => {
            setConfig(nextConfig);
          }}
        />
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(openSession).toHaveBeenCalledTimes(1);
    expect(renderEditor).toHaveBeenCalledTimes(1);

    for (const body of ['<p>a</p>', '<p>ab</p>', '<p>abc</p>']) {
      await act(async () => {
        changeHandler?.({
          baseCardId: 'base-1',
          cardType: 'base.richtext',
          pluginId: 'chips.basecard.richtext',
          normalizedConfig: { id: 'base-1', body },
          validation: { valid: true, issues: [] },
          referencedResources: [],
        });
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(260);
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    expect(openSession).toHaveBeenCalledTimes(1);
    expect(renderEditor).toHaveBeenCalledTimes(1);
  });
});
