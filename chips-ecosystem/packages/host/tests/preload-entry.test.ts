import { describe, expect, it, vi } from 'vitest';

import {
  CARD_WINDOW_INIT_MESSAGE_TYPES,
  CARD_WINDOW_INIT_PROTOCOL,
  CARD_WINDOW_INIT_REQUEST_CHANNEL,
  CARD_WINDOW_INIT_SURFACE_KEY,
  createCardWindowInitFetchRequest,
} from '../src/shared/card-window-init-surface.js';
import { HOST_VIEW_CHANNEL_SURFACE_KEY } from '../src/shared/host-view-channel-surface.js';
import { DOCUMENT_VIEW_REQUEST_CHANNEL, DOCUMENT_VIEW_PROTOCOL } from '../src/renderer/document-view-channel.js';
import { isChipsError, type IChipsErrorShape } from '../src/preload/chips-error.js';
import type { IResourceHandle } from '../src/preload/resource-handle.js';

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: { invoke: mocks.invoke, on: mocks.on, removeListener: mocks.removeListener },
}));

vi.stubGlobal('window', { addEventListener: mocks.addEventListener });

/** 从三次 `exposeInMainWorld` 调用里按世界名取回挂载面。 */
function exposedWorld(worldName: string): Record<string, unknown> {
  const call = mocks.exposeInMainWorld.mock.calls.find(([name]) => name === worldName);
  expect(call, `contextBridge 未挂载世界：${worldName}`).toBeDefined();
  const surface: unknown = call?.[1];
  return surface as Record<string, unknown>;
}

describe('preload 入口', () => {
  it('挂载三个彼此独立的世界：`chips` 三方法冻结面 + 宿主内部取视图通道面 + 装载输入投递面', async () => {
    await import('../src/preload/index.js');
    expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(3);
    const worldNames: string[] = mocks.exposeInMainWorld.mock.calls.map((call) => call[0] as string);
    expect(worldNames).toContain('chips');
    expect(worldNames).toContain(HOST_VIEW_CHANNEL_SURFACE_KEY);
    // `window.chips` 三方法冻结面不因取视图通道而扩宽（键集精确三项）。
    const chips = exposedWorld('chips');
    expect(Object.keys(chips).sort()).toEqual(['request', 'resource', 'subscribe']);
    expect(chips['request']).toBeTypeOf('function');
    expect(chips['subscribe']).toBeTypeOf('function');
    expect(chips['resource']).toBeTypeOf('function');

    expect(mocks.addEventListener).toHaveBeenCalledWith('unload', expect.any(Function));
    const unload = mocks.addEventListener.mock.calls[0]?.[1] as () => void;
    expect(() => unload()).not.toThrow();
  });

  it('取视图通道世界只暴露单方法 `requestView`，不泄漏 ipcRenderer 原始对象', async () => {
    await import('../src/preload/index.js');
    const surface = exposedWorld(HOST_VIEW_CHANNEL_SURFACE_KEY);
    expect(Object.keys(surface)).toEqual(['requestView']);
    expect(surface['requestView']).toBeTypeOf('function');
    expect(Object.keys(surface)).not.toContain('ipcRenderer');
    expect(Object.keys(surface)).not.toContain('invoke');
    expect(Object.keys(surface)).not.toContain('on');
    // 与 `window.chips` 世界互不重叠（独立 contextBridge 世界，非 chips 链路）。
    expect(Object.keys(surface).filter((key) => key !== 'requestView')).toHaveLength(0);
  });

  it('暴露的 request 经 IPC 通道调用，不暴露原始对象', async () => {
    // Bridge 三层模型要求响应回填请求侧生成的 requestId（02-Bridge三层设计 §7.2），
    // preload 侧生成的关联键为随机 UUID，替身按 payload 回显而不是写死常量。
    mocks.invoke.mockImplementation((_channel: string, payload: { requestId: string }) =>
      Promise.resolve({ requestId: payload.requestId, ok: true, result: { platform: 'darwin' } }),
    );
    await import('../src/preload/index.js');
    const surface = exposedWorld('chips') as {
      request: (capabilityId: string, input?: unknown) => Promise<unknown>;
    };
    await expect(surface.request('system:info')).resolves.toEqual({ platform: 'darwin' });
    expect(mocks.invoke).toHaveBeenCalledWith('bridge:request', {
      // `expect.any` 返回 `any`：按被断言字段的真实类型标注，保持对象字面量的类型安全。
      requestId: expect.any(String) as string,
      capabilityId: 'system:info',
    });
    expect(Object.keys(surface)).not.toContain('ipcRenderer');
    expect(Object.keys(surface)).not.toContain('require');
  });

  it('宿主内部取视图通路：requestView 经钉定通道往返（真注入端口 → 替身 handler → 回包原样送达）', async () => {
    // 替身模拟主进程 `ipcMain.handle(document-view:request)`：按请求封套的 requestId 回显成功臂。
    mocks.invoke.mockImplementation((channel: string, payload: { requestId?: unknown }) => {
      expect(channel).toBe(DOCUMENT_VIEW_REQUEST_CHANNEL);
      return Promise.resolve({
        protocol: DOCUMENT_VIEW_PROTOCOL,
        type: 'document-view:result',
        requestId: payload.requestId,
        ok: true,
      });
    });
    await import('../src/preload/index.js');
    const surface = exposedWorld(HOST_VIEW_CHANNEL_SURFACE_KEY) as {
      requestView: (payload: unknown) => Promise<unknown>;
    };
    const request = { protocol: DOCUMENT_VIEW_PROTOCOL, type: 'document-view:build', requestId: 'req-42', input: {} };
    const response = (await surface.requestView(request)) as {
      type: string;
      requestId: string;
    };
    // 双向往返：关联标识由请求侧铸造、回包原样携带（消费臂据此逐字校验）。
    expect(response.type).toBe('document-view:result');
    expect(response.requestId).toBe('req-42');
    // 通道在实现侧钉死：无论入参如何，投递目标恒为 `document-view:request`。
    expect(mocks.invoke).toHaveBeenCalledWith(DOCUMENT_VIEW_REQUEST_CHANNEL, request);
  });

  it('宿主内部取视图通路：错误臂如实透传（主进程回包失败/处理器缺席不吞错、不兜底）', async () => {
    mocks.invoke.mockImplementation(() => Promise.reject(new Error('应用未注册视图通道处理器')));
    await import('../src/preload/index.js');
    const surface = exposedWorld(HOST_VIEW_CHANNEL_SURFACE_KEY) as {
      requestView: (payload: unknown) => Promise<unknown>;
    };
    await expect(surface.requestView({})).rejects.toThrow('应用未注册视图通道处理器');
  });

  it('装载输入投递世界只暴露单方法 `requestInit`（键集精确锁），不泄漏 ipcRenderer 原始对象', async () => {
    await import('../src/preload/index.js');
    const surface = exposedWorld(CARD_WINDOW_INIT_SURFACE_KEY);
    expect(Object.keys(surface)).toEqual(['requestInit']);
    expect(surface['requestInit']).toBeTypeOf('function');
    expect(Object.keys(surface)).not.toContain('ipcRenderer');
    expect(Object.keys(surface)).not.toContain('invoke');
    expect(Object.keys(surface)).not.toContain('on');
    // 第三世界独立挂载：不挤进取视图通道世界（其冻结键集 `['requestView']` 零扩面，上一用例逐名锁死）。
  });

  it('装载输入投递通路：requestInit 经钉定通道往返（通道在实现侧钉死、纯转发不解释负载）', async () => {
    mocks.invoke.mockImplementation((channel: string, payload: { requestId?: unknown }) => {
      expect(channel).toBe(CARD_WINDOW_INIT_REQUEST_CHANNEL);
      return Promise.resolve({
        protocol: CARD_WINDOW_INIT_PROTOCOL,
        type: CARD_WINDOW_INIT_MESSAGE_TYPES.pending,
        requestId: payload.requestId,
        windowId: 42,
      });
    });
    await import('../src/preload/index.js');
    const surface = exposedWorld(CARD_WINDOW_INIT_SURFACE_KEY) as {
      requestInit: (payload: unknown) => Promise<unknown>;
    };
    const request = createCardWindowInitFetchRequest('init-7');
    const response = (await surface.requestInit(request)) as { type: string; requestId: string; windowId: number };
    expect(mocks.invoke).toHaveBeenCalledWith(CARD_WINDOW_INIT_REQUEST_CHANNEL, request);
    expect(response.type).toBe(CARD_WINDOW_INIT_MESSAGE_TYPES.pending);
    expect(response.requestId).toBe('init-7');
    expect(response.windowId).toBe(42);
  });

  it('装载输入投递通路：传输拒绝经工单038 归一为纯数据错误送达（跨界不丢字段）', async () => {
    mocks.invoke.mockImplementation(() => Promise.reject(new Error('应用未注册装载投递处理器')));
    await import('../src/preload/index.js');
    const surface = exposedWorld(CARD_WINDOW_INIT_SURFACE_KEY) as {
      requestInit: (payload: unknown) => Promise<unknown>;
    };
    const error = await surface.requestInit({}).then(
      () => undefined,
      (reason: IChipsErrorShape) => reason,
    );
    expect(error).toBeDefined();
    expect(isChipsError(error)).toBe(true);
    expect(error?.code).toBe('BRIDGE_INTERNAL');
    expect(error?.message.length).toBeGreaterThan(0);
    expect(error?.retryable).toBe(false);
  });
});

/**
 * 桥面错误归一（工单038）：`window.chips` 挂载面的失败臂在跨 contextBridge 前归一为
 * `ChipsError.toPlain()` 同构的纯数据错误对象——渲染侧按 `code` 分支、`message` 同源非空、
 * `retryable` 布尔、`details` 可用；并以 `structuredClone` 模拟序列化边界钉字段保真。
 * 既有断言零改动，全部为新增用例。
 */
describe('preload 桥面错误归一（工单038）', () => {
  /** 取回归一后的拒绝/抛出值并钉「不得 resolve」；返回捕获值供字段级断言。 */
  async function captureRejection(promise: Promise<unknown>): Promise<IChipsErrorShape> {
    const outcome = await promise.then(
      () => ({ resolved: true as const, reason: undefined }),
      (reason: unknown) => ({ resolved: false as const, reason }),
    );
    expect(outcome.resolved, '失败臂必须以拒绝送达，不得 resolve').toBe(false);
    const error = outcome.reason as IChipsErrorShape;
    // 结构守卫（《RFC-ChipsError统一裁定》§4.2 条 3：跨界判定唯一权威）必须放行。
    expect(isChipsError(error)).toBe(true);
    // 序列化边界模拟：纯数据形态可结构化克隆且字段逐一保真（工单038 缺陷形态 Error('') 不可）。
    const clone = structuredClone(error);
    expect(clone.code).toBe(error.code);
    expect(clone.message).toBe(error.message);
    expect(clone.retryable).toBe(error.retryable);
    expect(clone.details).toStrictEqual(error.details);
    return error;
  }

  it('request 预检拒绝臂：非法能力 ID 在预检处即拒，字段级完整可分支', async () => {
    mocks.invoke.mockImplementation((_channel: string) => Promise.reject(new Error('预检失败不得触达传输')));
    await import('../src/preload/index.js');
    const callsBefore = mocks.invoke.mock.calls.length;
    const surface = exposedWorld('chips') as {
      request: (capabilityId: string, input?: unknown) => Promise<unknown>;
    };
    const error = await captureRejection(surface.request(''));
    expect(error.code).toBe('BRIDGE_INVALID_INPUT');
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.retryable).toBe(false);
    // 键集恰为 toPlain() 输出（undefined 的 details 不占位）：不携带任何通道对象或多余字段。
    expect(Object.keys(error).sort()).toEqual(['code', 'message', 'retryable']);
    // 预检即拒：不产生任何新的 IPC 触达。
    expect(mocks.invoke.mock.calls.length).toBe(callsBefore);
  });

  it('request 线封套错误臂：主进程在册码与 details 跨桥保真送达', async () => {
    mocks.invoke.mockImplementation((_channel: string, payload: { requestId: string }) =>
      Promise.resolve({
        requestId: payload.requestId,
        ok: false,
        error: {
          code: 'BRIDGE_PERMISSION_DENIED',
          message: '插件缺少所需权限',
          retryable: false,
          details: { capabilityId: 'file:read' },
        },
      }),
    );
    await import('../src/preload/index.js');
    const surface = exposedWorld('chips') as {
      request: (capabilityId: string, input?: unknown) => Promise<unknown>;
    };
    const error = await captureRejection(surface.request('file:read', { path: '/tmp/x' }));
    expect(error.code).toBe('BRIDGE_PERMISSION_DENIED');
    expect(error.message).toBe('插件缺少所需权限');
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ capabilityId: 'file:read' });
    expect(Object.keys(error).sort()).toEqual(['code', 'details', 'message', 'retryable']);
  });

  it('request 传输失败臂：未识别异常归一为在册 BRIDGE_INTERNAL，message 非空不吞错', async () => {
    const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.invoke.mockImplementation((_channel: string) => Promise.reject(new Error('通道被意外切断')));
    await import('../src/preload/index.js');
    const surface = exposedWorld('chips') as {
      request: (capabilityId: string, input?: unknown) => Promise<unknown>;
    };
    const error = await captureRejection(surface.request('system:info'));
    expect(error.code).toBe('BRIDGE_INTERNAL');
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.retryable).toBe(false);
    diagnostics.mockRestore();
  });

  it('resource 同步预检臂：非法 URI 即抛纯数据错误（code 可分支、不吞错）', async () => {
    await import('../src/preload/index.js');
    const surface = exposedWorld('chips') as { resource: (uri: string) => IResourceHandle };
    let thrown: unknown;
    try {
      surface.resource('notes://some-where');
    } catch (error) {
      thrown = error;
    }
    expect(thrown, '非法 URI 必须同步抛出').toBeDefined();
    const error = thrown as IChipsErrorShape;
    expect(isChipsError(error)).toBe(true);
    expect(error.code).toBe('RESOURCE_UNSUPPORTED_SCHEME');
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.retryable).toBe(false);
  });

  it('resource 句柄异步臂：打开失败与已释放句柄均按在册码拒绝（字段级保真）', async () => {
    mocks.invoke.mockImplementation((_channel: string, payload: { requestId: string }) =>
      Promise.resolve({
        requestId: payload.requestId,
        ok: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: '资源不存在或不可读',
          retryable: false,
          details: { uri: 'chips-resource://platform/ghost.bin' },
        },
      }),
    );
    await import('../src/preload/index.js');
    const surface = exposedWorld('chips') as { resource: (uri: string) => IResourceHandle };
    const handle = surface.resource('chips-resource://platform/ghost.bin');
    expect(handle.uri).toBe('chips-resource://platform/ghost.bin');
    expect(handle.state).toBe('open');

    const openFailure = await captureRejection(handle.read());
    expect(openFailure.code).toBe('RESOURCE_NOT_FOUND');
    expect(openFailure.message).toBe('资源不存在或不可读');
    expect(openFailure.retryable).toBe(false);
    expect(openFailure.details).toEqual({ uri: 'chips-resource://platform/ghost.bin' });

    handle.release();
    expect(handle.state).toBe('released');
    const releasedFailure = await captureRejection(handle.read());
    expect(releasedFailure.code).toBe('RESOURCE_HANDLE_RELEASED');
    expect(releasedFailure.message.length).toBeGreaterThan(0);
    expect(releasedFailure.retryable).toBe(false);
  });

  it('桥面键集不变量：错误归一不扩宽冻结三方法面、不泄露原生通道', async () => {
    await import('../src/preload/index.js');
    const surface = exposedWorld('chips');
    expect(Object.keys(surface).sort()).toEqual(['request', 'resource', 'subscribe']);
    expect(surface['dispose']).toBeUndefined();
    expect(surface['ipcRenderer']).toBeUndefined();
    expect(surface['invoke']).toBeUndefined();
  });
});
