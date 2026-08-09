// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardWindow } from '../../src/components/CardWindow';
import { expectRealDocumentFixturesAvailable, realDocumentFixtures } from '../fixtures/real-documents';

type ReadyPayload = undefined;
type ErrorPayload = { code?: string; message?: string };
type NodeErrorPayload = { nodeId: string; code: string; message: string; documentType: 'card' };
type ResourceOpenPayload = {
  intent: string;
  resourceId: string;
  mimeType?: string;
  title?: string;
  fileName?: string;
  payload?: Record<string, unknown>;
};
type ResizePayload = { documentType: 'card' | 'box'; height: number; reason: string };
type DocumentWindowHandlerPayloads = {
  onReady: ReadyPayload;
  onError: ErrorPayload;
  onNodeError: NodeErrorPayload;
  onResourceOpen: ResourceOpenPayload;
  onResize: ResizePayload;
};
type DocumentWindowHandlerName = keyof DocumentWindowHandlerPayloads;

const mockState = vi.hoisted(() => {
  const dispose = vi.fn(async () => undefined);
  const cleanup = {
    onReady: vi.fn(),
    onError: vi.fn(),
    onNodeError: vi.fn(),
    onResourceOpen: vi.fn(),
    onResize: vi.fn(),
  };
  const handlers = {
    onReady: [] as Array<() => void>,
    onError: [] as Array<(payload: ErrorPayload) => void>,
    onNodeError: [] as Array<(payload: NodeErrorPayload) => void>,
    onResourceOpen: [] as Array<(payload: ResourceOpenPayload) => void>,
    onResize: [] as Array<(payload: ResizePayload) => void>,
  };
  const render = vi.fn(async (options: { filePath: string; locale?: string; mode?: string }) => ({
    frame: document.createElement('iframe'),
    origin: 'file://',
    dispose,
    documentType: options.filePath.endsWith('.box') ? 'box' as const : 'card' as const,
  }));

  return {
    client: {
      document: {
        detectType: vi.fn((filePath: string) => filePath.endsWith('.box') ? 'box' : 'card'),
        window: {
          render,
          onReady: vi.fn((_frame: HTMLIFrameElement, handler: () => void) => {
            handlers.onReady.push(handler);
            return cleanup.onReady;
          }),
          onResize: vi.fn((_frame: HTMLIFrameElement, handler: (payload: ResizePayload) => void) => {
            handlers.onResize.push(handler);
            return cleanup.onResize;
          }),
          onError: vi.fn((_frame: HTMLIFrameElement, handler: (payload: ErrorPayload) => void) => {
            handlers.onError.push(handler);
            return cleanup.onError;
          }),
          onNodeError: vi.fn((
            _frame: HTMLIFrameElement,
            handler: (payload: NodeErrorPayload) => void,
          ) => {
            handlers.onNodeError.push(handler);
            return cleanup.onNodeError;
          }),
          onResourceOpen: vi.fn((_frame: HTMLIFrameElement, handler: (payload: ResourceOpenPayload) => void) => {
            handlers.onResourceOpen.push(handler);
            return cleanup.onResourceOpen;
          }),
        },
      },
      resource: {
        open: vi.fn(async () => undefined),
      },
      platform: {
        showMessage: vi.fn(async () => undefined),
      },
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    dispose,
    cleanup,
    handlers,
  };
});

vi.mock('../../config/logging', () => ({
  createScopedLogger: () => mockState.logger,
}));

describe('统一文档查看窗口基础流程', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    Object.values(mockState.handlers).forEach((handlers) => {
      handlers.length = 0;
    });
    mockState.client.document.window.render.mockImplementation(async ({ filePath }: { filePath: string }) => ({
      frame: document.createElement('iframe'),
      origin: 'chips-render://',
      dispose: mockState.dispose,
      documentType: filePath.endsWith('.box') ? 'box' as const : 'card' as const,
    }));
    mockState.client.resource.open.mockResolvedValue(undefined);
  });
  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function renderCardWindow(filePath: string) {
    root.render(
      <CardWindow
        client={mockState.client as any}
        filePath={filePath}
        traceId="trace-document-view"
        locale="zh-CN"
        loadingLabel="正在加载文档…"
        containerErrorLabel="容器不可用"
        fatalErrorFallback="严重错误"
        renderErrorFallback="渲染失败"
        resourceOpenErrorTitle="无法打开资源"
        resourceOpenErrorFallback="资源打开失败"
      />,
    );
  }

  async function renderAndFlush(filePath: string) {
    await act(async () => {
      renderCardWindow(filePath);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function emitDocumentEvent<THandler extends DocumentWindowHandlerName>(
    name: THandler,
    payload: DocumentWindowHandlerPayloads[THandler],
  ) {
    for (const handler of mockState.handlers[name]) {
      if (payload === undefined) {
        (handler as () => void)();
      } else {
        (handler as (value: typeof payload) => void)(payload);
      }
    }
  }

  it('会通过统一 document.window.render 渲染真实箱子素材，并在卸载时释放 iframe 会话和事件订阅', async () => {
    expectRealDocumentFixturesAvailable(['foodGridBox']);

    await renderAndFlush(realDocumentFixtures.foodGridBox);

    expect(mockState.client.document.window.render).toHaveBeenCalledWith({
      filePath: realDocumentFixtures.foodGridBox,
      locale: 'zh-CN',
      mode: 'view',
    });
    expect(mockState.client.document.window.onReady).toHaveBeenCalledTimes(1);
    expect(mockState.client.document.window.onError).toHaveBeenCalledTimes(1);
    expect(mockState.client.document.window.onNodeError).toHaveBeenCalledTimes(1);
    expect(mockState.client.document.window.onResourceOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });

    expect(mockState.dispose).toHaveBeenCalled();
    expect(mockState.cleanup.onReady).toHaveBeenCalled();
    expect(mockState.cleanup.onError).toHaveBeenCalled();
    expect(mockState.cleanup.onNodeError).toHaveBeenCalled();
    expect(mockState.cleanup.onResourceOpen).toHaveBeenCalled();
  });

  it('会把真实复合卡片素材交给 document.window.render，不在查看器内解析卡片内容', async () => {
    expectRealDocumentFixturesAvailable(['compositeCard', 'richTextCard', 'markdownCard', 'mediaCard']);

    await renderAndFlush(realDocumentFixtures.compositeCard);

    expect(mockState.client.document.window.render).toHaveBeenCalledWith({
      filePath: realDocumentFixtures.compositeCard,
      locale: 'zh-CN',
      mode: 'view',
    });
    expect(mockState.client.document.detectType).toHaveBeenCalledWith(realDocumentFixtures.compositeCard);
    expect(container.querySelector('iframe')).toBeInstanceOf(HTMLIFrameElement);
  });

  it('通过 SDK 事件接口消费 ready、node-error、fatal-error 和 resource-open 协议', async () => {
    await renderAndFlush(realDocumentFixtures.compositeCard);

    await act(async () => {
      emitDocumentEvent('onReady', undefined);
    });
    expect(container.textContent).not.toContain('正在加载文档');

    await act(async () => {
      emitDocumentEvent('onNodeError', {
        documentType: 'card',
        nodeId: 'node-richtext',
        code: 'BASECARD_PLUGIN_MISSING',
        message: 'Rich text base card plugin is not enabled.',
      });
    });
    expect(mockState.logger.warn).toHaveBeenCalledWith(
      '收到复合卡片节点降级事件',
      expect.objectContaining({
        code: 'BASECARD_PLUGIN_MISSING',
        documentType: 'card',
        nodeId: 'node-richtext',
      }),
    );
    expect(container.textContent).not.toContain('Rich text base card plugin is not enabled.');

    await act(async () => {
      emitDocumentEvent('onResourceOpen', {
        intent: 'view',
        resourceId: 'image-hero',
        mimeType: 'image/png',
        title: 'Hero',
        fileName: 'hero.png',
        payload: { gallery: ['image-hero'] },
      });
      await Promise.resolve();
    });
    expect(mockState.client.resource.open).toHaveBeenCalledWith({
      intent: 'view',
      resource: {
        resourceId: 'image-hero',
        mimeType: 'image/png',
        title: 'Hero',
        fileName: 'hero.png',
        payload: { gallery: ['image-hero'] },
      },
    });

    await act(async () => {
      emitDocumentEvent('onError', {
        code: 'CARD_RENDER_FAILED',
        message: 'Composite card failed to render all nodes.',
      });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Composite card failed to render all nodes.');
  });

  it('资源打开失败时通过平台消息展示可诊断错误', async () => {
    mockState.client.resource.open.mockRejectedValueOnce(new Error('No image handler registered.'));

    await renderAndFlush(realDocumentFixtures.compositeCard);
    await act(async () => {
      emitDocumentEvent('onResourceOpen', {
        intent: 'view',
        resourceId: 'image-hero',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockState.client.platform.showMessage).toHaveBeenCalledWith({
      title: '无法打开资源',
      message: 'No image handler registered.',
    });
  });

  it('渲染失败时保留 Host/SDK 返回的错误信息', async () => {
    mockState.client.document.window.render.mockRejectedValueOnce(
      Object.assign(new Error('No enabled layout plugin can render chips.layout.grid.'), {
        code: 'BOX_LAYOUT_PLUGIN_NOT_FOUND',
      }),
    );

    await renderAndFlush(realDocumentFixtures.foodGridBox);

    expect(container.textContent).toContain('No enabled layout plugin can render chips.layout.grid.');
  });

  it('会按统一文档高度事件撑开本地查看 iframe 并关闭中间 iframe 滚动', async () => {
    let resizeHandler: ((payload: { documentType: 'card'; height: number; reason: string }) => void) | null = null;
    mockState.client.document.window.render.mockResolvedValueOnce({
      frame: document.createElement('iframe'),
      origin: 'file://',
      dispose: mockState.dispose,
      documentType: 'card' as const,
    });
    mockState.client.document.window.onResize.mockImplementationOnce((_frame, handler) => {
      resizeHandler = handler;
      return mockState.cleanup.onResize;
    });

    await act(async () => {
      root.render(
        <CardWindow
          client={mockState.client as any}
          filePath="/tmp/demo.card"
          traceId="trace-document-height"
          locale="zh-CN"
          loadingLabel="正在加载文档…"
          containerErrorLabel="容器不可用"
          fatalErrorFallback="严重错误"
          renderErrorFallback="渲染失败"
          resourceOpenErrorTitle="无法打开资源"
          resourceOpenErrorFallback="资源打开失败"
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const frame = container.querySelector('iframe');
    const viewport = container.querySelector('.card-viewer-window__viewport--document-flow');
    expect(viewport).not.toBeNull();
    expect(frame?.getAttribute('scrolling')).toBe('no');
    expect(frame?.style.height).toBe('960px');

    await act(async () => {
      resizeHandler?.({ documentType: 'card', height: 1840, reason: 'node-height' });
      await Promise.resolve();
    });

    expect(frame?.style.height).toBe('1840px');
  });
});
