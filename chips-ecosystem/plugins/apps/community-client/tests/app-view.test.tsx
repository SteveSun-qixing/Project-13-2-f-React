import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { IChipsBridge, ISubscription } from '@chips/sdk';
import { AppView } from '../src/ui/AppView';

/**
 * 壳层舞台集成测试：以注入 `window.chips` 假桥的方式驱动 AppView，
 * 断言路由表消费、设置面会话内存生效、候前置件登记呈现与命令通道的诚实降级（禁假成功）。
 * 假桥只按已登记能力 ID 回放平台行为，不 mock 业务逻辑。
 */

type RequestHandler = (input: unknown) => unknown;

interface FakeBridge {
  readonly bridge: IChipsBridge;
  readonly requests: ReadonlyArray<{ id: string; input: unknown }>;
  readonly subscriptions: Map<string, (payload: unknown) => void>;
  setRequestHandler(id: string, handler: RequestHandler): void;
  emitCommandInvoked(payload: unknown): void;
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
      return Promise.reject(
        Object.assign(new Error(`能力未登记：${capabilityId}`), { code: 'CAPABILITY_UNAVAILABLE' }),
      );
    },
    subscribe: (eventId: string, handler: (payload: unknown) => void): ISubscription => {
      subscriptions.set(eventId, handler);
      return { dispose: (): void => undefined };
    },
    resource: (): never => {
      throw Object.assign(new Error('本臂不消费资源句柄'), { code: 'CAPABILITY_UNAVAILABLE' });
    },
  };

  return {
    bridge,
    requests,
    subscriptions,
    setRequestHandler: (id, handler): void => {
      handlers.set(id, handler);
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

function textOf(container: HTMLDivElement, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

async function navigateHash(hash: string): Promise<void> {
  window.location.hash = hash;
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await Promise.resolve();
  });
}

/** 以原生 value setter 驱动受控输入（jsdom 不支持直接赋值触发 React onChange）。 */
function typeInputValue(element: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('AppView 壳层舞台（路由、设置面与命令通道诚实降级）', () => {
  afterEach(() => {
    roots.forEach((root) => {
      act(() => {
        root.unmount();
      });
    });
    roots.length = 0;
    containers.forEach((container) => container.remove());
    containers.length = 0;
    window.location.hash = '';
    delete (window as { chips?: unknown }).chips;
  });

  it('启动后呈现欢迎页、顶栏导航与登录入口，未伪造任何社区内容', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    expect(textOf(container, '[data-role="site-name"]')).toBe('薯片社区');
    expect(textOf(container, '[data-role="welcome-primary"]')).toBe('去注册');
    expect(textOf(container, '[data-role="welcome-scope"]')).toContain('6 项能力处于候前置件登记中');
    expect(container.querySelector('[data-role="nav-workspace"]')).not.toBeNull();
    expect(container.querySelector('[data-role="nav-login"]')).not.toBeNull();
  });

  it('命令通道不可用时如实呈现「命令通道异常」与错误码，界面照常工作', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    expect(fake.requests.some((call) => call.id === 'command:register')).toBe(true);
    expect(textOf(container, '[data-role="command-phase"]')).toContain('命令通道异常');
    expect(textOf(container, '[data-role="command-phase"]')).toContain('CAPABILITY_UNAVAILABLE');
    expect(container.querySelector('[data-role="welcome-primary"]')).not.toBeNull();
  });

  it('命令注册成功后状态为「命令已就绪」', async () => {
    const fake = createFakeBridge();
    fake.setRequestHandler('command:register', () => ({}));
    fake.setRequestHandler('command:unregister', () => ({}));
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    expect(textOf(container, '[data-role="command-phase"]')).toContain('命令已就绪');
  });

  it('设置页保存服务器地址：合法地址会话内存生效并如实标记未持久化，拒绝非法地址', async () => {
    const fake = createFakeBridge();
    fake.setRequestHandler('command:register', () => ({}));
    fake.setRequestHandler('command:unregister', () => ({}));
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    await navigateHash('#/settings');

    const input = container.querySelector<HTMLInputElement>('[data-role="server-input"]');
    const save = container.querySelector<HTMLButtonElement>('[data-role="server-save"]');
    expect(input).not.toBeNull();
    expect(input?.value).toBe('https://www.chipscard.space');
    expect(textOf(container, '[data-role="server-effective"]')).toContain('会话内存，未持久化');

    // 非法地址：行内呈现错误文案与支持范围，不假成功。
    act(() => {
      input?.focus();
    });
    if (input && save) {
      act(() => {
        typeInputValue(input, 'https://evil.example.com');
      });
      act(() => {
        save.click();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(textOf(container, '[data-role="server-error"]')).toContain('该服务器地址不在客户端支持范围内');
    }

    // 合法地址：即时生效，生效层仍如实标记会话内存。
    if (input && save) {
      act(() => {
        typeInputValue(input, 'http://127.0.0.1:3000/');
      });
      act(() => {
        save.click();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(container.querySelector('[data-role="server-error"]')).toBeNull();
      expect(textOf(container, '[data-role="server-effective"]')).toContain('http://127.0.0.1:3000');
      expect(textOf(container, '[data-role="server-effective"]')).toContain('会话内存，未持久化');
    }
  });

  it('设置页如实呈现六项候前置件登记（缺失域 + 落波去向）', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    await navigateHash('#/settings');

    for (const id of ['network', 'session', 'transfer', 'config', 'dialog-shell', 'server']) {
      expect(container.querySelector(`[data-role="pending-${id}"]`)).not.toBeNull();
    }
    expect(textOf(container, '[data-role="pending-network"]')).toContain('G6 后续批');
    expect(textOf(container, '[data-role="pending-server"]')).toContain('W6');
  });

  it('未登录访问工作区被守卫重定向登录页并如实登记候前置件', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    await navigateHash('#/workspace');

    expect(textOf(container, '[data-role="pending-title"]')).toBe('登录');
    expect(textOf(container, '[data-role="pending-description"]')).toContain('社区账号');
  });

  it('未登记路径呈现 404 页并提供返回首页入口', async () => {
    const fake = createFakeBridge();
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    await navigateHash('#/nowhere');
    expect(textOf(container, '[data-role="not-found"]')).toContain('404');

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-role="not-found-home"]')?.click();
    });
    // jsdom 的 hashchange 异步派发；等待宏任务并补发一次事件（路由处理幂等）。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await Promise.resolve();
    });
    expect(window.location.hash).toBe('#/');
    expect(textOf(container, '[data-role="welcome-primary"]')).toBe('去注册');
  });

  it('打开卡片命令派发：合法载荷登记本地查看请求并如实标记候传输链路，非法载荷拒绝执行', async () => {
    const fake = createFakeBridge();
    fake.setRequestHandler('command:register', () => ({}));
    fake.setRequestHandler('command:unregister', () => ({}));
    (window as { chips?: unknown }).chips = fake.bridge;
    const container = await mountApp();

    act(() => {
      fake.emitCommandInvoked({
        commandId: 'community-client:open-card',
        handlerId: 'open-card',
        payload: { path: '/tmp/东京旅行.card' },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(textOf(container, '[data-role="local-view-request"]')).toContain('/tmp/东京旅行.card');
    expect(textOf(container, '[data-role="local-view-request"]')).toContain('候卡片传输链路落波');

    act(() => {
      fake.emitCommandInvoked({
        commandId: 'community-client:open-card',
        handlerId: 'open-card',
        payload: { path: '   ' },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(textOf(container, '[data-role="command-invalid"]')).toContain('载荷不合法');
  });
});
