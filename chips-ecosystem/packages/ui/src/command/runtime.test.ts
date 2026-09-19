import { describe, expect, it, vi } from 'vitest';

import { createCommandRuntime } from './runtime';
import type { ICommandDiagnostic } from './contract';
import { createMockBridge, makeCommandView } from '../../tests/helpers/harness';

function captureDiagnostics(): {
  readonly items: ICommandDiagnostic[];
  readonly sink: (d: ICommandDiagnostic) => void;
} {
  const items: ICommandDiagnostic[] = [];
  return { items, sink: (diagnostic) => items.push(diagnostic) };
}

describe('createCommandRuntime（契约 §5.6）', () => {
  it('list 经 command:list 取视图，invoke 经 command:invoke 派发', async () => {
    const bridge = createMockBridge();
    const view = makeCommandView({ definition: { id: 'app:open', title: '打开' } });
    bridge.handle('command:list', () => ({ views: [view] }));
    bridge.handle('command:invoke', () => ({
      invocationId: '01H',
      commandId: 'app:open',
      target: 'ui',
      status: 'dispatched',
    }));
    const runtime = createCommandRuntime({ port: bridge.port });

    await expect(runtime.list({ includeHidden: false })).resolves.toEqual([view]);
    await expect(runtime.invoke({ commandId: 'app:open', source: 'palette' })).resolves.toEqual({
      invocationId: '01H',
      commandId: 'app:open',
      target: 'ui',
      status: 'dispatched',
    });
    expect(bridge.calls.map((call) => call.capabilityId)).toEqual([
      'command:list',
      'command:invoke',
    ]);
    runtime.dispose();
  });

  it('平台返回非法列表结构时拒绝并记录诊断', async () => {
    const bridge = createMockBridge();
    const { items, sink } = captureDiagnostics();
    bridge.handle('command:list', () => ({ views: '不是数组' }));
    const runtime = createCommandRuntime({ port: bridge.port, onDiagnostic: sink });

    await expect(runtime.list()).rejects.toThrow('平台返回的命令列表结构非法：缺少 views 数组。');
    expect(items.map((item) => item.code)).toContain('LIST_FAILED');
    runtime.dispose();
  });

  it('list / invoke 的平台错误透传并记录诊断', async () => {
    const bridge = createMockBridge();
    const { items, sink } = captureDiagnostics();
    const failure = new Error('BRIDGE_PERMISSION_DENIED');
    bridge.handle('command:list', () => {
      throw failure;
    });
    bridge.handle('command:invoke', () => {
      throw failure;
    });
    const runtime = createCommandRuntime({ port: bridge.port, onDiagnostic: sink });

    await expect(runtime.list()).rejects.toBe(failure);
    await expect(runtime.invoke({ commandId: 'app:open', source: 'toolbar' })).rejects.toBe(
      failure
    );
    expect(items.map((item) => item.code)).toEqual(['LIST_FAILED', 'INVOKE_FAILED']);
    runtime.dispose();
  });

  it('端口不可用时以简体中文错误拒绝', async () => {
    const { items, sink } = captureDiagnostics();
    const runtime = createCommandRuntime({ port: null, onDiagnostic: sink });

    await expect(runtime.list()).rejects.toThrow(
      '命令运行时未连接到平台 Bridge：window.chips 不可用。'
    );
    await expect(runtime.invoke({ commandId: 'app:open', source: 'palette' })).rejects.toThrow(
      '命令运行时未连接到平台 Bridge：window.chips 不可用。'
    );
    expect(items).toHaveLength(0);
    runtime.dispose();
  });

  it('attach 后按 (commandId, handlerId) 配对执行本地处理器', () => {
    const bridge = createMockBridge();
    const runtime = createCommandRuntime({ port: bridge.port });
    const handler = vi.fn();
    const attachment = runtime.attach([{ commandId: 'app:open', handlerId: 'open', handler }]);

    bridge.emit('command:invoked', {
      invocationId: '01H',
      commandId: 'app:open',
      handlerId: 'open',
      source: 'palette',
      payload: { source: 'a.card' },
      context: {},
    });
    expect(handler).toHaveBeenCalledWith({ source: 'a.card' });

    attachment.dispose();
    bridge.emit('command:invoked', {
      invocationId: '01I',
      commandId: 'app:open',
      handlerId: 'open',
      source: 'palette',
      context: {},
    });
    expect(handler).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });

  it('dispose 幂等且释放订阅', () => {
    const bridge = createMockBridge();
    const runtime = createCommandRuntime({ port: bridge.port });
    runtime.dispose();
    runtime.dispose();
    expect(bridge.subscribed).toContain('command:invoked');
  });

  it('缺少处理器与非法载荷记录结构化诊断且不抛出', () => {
    const bridge = createMockBridge();
    const { items, sink } = captureDiagnostics();
    const runtime = createCommandRuntime({ port: bridge.port, onDiagnostic: sink });

    bridge.emit('command:invoked', { commandId: 'app:open', handlerId: 'open' });
    bridge.emit('command:invoked', { commandId: 'app:open' });

    expect(items.map((item) => item.code)).toEqual(['HANDLER_MISSING', 'PAYLOAD_INVALID']);
    expect(items[0]?.commandId).toBe('app:open');
    runtime.dispose();
  });

  it('本地处理器抛出同步异常或异步拒绝都记录诊断且不影响其他处理器', async () => {
    const bridge = createMockBridge();
    const { items, sink } = captureDiagnostics();
    const runtime = createCommandRuntime({ port: bridge.port, onDiagnostic: sink });
    const healthy = vi.fn();
    runtime.attach([
      {
        commandId: 'app:open',
        handlerId: 'broken',
        handler: () => {
          throw new Error('同步失败');
        },
      },
      {
        commandId: 'app:open',
        handlerId: 'async-broken',
        handler: () => Promise.reject(new Error('异步失败')),
      },
      { commandId: 'app:open', handlerId: 'healthy', handler: healthy },
    ]);

    bridge.emit('command:invoked', { commandId: 'app:open', handlerId: 'broken' });
    bridge.emit('command:invoked', { commandId: 'app:open', handlerId: 'async-broken' });
    bridge.emit('command:invoked', { commandId: 'app:open', handlerId: 'healthy' });
    await Promise.resolve();

    expect(items.filter((item) => item.code === 'HANDLER_FAILED')).toHaveLength(2);
    expect(healthy).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });

  it('后注册覆盖同一配对，旧句柄释放不影响新处理器', () => {
    const bridge = createMockBridge();
    const runtime = createCommandRuntime({ port: bridge.port });
    const first = vi.fn();
    const second = vi.fn();
    const firstAttachment = runtime.attach([
      { commandId: 'app:open', handlerId: 'open', handler: first },
    ]);
    runtime.attach([{ commandId: 'app:open', handlerId: 'open', handler: second }]);

    firstAttachment.dispose();
    bridge.emit('command:invoked', { commandId: 'app:open', handlerId: 'open' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });

  it('重复释放与释放空注册项幂等，释放后拒绝再注册', () => {
    const bridge = createMockBridge();
    const runtime = createCommandRuntime({ port: bridge.port });
    const attachment = runtime.attach([
      { commandId: 'app:open', handlerId: 'open', handler: vi.fn() },
    ]);
    attachment.dispose();
    attachment.dispose();

    runtime.dispose();
    expect(() =>
      runtime.attach([{ commandId: 'app:open', handlerId: 'open', handler: vi.fn() }])
    ).toThrow('命令运行时已释放，无法再注册本地处理器。');
  });

  it('订阅失败记录诊断且运行时仍可用', async () => {
    const { items, sink } = captureDiagnostics();
    const port = {
      request: <TOutput>(_capabilityId: string, _input?: unknown): Promise<TOutput> =>
        Promise.resolve({ views: [] } as TOutput),
      subscribe: (): never => {
        throw new Error('订阅被拒绝');
      },
    };
    const runtime = createCommandRuntime({ port, onDiagnostic: sink });
    expect(items[0]?.code).toBe('SUBSCRIBE_FAILED');
    await expect(runtime.list()).resolves.toEqual([]);
    runtime.dispose();
  });
});
