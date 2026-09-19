import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createSelfCheckRuntime } from '../src/runtime/self-check-runtime.js';
import type { IPlatformRuntime } from '../src/runtime/contracts.js';

let root: string;
let runtime: IPlatformRuntime;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'chips-self-check-'));
  await writeFile(join(root, 'shell.html'), '<html>shell</html>');
  await writeFile(join(root, 'a.bin'), new Uint8Array([1, 2, 3, 4]));
  await mkdir(join(root, 'sub'));
  await writeFile(join(root, 'sub', 'style.css'), 'body{}');
  runtime = createSelfCheckRuntime({ platformRoot: root, diagnostics: { warn: vi.fn(), error: vi.fn() } });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('壳自检运行时：IPC 端点', () => {
  it('能力调用统一返回 BRIDGE_CAPABILITY_NOT_FOUND', async () => {
    const response = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r1', capabilityId: 'system:info' },
    );
    expect(response).toEqual({
      requestId: 'r1',
      ok: false,
      error: { code: 'BRIDGE_CAPABILITY_NOT_FOUND', message: '能力未注册（平台核心尚未装配）', retryable: false },
    });
  });

  it('资源句柄控制统一返回 RESOURCE_NOT_FOUND', async () => {
    const response = await runtime.ipc.handleResourceControl(
      { windowId: 1, frameId: null },
      { requestId: 'r2', operation: 'open', uri: 'chips-resource://platform/shell.html' },
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('RESOURCE_NOT_FOUND');
    }
  });

  it('事件控制统一返回 EVENT_NOT_REGISTERED', async () => {
    const response = await runtime.ipc.handleEventControl(
      { windowId: 1, frameId: null },
      { controlId: 'c1', action: 'subscribe', eventId: 'window:closed' },
    );
    expect(response).toEqual({
      controlId: 'c1',
      ok: false,
      error: { code: 'EVENT_NOT_REGISTERED', message: '事件未注册（平台核心尚未装配）', retryable: false },
    });
  });

  it('窗口关闭通知为空操作', () => {
    expect(() => runtime.ipc.handleWindowClosed(9)).not.toThrow();
  });
});

describe('壳自检运行时：生命周期端口', () => {
  it('启动、插件恢复、停机均为空操作且可幂等调用', async () => {
    await runtime.start({} as never, {
      pushSessionPermissions: () => undefined,
    });
    await runtime.restorePlugins();
    await runtime.stopPlugins();
    await runtime.shutdown();
    await runtime.shutdown();
  });

  it('事件转发注册返回可调用注销函数', () => {
    const dispose = runtime.forwardEvents({ deliver: () => undefined });
    dispose();
    dispose();
  });

  it('启动输入非空时经诊断口报告未投递', async () => {
    const diagnostics = { warn: vi.fn(), error: vi.fn() };
    const isolated = createSelfCheckRuntime({ platformRoot: root, diagnostics });
    await isolated.handleStartupInputs([]);
    expect(diagnostics.warn).not.toHaveBeenCalled();
    await isolated.handleStartupInputs([{ kind: 'open-path', path: '/tmp/a.card' }]);
    expect(diagnostics.warn).toHaveBeenCalledOnce();
    expect(diagnostics.warn.mock.calls[0]?.[1]).toContain('启动输入未投递');
  });
});

describe('壳自检运行时：platform 作用域读取', () => {
  it('读取文件返回内容类型与长度', async () => {
    const result = await runtime.resources.read({
      uri: 'chips-resource://platform/shell.html',
      session: { windowId: 1, frameId: null },
      method: 'GET',
      range: null,
      headers: {},
    });
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(result.headers['Content-Length']).toBe(String(Buffer.byteLength('<html>shell</html>')));
    const body = result.body as Uint8Array;
    expect(new TextDecoder().decode(body)).toBe('<html>shell</html>');
  });

  it('HEAD 请求不返回响应体', async () => {
    const result = await runtime.resources.read({
      uri: 'chips-resource://platform/a.bin',
      session: { windowId: 1, frameId: null },
      method: 'HEAD',
      range: null,
      headers: {},
    });
    expect(result.status).toBe(200);
    expect(result.body).toBeNull();
  });

  it('子目录文件可读并识别 MIME', async () => {
    const result = await runtime.resources.read({
      uri: 'chips-resource://platform/sub/style.css',
      session: { windowId: 1, frameId: null },
      method: 'GET',
      range: null,
      headers: {},
    });
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/css; charset=utf-8');
  });

  it('范围请求返回 206 与部分字节', async () => {
    const result = await runtime.resources.read({
      uri: 'chips-resource://platform/a.bin',
      session: { windowId: 1, frameId: null },
      method: 'GET',
      range: { start: 1, end: 2 },
      headers: { range: 'bytes=1-2' },
    });
    expect(result.status).toBe(206);
    expect(result.headers['Content-Range']).toBe('bytes 1-2/4');
    expect([...(result.body as Uint8Array)]).toEqual([2, 3]);
  });

  it('开区间范围读取到文件末尾', async () => {
    const result = await runtime.resources.read({
      uri: 'chips-resource://platform/a.bin',
      session: { windowId: 1, frameId: null },
      method: 'GET',
      range: { start: 2, end: null },
      headers: {},
    });
    expect(result.status).toBe(206);
    expect(result.headers['Content-Range']).toBe('bytes 2-3/4');
  });

  it('非法或越界范围返回 416', async () => {
    const result = await runtime.resources.read({
      uri: 'chips-resource://platform/a.bin',
      session: { windowId: 1, frameId: null },
      method: 'GET',
      range: { start: 9, end: 10 },
      headers: {},
    });
    expect(result.status).toBe(416);
    expect(result.headers['Content-Range']).toBe('bytes */4');
  });

  it('目录与缺失文件返回 RESOURCE_NOT_FOUND', async () => {
    for (const uri of ['chips-resource://platform/sub', 'chips-resource://platform/missing.bin']) {
      await expect(
        runtime.resources.read({
          uri,
          session: { windowId: 1, frameId: null },
          method: 'GET',
          range: null,
          headers: {},
        }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    }
  });

  it('非 platform 作用域返回 RESOURCE_NOT_FOUND', async () => {
    await expect(
      runtime.resources.read({
        uri: 'chips-resource://card-1/a.bin',
        session: { windowId: 1, frameId: null },
        method: 'GET',
        range: null,
        headers: {},
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('URI 非法时返回语法错误码', async () => {
    await expect(
      runtime.resources.read({
        uri: 'chips-resource://platform/%2e%2e/secret',
        session: { windowId: 1, frameId: null },
        method: 'GET',
        range: null,
        headers: {},
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_PATH_INVALID' });
  });
});
