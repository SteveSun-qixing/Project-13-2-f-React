import { describe, expect, it, vi } from 'vitest';

import { HOST_VIEW_CHANNEL_SURFACE_KEY } from '../src/shared/host-view-channel-surface.js';
import { DOCUMENT_VIEW_REQUEST_CHANNEL, DOCUMENT_VIEW_PROTOCOL } from '../src/renderer/document-view-channel.js';

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

/** 从两次 `exposeInMainWorld` 调用里按世界名取回挂载面。 */
function exposedWorld(worldName: string): Record<string, unknown> {
  const call = mocks.exposeInMainWorld.mock.calls.find(([name]) => name === worldName);
  expect(call, `contextBridge 未挂载世界：${worldName}`).toBeDefined();
  const surface: unknown = call?.[1];
  return surface as Record<string, unknown>;
}

describe('preload 入口', () => {
  it('挂载两个彼此独立的世界：`chips` 三方法冻结面 + 宿主内部取视图通道面', async () => {
    await import('../src/preload/index.js');
    expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(2);
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
});
