import { describe, expect, it, vi } from 'vitest';
import { ChipsError, isChipsError, SDK_BRIDGE_UNAVAILABLE, toChipsError } from '../errors.js';
import { ChipsBridge, chips, createClient } from './chips-bridge.js';
import type {
  IChipsBridge,
  IResourceHandle,
  IResourceMetadata,
  ISubscription,
} from '../types/bridge.js';
import { mountWindow, windowHost } from '../../tests/helpers/window.js';

/** `vi.fn()` 产出的调用记录器；只在测试内观察调用参数。 */
type CallRecorder = ReturnType<typeof vi.fn>;

/** Bridge 三个方法面的调用记录器集合。 */
interface TargetSpies {
  readonly request: CallRecorder;
  readonly subscribe: CallRecorder;
  readonly resource: CallRecorder;
}

/** 带调用记录的 Bridge 目标。 */
type SpiedTarget = IChipsBridge & TargetSpies;

/**
 * 构造一个形状完整的 `IResourceHandle` 替身。
 *
 * 客户端只转发句柄，不读取成员，因此替身只需满足 `IResourceHandle` 的完整形状：
 * 全部读取方法固定拒绝，避免用例误把替身当成真实资源。
 *
 * @param uri - 句柄 URI
 * @returns 只读替身
 */
function createHandleStub(uri: string): IResourceHandle {
  const unavailable = async (): Promise<never> => {
    throw new ChipsError({
      code: SDK_BRIDGE_UNAVAILABLE,
      message: '替身句柄不提供真实读取',
      retryable: false,
    });
  };
  return {
    uri,
    state: 'open',
    metadata: (): Promise<IResourceMetadata> => unavailable(),
    read: (): Promise<Uint8Array> => unavailable(),
    readRange: (): Promise<Uint8Array> => unavailable(),
    stream: (): ReadableStream<Uint8Array> =>
      new ReadableStream<Uint8Array>({
        start(controller): void {
          controller.close();
        },
      }),
    release: (): void => undefined,
    onInvalidate: (): ISubscription => ({ dispose: (): void => undefined }),
  };
}

/** 构造一个记录调用参数的 Bridge 目标。 */
function createTarget(overrides: Partial<TargetSpies> = {}): SpiedTarget {
  return {
    request: vi.fn(async (): Promise<unknown> => ({ ok: true })),
    subscribe: vi.fn((): ISubscription => ({ dispose: vi.fn() })),
    resource: vi.fn((): IResourceHandle => createHandleStub('chips-resource://workspace/a.card')),
    ...overrides,
  } as unknown as SpiedTarget;
}

describe('ChipsBridge 注入目标转发', () => {
  it('request 原样转发能力 ID 与输入并回传目标结果', async () => {
    const target = createTarget();
    const client = new ChipsBridge(target);
    await expect(client.request('file:read', { path: 'a.txt' })).resolves.toEqual({ ok: true });
    expect(target.request).toHaveBeenCalledTimes(1);
    expect(target.request.mock.calls[0]).toEqual(['file:read', { path: 'a.txt' }]);
  });

  it('request 省略输入时按 undefined 转发，保持 IChipsBridge 原始签名', async () => {
    const target = createTarget();
    await new ChipsBridge(target).request('system:info');
    expect(target.request.mock.calls[0]).toEqual(['system:info', undefined]);
  });

  it('subscribe 与 resource 转发参数并回传目标对象本身', () => {
    const target = createTarget();
    const client = new ChipsBridge(target);
    const handler = (): void => undefined;

    const subscription = client.subscribe('document:opened', handler);
    expect(target.subscribe.mock.calls[0]).toEqual(['document:opened', handler]);
    expect(subscription).toBe(target.subscribe.mock.results[0]?.value);

    const handle = client.resource('chips-resource://workspace/a.card');
    expect(target.resource.mock.calls[0]).toEqual(['chips-resource://workspace/a.card']);
    expect(handle).toBe(target.resource.mock.results[0]?.value);
  });

  it('转发时保持目标的 this 绑定', async () => {
    const target = {
      marker: 'platform-target',
      request<TOutput>(): Promise<TOutput> {
        return Promise.resolve((this as { marker: string }).marker as TOutput);
      },
      subscribe: (): ISubscription => ({ dispose: (): void => undefined }),
      resource: (): IResourceHandle => createHandleStub('chips-resource://workspace/a.card'),
    } as unknown as IChipsBridge;
    await expect(new ChipsBridge(target).request('system:info')).resolves.toBe('platform-target');
    expect(new ChipsBridge(target).resource('chips-resource://workspace/a.card').uri).toBe(
      'chips-resource://workspace/a.card',
    );
  });

  it('目标拒绝的错误原样透传，不改写 code、message、details 与 retryable', async () => {
    const platformError = new ChipsError({
      code: 'BRIDGE_PERMISSION_DENIED',
      message: '缺少文件读取权限',
      details: { permission: 'filesystem:read' },
      retryable: false,
    });
    const client = new ChipsBridge(
      createTarget({
        request: vi.fn(async (): Promise<unknown> => {
          throw platformError;
        }),
      }),
    );
    const caught: unknown = await client.request('file:read').catch((error: unknown) => error);
    expect(caught).toBe(platformError);
    expect(isChipsError(caught)).toBe(true);
    const narrowed = caught as ChipsError;
    expect(narrowed.code).toBe('BRIDGE_PERMISSION_DENIED');
    expect(narrowed.message).toBe('缺少文件读取权限');
    expect(narrowed.retryable).toBe(false);
    expect(narrowed.details).toEqual({ permission: 'filesystem:read' });
  });

  it('跨 Bridge 传回的同构普通对象原样透传，不归一也不改写错误码', async () => {
    // §6.4：平台侧已完成归一，SDK 只转发；调用方按 code 分支即可还原语义
    const plain: unknown = {
      code: 'BRIDGE_TIMEOUT',
      message: '调用超时',
      details: { capabilityId: 'file:read' },
      retryable: true,
    };
    const client = new ChipsBridge(
      createTarget({
        request: vi.fn(async (): Promise<unknown> => {
          throw plain;
        }),
      }),
    );
    const caught: unknown = await client.request('file:read').catch((error: unknown) => error);
    expect(caught).toBe(plain);
    expect(isChipsError(caught)).toBe(true);
    const narrowed = caught as ChipsError;
    expect(narrowed.code).toBe('BRIDGE_TIMEOUT');
    expect(narrowed.retryable).toBe(true);
    expect(narrowed).not.toBeInstanceOf(ChipsError);
    expect(toChipsError(caught)).toBeInstanceOf(ChipsError);
    expect(toChipsError(caught).code).toBe('BRIDGE_TIMEOUT');
  });

  it('目标同步抛出的预检错误按原样向上传播', () => {
    const preCheck = new ChipsError({
      code: 'RESOURCE_INVALID_URI',
      message: '资源地址不合法',
      retryable: false,
    });
    const client = new ChipsBridge(
      createTarget({
        resource: vi.fn((): IResourceHandle => {
          throw preCheck;
        }),
      }),
    );
    expect(() => client.resource('chips-resource://../etc')).toThrowError(preCheck);
  });
});

describe('ChipsBridge 目标解析', () => {
  it('未注入目标且无 window 时 request 异步拒绝 SDK_BRIDGE_UNAVAILABLE', async () => {
    expect(windowHost()).toBeUndefined();
    const client = new ChipsBridge();
    const caught: unknown = await client.request('file:read').catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe(SDK_BRIDGE_UNAVAILABLE);
    expect((caught as ChipsError).retryable).toBe(false);
  });

  it('未注入目标且无 window 时 subscribe 与 resource 同步抛出 SDK_BRIDGE_UNAVAILABLE', () => {
    const client = new ChipsBridge();
    expect(() => client.subscribe('file:changed', () => undefined)).toThrowError(ChipsError);
    try {
      client.subscribe('file:changed', () => undefined);
    } catch (error) {
      expect((error as ChipsError).code).toBe(SDK_BRIDGE_UNAVAILABLE);
    }
    try {
      client.resource('chips-resource://workspace/a.card');
    } catch (error) {
      expect((error as ChipsError).code).toBe(SDK_BRIDGE_UNAVAILABLE);
    }
    expect(() => client.resource('chips-resource://workspace/a.card')).toThrowError(ChipsError);
  });

  it('构造后才注入 window.chips 时，后续调用自动使用新注入的 Bridge', async () => {
    const restoreWindow = mountWindow();
    const client = new ChipsBridge();
    const before: unknown = await client.request('file:read').catch((error: unknown) => error);
    expect((before as ChipsError).code).toBe(SDK_BRIDGE_UNAVAILABLE);

    const target = createTarget();
    const host = windowHost();
    expect(host).toBeDefined();
    if (host !== undefined) {
      host.chips = target;
    }
    await expect(client.request('file:read', { path: 'b.txt' })).resolves.toEqual({ ok: true });
    expect(target.request).toHaveBeenCalledTimes(1);
    restoreWindow();
  });

  it('每次调用重新解析：替换 window.chips 后调用转向新目标', async () => {
    const restoreWindow = mountWindow();
    const host = windowHost();
    expect(host).toBeDefined();
    if (host === undefined) {
      return;
    }
    host.chips = createTarget();
    const client = new ChipsBridge();
    await client.request('system:info');
    const second = createTarget();
    host.chips = second;
    await client.request('system:info');
    expect(host.chips).toBe(second);
    expect(second.request).toHaveBeenCalledTimes(1);
    restoreWindow();
  });

  it('注入目标优先于 window.chips', async () => {
    const restoreWindow = mountWindow();
    const host = windowHost();
    if (host === undefined) {
      return;
    }
    const windowTarget = createTarget();
    host.chips = windowTarget;
    const injected = createTarget();
    await new ChipsBridge(injected).request('file:read');
    expect(injected.request).toHaveBeenCalledTimes(1);
    expect(windowTarget.request).not.toHaveBeenCalled();
    restoreWindow();
  });
});

describe('createClient 与默认客户端', () => {
  it('createClient 无选项时得到未注入目标的客户端，行为与无参构造一致', async () => {
    const client = createClient();
    expect(client).toBeInstanceOf(ChipsBridge);
    const caught: unknown = await client
      .request('file:read')
      .catch((error: unknown) => error);
    expect((caught as ChipsError).code).toBe(SDK_BRIDGE_UNAVAILABLE);
    expect(() => client.resource('chips-resource://workspace/a.card')).toThrowError(ChipsError);
  });

  it('createClient 注入选项后调用转向该目标', async () => {
    const target = createTarget();
    const client = createClient({ bridge: target });
    await expect(client.request('file:list', { path: '.' })).resolves.toEqual({ ok: true });
    expect(target.request).toHaveBeenCalledTimes(1);
  });

  it('默认客户端 chips 按调用解析，测试安装目标后无需重建单例', async () => {
    const restoreWindow = mountWindow();
    const target = createTarget();
    const host = windowHost();
    if (host === undefined) {
      return;
    }
    host.chips = target;
    await expect(chips.request('file:read', { path: 'c.txt' })).resolves.toEqual({ ok: true });
    expect(target.request.mock.calls[0]).toEqual(['file:read', { path: 'c.txt' }]);
    const subscription = chips.subscribe('document:opened', () => undefined);
    expect(subscription).toBeDefined();
    expect(target.subscribe).toHaveBeenCalledTimes(1);
    restoreWindow();
  });
});

describe('ChipsBridge 方法面冻结', () => {
  it('原型上只有 request / subscribe / resource 三个方法', () => {
    const names = Object.getOwnPropertyNames(ChipsBridge.prototype)
      .filter((name) => name !== 'constructor')
      .sort();
    expect(names).toEqual(['request', 'resource', 'subscribe']);
  });

  it('实例不携带任何自有可枚举成员，注入目标不可被外部读取', () => {
    const client = new ChipsBridge(createTarget());
    expect(Object.getOwnPropertyNames(client)).toEqual([]);
    expect(Object.keys(client)).toEqual([]);
  });
});
