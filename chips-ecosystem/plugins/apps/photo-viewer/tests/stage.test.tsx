import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { IChipsBridge, IResourceHandle, ISubscription } from '@chips/sdk';
import { AppView } from '../src/ui/AppView';

/**
 * 壳/舞台集成测试：以注入 `window.chips` 假桥的方式驱动 AppView，
 * 断言打开投递消费、读图链路、打开臂/保存副本的诚实降级（禁假成功）。
 * 假桥只按已登记能力 ID 回放平台行为，不 mock 业务逻辑。
 */

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

type RequestHandler = (input: unknown) => unknown;

interface FakeBridge {
  readonly bridge: IChipsBridge;
  readonly requests: ReadonlyArray<{ id: string; input: unknown }>;
  readonly subscriptions: Map<string, (payload: unknown) => void>;
  setRequestHandler(id: string, handler: RequestHandler): void;
  emitResourceOpened(payload: unknown): void;
}

function createFakeBridge(): FakeBridge {
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
      return Promise.reject(Object.assign(new Error(`能力未登记：${capabilityId}`), { code: 'CAPABILITY_UNAVAILABLE' }));
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
        return Promise.resolve(PNG_BYTES);
      },
      readRange: () => Promise.reject(Object.assign(new Error('未实现'), { code: 'CAPABILITY_UNAVAILABLE' })),
      stream: () => {
        throw Object.assign(new Error('未实现'), { code: 'CAPABILITY_UNAVAILABLE' });
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

function textOf(container: HTMLDivElement, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

function openContext(payload: Record<string, unknown> | undefined, uri = 'chips-resource://ws/demo/photo.png'): unknown {
  return {
    pluginId: 'chips.official.photo-viewer',
    context: {
      intent: 'view',
      origin: 'frame',
      uri,
      mimeType: 'image/png',
      slot: 'mime:image/png',
      fileName: 'photo.png',
      ...(payload === undefined ? {} : { payload }),
    },
  };
}

describe('AppView 壳/舞台（含打开臂诚实降级）', () => {
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

  it('启动后呈现空态与打开图片入口，未伪造任何查看内容', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    expect(textOf(container, '[data-role="photo-empty-title"]')).toBe('未打开图片');
    expect(container.querySelector('[data-role="stage-image"]')).toBeNull();
    const openButton = container.querySelector<HTMLButtonElement>('[data-role="empty-open"]');
    expect(openButton).not.toBeNull();

    // 文件选择交平台对话框；选中后经 resource:open 正式面请求 image 槽位。
    fake.setRequestHandler('dialog:open', () => ({ canceled: false, paths: ['/tmp/照片.png'] }));
    act(() => {
      openButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    // 打开臂经 dialog:open + resource:open 正式面；宿主未就绪时如实报错，不假成功。
    expect(fake.requests.some((call) => call.id === 'dialog:open')).toBe(true);
    expect(fake.requests.some((call) => call.id === 'resource:open')).toBe(true);
    const feedback = textOf(container, '[data-role="photo-feedback"]');
    expect(feedback).toContain('图片暂时无法打开');
  });

  it('resource:opened 单图投递建立查看态并展示读到的图片', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(openContext(undefined));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const image = container.querySelector<HTMLImageElement>('[data-role="stage-image"]');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toMatch(/^blob:mock-/);
    expect(textOf(container, '[data-role="dock-title"]')).toBe('photo.png');
  });

  it('读图失败时呈现行内错误与重试入口，不伪造成功', async () => {
    const fake = createFakeBridge();
    fake.setRequestHandler(
      'read:chips-resource://ws/demo/photo.png',
      () => Promise.reject(Object.assign(new Error('拒绝读取'), { code: 'RESOURCE_PERMISSION_DENIED' })),
    );
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(openContext(undefined));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-role="photo-feedback"][role="alert"]')).not.toBeNull();
    expect(textOf(container, '[data-role="photo-feedback"]')).toContain('RESOURCE_PERMISSION_DENIED');
    expect(container.querySelector('[data-role="feedback-retry"]')).not.toBeNull();
  });

  it('图包载荷按序建立队列，键盘与胶片条可导航', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    const payload = {
      kind: 'chips.book-card',
      version: '1.0.0',
      cardType: 'base.book',
      mode: 'image-sequence',
      resources: {
        images: [
          { uri: 'chips-resource://book/p/001.png', relativePath: 'p/001.png' },
          { uri: 'chips-resource://book/p/002.png', relativePath: 'p/002.png' },
        ],
      },
      display: { title: '图包画册' },
    };
    act(() => {
      fake.emitResourceOpened(openContext(payload, 'chips-resource://book/p/001.png'));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelectorAll('[data-role="filmstrip-item"]')).toHaveLength(2);
    expect(textOf(container, '[data-role="dock-position"]')).toBe('1 / 2');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(textOf(container, '[data-role="dock-position"]')).toBe('2 / 2');

    act(() => {
      const items = container.querySelectorAll<HTMLButtonElement>('[data-role="filmstrip-item"]');
      items[0]?.click();
    });
    expect(textOf(container, '[data-role="dock-position"]')).toBe('1 / 2');
  });

  it('保存副本经 dialog:save + file:write 正式面完成并给出成功反馈', async () => {
    const fake = createFakeBridge();
    fake.setRequestHandler('dialog:save', () => ({ canceled: false, path: '/tmp/副本.png' }));
    fake.setRequestHandler('file:write', () => undefined);
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(openContext(undefined));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const saveButton = container.querySelector<HTMLButtonElement>('[aria-label="保存副本"]');
    expect(saveButton).not.toBeNull();
    act(() => {
      saveButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fake.requests.some((call) => call.id === 'dialog:save')).toBe(true);
    const write = fake.requests.find((call) => call.id === 'file:write');
    expect(write).toBeDefined();
    expect((write?.input as { path: string }).path).toBe('/tmp/副本.png');
    expect(textOf(container, '[data-role="photo-feedback"]')).toContain('图片副本已保存');
  });

  it('保存副本失败时行内呈现错误码，不伪造成功', async () => {
    const fake = createFakeBridge();
    fake.setRequestHandler('dialog:save', () => ({ canceled: false, path: '/tmp/副本.png' }));
    fake.setRequestHandler(
      'file:write',
      () => Promise.reject(Object.assign(new Error('拒绝写入'), { code: 'BRIDGE_PERMISSION_DENIED' })),
    );
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(openContext(undefined));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="保存副本"]')?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(textOf(container, '[data-role="photo-feedback"]')).toContain('BRIDGE_PERMISSION_DENIED');
  });

  it('滚轮缩放驱动相机并更新缩放徽标（舞台级相机链路）', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitResourceOpened(openContext(undefined));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // jsdom 不加载图片：以 load 事件驱动 onLoad 链路（尺寸上报 → 相机交互可用）。
    act(() => {
      container.querySelector<HTMLImageElement>('[data-role="stage-image"]')?.dispatchEvent(new Event('load'));
    });
    expect(textOf(container, '[data-role="zoom-badge"]')).toBe('100%');
    const viewport = container.querySelector<HTMLDivElement>('[data-role="photo-viewport"]');
    expect(viewport).not.toBeNull();
    const wheelEvent = new WheelEvent('wheel', { deltaY: -120, deltaMode: 0, ctrlKey: true, cancelable: true });
    act(() => {
      viewport?.dispatchEvent(wheelEvent);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(textOf(container, '[data-role="zoom-badge"]')).toBe('127%');
  });
});
