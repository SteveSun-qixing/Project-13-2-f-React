import { describe, expect, it, vi } from 'vitest';

import { WindowBindings } from '../src/main/window-bindings.js';
import { WebContentsBinder } from '../src/main/web-contents-binder.js';
import { WindowRegistry } from '../src/main/window-registry.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';
import type { IResourceBackend } from '../src/runtime/contracts.js';
import { FakeSession, FakeWebContents } from './helpers/shell-electron.js';
import { createWireError } from './helpers/wire-error.js';

const CHIPS_RESOURCE_SCHEME = 'chips-resource';

function createDiagnostics(): DiagnosticsSink & { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } {
  return { warn: vi.fn(), error: vi.fn() };
}

const backend: IResourceBackend = {
  async read() {
    return Promise.reject(createWireError('RESOURCE_NOT_FOUND', '资源不存在'));
  },
};

function createBinder(overrides: { onClosed?: (windowId: number) => void; backend?: IResourceBackend } = {}): {
  binder: WebContentsBinder;
  registry: WindowRegistry;
  bindings: WindowBindings;
  diagnostics: ReturnType<typeof createDiagnostics>;
} {
  const registry = new WindowRegistry();
  const bindings = new WindowBindings();
  const diagnostics = createDiagnostics();
  const binder = new WebContentsBinder({
    registry,
    bindings,
    backend: overrides.backend ?? backend,
    diagnostics,
    onClosed: overrides.onClosed ?? (() => undefined),
  });
  return { binder, registry, bindings, diagnostics };
}

describe('WebContentsBinder', () => {
  it('绑定窗口：登记注册表、会话绑定并注册协议处理器', () => {
    const { binder, registry, bindings } = createBinder();
    const session = new FakeSession('w-1');
    const webContents = new FakeWebContents(11, session);
    const record = binder.bind(webContents);
    expect(record?.windowId).toBe(11);
    expect(registry.isAlive(11)).toBe(true);
    expect(bindings.resolveUniqueWindow(webContents.session)).toBe(11);
    expect(session.protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)).toBe(true);
  });

  it('非窗口类型内容不进入注册表', () => {
    const { binder, registry } = createBinder();
    const webContents = new FakeWebContents(12, new FakeSession('devtools'));
    webContents.type = 'devtools';
    expect(binder.bind(webContents)).toBeNull();
    expect(registry.size).toBe(0);
  });

  it('窗口销毁时解绑、释放协议并通知核心', () => {
    const onClosed = vi.fn();
    const { binder, registry, bindings } = createBinder({ onClosed });
    const session = new FakeSession('w-2');
    const webContents = new FakeWebContents(13, session);
    binder.bind(webContents);
    webContents.destroy();
    expect(registry.isAlive(13)).toBe(false);
    expect(bindings.allWindows()).toEqual([]);
    expect(session.protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)).toBe(false);
    expect(onClosed).toHaveBeenCalledWith(13);
  });

  it('同一 session 的协议处理器按窗口引用计数', () => {
    const { binder } = createBinder();
    const session = new FakeSession('shared');
    const first = new FakeWebContents(14, session);
    const second = new FakeWebContents(15, session);
    binder.bind(first);
    binder.bind(second);
    expect(session.protocol.count()).toBe(1);
    first.destroy();
    expect(session.protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)).toBe(true);
    second.destroy();
    expect(session.protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)).toBe(false);
  });

  it('协议注册失败时记诊断并 fail-closed 关闭窗口', () => {
    const diagnostics = createDiagnostics();
    const registry = new WindowRegistry();
    const binder = new WebContentsBinder({
      registry,
      bindings: new WindowBindings(),
      backend,
      diagnostics,
      onClosed: () => undefined,
    });
    const session = new FakeSession('broken');
    session.protocol.handle = () => {
      throw new Error('协议注册不可用');
    };
    const webContents = new FakeWebContents(16, session);
    binder.bind(webContents);
    expect(diagnostics.error).toHaveBeenCalledOnce();
    expect(webContents.destroyed).toBe(true);
  });

  it('disposeAll 释放全部绑定与处理器', () => {
    const { binder, registry, bindings } = createBinder();
    const session = new FakeSession('w-3');
    binder.bind(new FakeWebContents(17, session));
    binder.disposeAll();
    expect(registry.size).toBe(0);
    expect(bindings.allWindows()).toEqual([]);
    expect(session.protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)).toBe(false);
  });
});
