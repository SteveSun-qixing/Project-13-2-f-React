import { describe, expect, it, vi } from 'vitest';

import { registerIpcChannels } from '../src/main/ipc-channels.js';
import {
  BRIDGE_REQUEST_CHANNEL,
  BRIDGE_RESOURCE_CHANNEL,
  EVENT_CONTROL_CHANNEL,
  RENDERER_TO_MAIN_CHANNELS,
} from '../src/protocol/channels.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';
import { createFakeElectron } from './helpers/shell-electron.js';
import { createFakeRuntime } from './helpers/fake-runtime.js';

function createDiagnostics(): DiagnosticsSink & { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } {
  return { warn: vi.fn(), error: vi.fn() };
}

const invokeEvent = (windowId: number, routingId = 0) => ({
  sender: { id: windowId },
  senderFrame: { routingId },
});

const request = { requestId: 'r1', capabilityId: 'system:info' };

describe('registerIpcChannels', () => {
  it('注册三个渲染 → 主通道并转发已解析会话', async () => {
    const { ipcMain } = createFakeElectron();
    const fake = createFakeRuntime({
      handleRequest: async (session, received) => ({
        requestId: received.requestId,
        ok: true,
        result: { windowId: session.windowId, frameId: session.frameId },
      }),
    });
    const dispose = registerIpcChannels({
      ipcMain,
      runtime: fake.runtime,
      isWindowAlive: () => true,
      diagnostics: createDiagnostics(),
    });
    expect([...ipcMain.handlers.keys()].sort()).toEqual([...RENDERER_TO_MAIN_CHANNELS].sort());

    const response = await ipcMain.invoke(BRIDGE_REQUEST_CHANNEL, invokeEvent(42, 9), request);
    expect(response).toEqual({ requestId: 'r1', ok: true, result: { windowId: 42, frameId: 9 } });

    const resource = await ipcMain.invoke(BRIDGE_RESOURCE_CHANNEL, invokeEvent(42), {
      requestId: 'r2',
      operation: 'open',
      uri: 'chips-resource://platform/a',
    });
    expect(resource).toEqual({ requestId: 'r2', ok: true, metadata: null });

    const control = await ipcMain.invoke(EVENT_CONTROL_CHANNEL, invokeEvent(42), {
      controlId: 'c1',
      action: 'subscribe',
      eventId: 'window:closed',
    });
    expect(control).toEqual({ controlId: 'c1', ok: true });

    dispose();
    dispose();
    expect(ipcMain.handlers.size).toBe(0);
  });

  it('拒绝格式非法的负载并回关联键为空', async () => {
    const { ipcMain } = createFakeElectron();
    const fake = createFakeRuntime();
    registerIpcChannels({
      ipcMain,
      runtime: fake.runtime,
      isWindowAlive: () => true,
      diagnostics: createDiagnostics(),
    });

    const bridge = await ipcMain.invoke(BRIDGE_REQUEST_CHANNEL, invokeEvent(1), { requestId: 'r9' });
    expect(bridge).toEqual({
      requestId: 'r9',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL', message: '调用请求格式非法', retryable: false },
    });

    const resource = await ipcMain.invoke(BRIDGE_RESOURCE_CHANNEL, invokeEvent(1), 'not-an-object');
    expect(resource).toEqual({
      requestId: '',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL', message: '调用请求格式非法', retryable: false },
    });

    const control = await ipcMain.invoke(EVENT_CONTROL_CHANNEL, invokeEvent(1), { controlId: 'c9' });
    expect(control).toEqual({
      controlId: 'c9',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL', message: '调用请求格式非法', retryable: false },
    });
  });

  it('会话无法解析时返回 BRIDGE_SESSION_UNKNOWN', async () => {
    const { ipcMain } = createFakeElectron();
    const fake = createFakeRuntime();
    registerIpcChannels({
      ipcMain,
      runtime: fake.runtime,
      isWindowAlive: () => false,
      diagnostics: createDiagnostics(),
    });
    const response = await ipcMain.invoke(BRIDGE_REQUEST_CHANNEL, invokeEvent(77), request);
    expect(response).toEqual({
      requestId: 'r1',
      ok: false,
      error: { code: 'BRIDGE_SESSION_UNKNOWN', message: '来源会话无法解析或已关闭', retryable: false },
    });
  });

  it('核心抛出未识别异常时归一为 BRIDGE_INTERNAL 并记诊断', async () => {
    const { ipcMain } = createFakeElectron();
    const diagnostics = createDiagnostics();
    const fake = createFakeRuntime({
      handleRequest: async () => {
        throw new Error('核心内部细节');
      },
    });
    registerIpcChannels({
      ipcMain,
      runtime: fake.runtime,
      isWindowAlive: () => true,
      diagnostics,
    });
    const response = await ipcMain.invoke(BRIDGE_REQUEST_CHANNEL, invokeEvent(1), request);
    expect(response).toEqual({
      requestId: 'r1',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL', message: '宿主内部错误', retryable: false },
    });
    expect(diagnostics.error).toHaveBeenCalledOnce();
  });

  it('核心抛出的已登记错误码原样透传', async () => {
    const { ipcMain } = createFakeElectron();
    const fake = createFakeRuntime({
      handleRequest: async () => {
        throw { code: 'FILE_NOT_FOUND', message: '目标文件或目录不存在', retryable: false };
      },
    });
    registerIpcChannels({
      ipcMain,
      runtime: fake.runtime,
      isWindowAlive: () => true,
      diagnostics: createDiagnostics(),
    });
    const response = await ipcMain.invoke(BRIDGE_REQUEST_CHANNEL, invokeEvent(1), request);
    expect(response).toEqual({
      requestId: 'r1',
      ok: false,
      error: { code: 'FILE_NOT_FOUND', message: '目标文件或目录不存在', retryable: false },
    });
  });
});
