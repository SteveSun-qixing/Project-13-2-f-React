import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { IChipsBridge, IResourceHandle, ISubscription } from '@chips/sdk';
import { AppView } from '../src/ui/AppView';

/**
 * 壳/舞台集成测试：以注入 `window.chips` 假桥的方式驱动 AppView，
 * 断言打开投递消费、引擎挂载、读取降级与打开臂/命令族
 * 的诚实降级（禁假成功）。假桥只按已登记能力 ID 回放平台行为，不 mock 业务逻辑。
 */

const UTF8 = new TextEncoder();

function textBytes(content: string): Uint8Array {
  return UTF8.encode(content);
}

type RequestHandler = (input: unknown) => unknown;

interface FakeBridge {
  readonly bridge: IChipsBridge;
  readonly requests: ReadonlyArray<{ id: string; input: unknown }>;
  readonly subscriptions: Map<string, (payload: unknown) => void>;
  setRequestHandler(id: string, handler: RequestHandler): void;
  emitResourceOpened(payload: unknown): void;
  emitCommandInvoked(payload: unknown): void;
}

function createFakeBridge(resourceBodies: Record<string, Uint8Array> = {}): FakeBridge {
  const requests: Array<{ id: string; input: unknown }> = [];
  const handlers = new Map<string, RequestHandler>();
  const subscriptions = new Map<string, (payload: unknown) => void>();

  const bridge: IChipsBridge = {
    request: <TOutput,>(capabilityId: string, input?: unknown): Promise<TOutput> => {
      requests.push({ id: capabilityId, input });
      const handler = handlers.get(capabilityId);
      if (handler) {
        return Promise.resolve(handler(input)) as Promise<TOutput>;
      }
      return Promise.reject(
        Object.assign(new Error(`能力未登记：${capabilityId}`), { code: 'CAPABILITY_UNAVAILABLE' })
      );
    },
    subscribe: (eventId: string, handler: (payload: unknown) => void): ISubscription => {
      subscriptions.set(eventId, handler);
      return { dispose: (): void => undefined };
    },
    resource: (uri: string): IResourceHandle => ({
      uri,
      state: 'open',
      metadata: () => Promise.reject(Object.assign(new Error('未实现'), { code: 'CAPABILITY_UNAVAILABLE' })),
      read: () => {
        const handler = handlers.get(`read:${uri}`);
        if (handler) {
          return Promise.resolve(handler(undefined)) as Promise<Uint8Array>;
        }
        const bytes = resourceBodies[uri];
        if (bytes === undefined) {
          return Promise.reject(Object.assign(new Error('资源不存在'), { code: 'RESOURCE_NOT_FOUND' }));
        }
        return Promise.resolve(bytes);
      },
      readRange: () => Promise.reject(Object.assign(new Error('未实现'), { code: 'CAPABILITY_UNAVAILABLE' })),
      stream: () => {
        const bytes = resourceBodies[uri] ?? new Uint8Array(0);
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });
      },
      release: (): void => undefined,
      onInvalidate: (): ISubscription => ({ dispose: (): void => undefined }),
    }),
  };

  return {
    bridge,
    requests,
    subscriptions,
    setRequestHandler: (id, handler): void => {
      handlers.set(id, handler);
    },
    emitResourceOpened: (payload): void => {
      const handler = subscriptions.get('resource:opened');
      if (handler) {
        handler(payload);
      }
    },
    emitCommandInvoked: (payload): void => {
      const handler = subscriptions.get('command:invoked');
      if (handler) {
        handler(payload);
      }
    },
  };
}

const containers: HTMLDivElement[] = [];
const roots: Root[] = [];

async function mountApp(): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(<AppView />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

/** 泵送事件循环直至断言条件成立（引擎异步渲染链的时长随负载浮动，固定轮次会漏尾）。 */
async function waitFor(predicate: () => boolean, description: string, maxMs = 3500): Promise<void> {
  const deadline = Date.now() + maxMs;
  for (;;) {
    if (predicate()) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`等待超时：${description}`);
    }
    await act(async () => {
      await new Promise<void>((resolveTick) => {
        setTimeout(resolveTick, 8);
      });
    });
  }
}

function textOf(container: Element, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

function openContext(payload: Record<string, unknown> | undefined, uri: string, mimeType: string, fileName: string): unknown {
  return {
    pluginId: 'chips.official.universal-file-viewer',
    context: {
      intent: 'view',
      origin: 'frame',
      uri,
      mimeType,
      slot: `mime:${mimeType}`,
      fileName,
      ...(payload === undefined ? {} : { payload }),
    },
  };
}

describe('AppView 壳/舞台（含打开臂与命令族诚实降级）', () => {
  afterEach(() => {
    roots.forEach((root) => {
      act(() => {
        root.unmount();
      });
    });
    roots.length = 0;
    containers.forEach((container) => container.remove());
    containers.length = 0;
    delete (window as { chips?: unknown }).chips;
  });

  it('启动后呈现空态与打开文件入口，未伪造任何查看内容', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    expect(textOf(container, '[data-role="viewer-empty-title"]')).toBe('未打开文件');
    expect(container.querySelector('[data-role="engine-stage"] .ofv-viewport')).toBeNull();
    const openButton = container.querySelector<HTMLButtonElement>('[data-role="empty-open"]');
    expect(openButton).not.toBeNull();

    // 文件选择交平台对话框；选中后经 resource:open 正式面请求路由（fallback 层）。
    fake.setRequestHandler('dialog:open', () => ({ canceled: false, paths: ['/tmp/报表.pdf'] }));
    act(() => {
      openButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fake.requests.some((call) => call.id === 'dialog:open')).toBe(true);
    const openRequest = fake.requests.find((call) => call.id === 'resource:open');
    expect(openRequest).toBeDefined();
    expect((openRequest?.input as { resource: { uri: string } }).resource.uri).toBe('/tmp/报表.pdf');
    expect((openRequest?.input as { intent: string }).intent).toBe('view');
    // 宿主 resource:open 处理器未注册时如实反馈，不假成功（工单060 族口径）。
    expect(textOf(container, '[data-role="viewer-feedback"]')).toContain('暂时无法打开');
  });

  it('resource:opened 文本投递经引擎渲染预览并回填格式信息', async () => {
    const fake = createFakeBridge({
      'chips-resource://ws/demo/notes.txt': textBytes('薯片查看器测试文本\n第二行内容'),
    });
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(
        openContext(undefined, 'chips-resource://ws/demo/notes.txt', 'text/plain', 'notes.txt')
      );
    });
    await waitFor(
      () => container.querySelector('.ofv-code-container') !== null,
      '文本预览渲染',
    );

    const viewport = container.querySelector('[data-role="engine-stage"] .ofv-viewport');
    expect(viewport).not.toBeNull();
    expect(container.querySelector('.ofv-code-container')).not.toBeNull();
    expect(container.querySelector('[data-role="engine-stage"]')?.textContent).toContain('第二行内容');
    expect(textOf(container, '[data-role="dock-title"]')).toBe('notes.txt');
    expect(textOf(container, '[data-role="viewer-status"]')).toBeNull();

    // 格式信息面板回填引擎识别结果（Drawer 渲染在 body 门户，不在挂载容器内）。
    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="格式信息"]')?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(textOf(document.body, '[data-role="info-file-name"]')).toBe('notes.txt');
    expect(textOf(document.body, '[data-role="info-mime"]')).toBe('text/plain');
    expect(textOf(document.body, '[data-role="info-size"]')).toContain('B');
  });

  it('读取失败时呈现行内错误与重试入口，不伪造成功', async () => {
    const fake = createFakeBridge();
    let readCalls = 0;
    fake.setRequestHandler('read:chips-resource://ws/demo/broken.txt', () => {
      readCalls += 1;
      if (readCalls === 1) {
        return Promise.reject(Object.assign(new Error('拒绝读取'), { code: 'RESOURCE_PERMISSION_DENIED' }));
      }
      return textBytes('恢复后的内容');
    });
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(
        openContext(undefined, 'chips-resource://ws/demo/broken.txt', 'text/plain', 'broken.txt')
      );
    });
    await waitFor(
      () => container.querySelector('[data-role="viewer-feedback"][role="alert"]') !== null,
      '读取失败反馈',
    );

    const feedback = container.querySelector('[data-role="viewer-feedback"][role="alert"]');
    expect(feedback).not.toBeNull();
    expect(textOf(container, '[data-role="viewer-feedback"]')).toContain('RESOURCE_PERMISSION_DENIED');
    expect(container.querySelector('[data-role="feedback-retry"]')).not.toBeNull();

    // 重试路径在能力恢复后成功（诚实恢复，不是假成功遮罩）。
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-role="feedback-retry"]')?.click();
    });
    await waitFor(
      () => container.querySelector('.ofv-code-container') !== null,
      '重试后的文本预览渲染',
    );
    expect(container.querySelector('[data-role="engine-stage"]')?.textContent).toContain('恢复后的内容');
  });

  it('图包载荷按序建立队列，工具栏与命令派发均可切换视图', async () => {
    const fake = createFakeBridge({
      'chips-resource://book/p/001.txt': textBytes('第一页'),
      'chips-resource://book/p/002.txt': textBytes('第二页'),
    });
    fake.setRequestHandler('command:register', () => undefined);
    fake.setRequestHandler('command:unregister', () => undefined);
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    const payload = {
      kind: 'chips.book-card',
      version: '1.0.0',
      cardType: 'base.book',
      mode: 'image-sequence',
      resources: {
        images: [
          { uri: 'chips-resource://book/p/001.txt', relativePath: 'p/001.txt' },
          { uri: 'chips-resource://book/p/002.txt', relativePath: 'p/002.txt' },
        ],
      },
      display: { title: '文本序列' },
    };
    act(() => {
      fake.emitResourceOpened(openContext(payload, 'chips-resource://book/p/001.txt', 'text/plain', '001.txt'));
    });
    await waitFor(
      () => textOf(container, '[data-role="dock-position"]') === '1 / 2',
      '队列位置展示',
    );

    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="下一个文件"]')?.click();
    });
    await waitFor(
      () => textOf(container, '[data-role="dock-position"]') === '2 / 2',
      '切换到第二个文件',
    );

    // 命令族：command:invoked 派发 previous-file 经本地处理器驱动引擎回退。
    act(() => {
      fake.emitCommandInvoked({
        commandId: 'universal-file-viewer:previous-file',
        handlerId: 'previous-file',
        payload: {},
      });
    });
    await waitFor(
      () => textOf(container, '[data-role="dock-position"]') === '1 / 2',
      '命令派发回退到第一个文件',
    );
  });

  it('refresh-view 命令驱动重新拉取当前资源', async () => {
    const fake = createFakeBridge();
    let readCount = 0;
    fake.setRequestHandler('read:chips-resource://ws/demo/notes.txt', () => {
      readCount += 1;
      return textBytes('内容');
    });
    fake.setRequestHandler('command:register', () => undefined);
    fake.setRequestHandler('command:unregister', () => undefined);
    (window as { chips?: unknown }).chips = fake.bridge;
    await mountApp();

    act(() => {
      fake.emitResourceOpened(
        openContext(undefined, 'chips-resource://ws/demo/notes.txt', 'text/plain', 'notes.txt')
      );
    });
    await waitFor(() => readCount >= 1, '首次资源读取');
    const readsBefore = readCount;

    act(() => {
      fake.emitCommandInvoked({
        commandId: 'universal-file-viewer:refresh-view',
        handlerId: 'refresh-view',
        payload: {},
      });
    });
    await waitFor(() => readCount > readsBefore, 'refresh-view 驱动重新读取');
  });

  it('无预览路径的格式呈现兜底信息卡与重试入口，不静默失败', async () => {
    const fake = createFakeBridge({
      'chips-resource://ws/demo/blob.xyzzy': new Uint8Array([0, 1, 2, 3]),
    });
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(
        openContext(undefined, 'chips-resource://ws/demo/blob.xyzzy', 'application/octet-stream', 'blob.xyzzy')
      );
    });
    await waitFor(
      () => container.querySelector('[data-role="viewer-unsupported"]') !== null,
      '兜底信息卡呈现',
    );

    expect(container.querySelector('[data-role="viewer-unsupported"]')).not.toBeNull();
    expect(textOf(container, '[data-role="unsupported-format"]')).toContain('XYZZY');
    expect(textOf(container, '[data-role="unsupported-format"]')).toContain('application/octet-stream');
    expect(container.querySelector('[data-role="unsupported-retry"]')).not.toBeNull();
    // 引擎未被挂载渲染兜底文件（壳层兜底卡承担 §8.4 表现）。
    expect(container.querySelector('.ofv-fallback')).toBeNull();
  });

  it('open-card 命令经 resource:open 正式面请求路由，未就绪时如实反馈', async () => {
    const fake = createFakeBridge();
    fake.setRequestHandler('command:register', () => undefined);
    fake.setRequestHandler('command:unregister', () => undefined);
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitCommandInvoked({
        commandId: 'universal-file-viewer:open-card',
        handlerId: 'open-card',
        payload: { path: '/tmp/示例.cpk' },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    const openRequest = fake.requests.find((call) => call.id === 'resource:open');
    expect(openRequest).toBeDefined();
    expect((openRequest?.input as { resource: { uri: string } }).resource.uri).toBe('/tmp/示例.cpk');
    expect(textOf(container, '[data-role="viewer-feedback"]')).toContain('暂时无法打开');
  });

  it('命令通道异常时呈现行内状态条，不影响查看主链路', async () => {
    const fake = createFakeBridge({
      'chips-resource://ws/demo/notes.txt': textBytes('内容'),
    });
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    expect(container.querySelector('[data-role="command-status"]')).not.toBeNull();
    act(() => {
      fake.emitResourceOpened(
        openContext(undefined, 'chips-resource://ws/demo/notes.txt', 'text/plain', 'notes.txt')
      );
    });
    await waitFor(
      () => container.querySelector('.ofv-code-container') !== null,
      '命令通道异常下的文本预览渲染',
    );
    expect(container.querySelector('.ofv-code-container')).not.toBeNull();
  });

  it('DWG 命中引擎 CAD 插件（元数据兜底按引擎臂裁决），壳层不拦截', async () => {
    const fake = createFakeBridge({
      'chips-resource://ws/cad/part.dwg': textBytes('AC1015 SECTION HEADER ENDSEC SECTION ENTITIES ENDSEC EOF'),
    });
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(
        openContext(undefined, 'chips-resource://ws/cad/part.dwg', 'image/vnd.dwg', 'part.dwg')
      );
    });
    await waitFor(
      () => container.querySelector('[data-role="engine-stage"] .ofv-viewport') !== null
        && container.querySelector('[data-role="viewer-status"]') === null,
      'CAD 投递进入引擎舞台',
    );

    // CAD 插件匹配（isPreviewableTarget 不再给出壳层兜底卡），渲染决策交引擎。
    expect(container.querySelector('[data-role="viewer-unsupported"]')).toBeNull();
    expect(container.querySelector('[data-role="engine-stage"] .ofv-viewport')).not.toBeNull();
  });
});
