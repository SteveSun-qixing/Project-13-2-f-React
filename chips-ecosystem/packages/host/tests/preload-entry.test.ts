import { describe, expect, it, vi } from 'vitest';

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

describe('preload 入口', () => {
  it('只暴露 IChipsBridge 方法面并注册卸载清理', async () => {
    await import('../src/preload/index.js');
    expect(mocks.exposeInMainWorld).toHaveBeenCalledOnce();
    const [world, surface] = mocks.exposeInMainWorld.mock.calls[0] as [string, Record<string, unknown>];
    expect(world).toBe('chips');
    expect(Object.keys(surface).sort()).toEqual(['request', 'resource', 'subscribe']);
    expect(surface['request']).toBeTypeOf('function');
    expect(surface['subscribe']).toBeTypeOf('function');
    expect(surface['resource']).toBeTypeOf('function');

    expect(mocks.addEventListener).toHaveBeenCalledWith('unload', expect.any(Function));
    const unload = mocks.addEventListener.mock.calls[0]?.[1] as () => void;
    expect(() => unload()).not.toThrow();
  });

  it('暴露的 request 经 IPC 通道调用，不暴露原始对象', async () => {
    // Bridge 三层模型要求响应回填请求侧生成的 requestId（02-Bridge三层设计 §7.2），
    // preload 侧生成的关联键为随机 UUID，替身按 payload 回显而不是写死常量。
    mocks.invoke.mockImplementation((_channel: string, payload: { requestId: string }) =>
      Promise.resolve({ requestId: payload.requestId, ok: true, result: { platform: 'darwin' } }),
    );
    await import('../src/preload/index.js');
    const surface = mocks.exposeInMainWorld.mock.calls[0]?.[1] as {
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
});
