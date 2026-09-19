import { describe, expect, it, vi } from 'vitest';

import {
  attachResourceProtocol,
  handleResourceRequest,
  parseRangeHeader,
  registerResourceSchemePrivileges,
  CHIPS_RESOURCE_SCHEME,
} from '../src/main/resource-protocol.js';
import { WindowBindings } from '../src/main/window-bindings.js';
import type { IWindowBindings } from '../src/main/window-bindings.js';
import type { ShellSession } from '../src/main/shell-api.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';
import type { IResourceBackend, IResourceReadRequest } from '../src/runtime/contracts.js';
import type { ShellCustomScheme } from '../src/main/shell-api.js';
import { FakeSessionProtocol } from './helpers/shell-electron.js';
import { createWireError } from './helpers/wire-error.js';

const diagnostics: DiagnosticsSink = { warn: vi.fn(), error: vi.fn() };

function createBindings(windowId: number | null): IWindowBindings {
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    resolveUniqueWindow: () => windowId,
    windowsOf: () => (windowId === null ? [] : [windowId]),
    allWindows: () => (windowId === null ? [] : [windowId]),
  };
}

function backendOf(handler: (request: IResourceReadRequest) => Promise<Response> | Response): IResourceBackend {
  return {
    read: async (request) => {
      const response = await handler(request);
      const body = response.body === null ? null : new Uint8Array(await response.arrayBuffer());
      return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body };
    },
  };
}

const session: ShellSession = {
  key: 'chips-window-1',
  protocol: new FakeSessionProtocol(),
};

describe('parseRangeHeader', () => {
  it('识别缺省、开区间与闭区间', () => {
    expect(parseRangeHeader(null)).toEqual({ kind: 'none' });
    expect(parseRangeHeader('  ')).toEqual({ kind: 'none' });
    expect(parseRangeHeader('bytes=10-')).toEqual({ kind: 'valid', start: 10, end: null });
    expect(parseRangeHeader('bytes=10-20')).toEqual({ kind: 'valid', start: 10, end: 20 });
  });

  it('拒绝非法范围', () => {
    for (const value of ['bytes=-5', 'bytes=abc', 'bytes=20-10', 'items=1-2', 'bytes=1-2,3-4']) {
      expect(parseRangeHeader(value)).toEqual({ kind: 'invalid' });
    }
  });
});

describe('registerResourceSchemePrivileges', () => {
  it('注册标准、安全、可流式与可抓取的特权 scheme', () => {
    const registered: ShellCustomScheme[][] = [];
    registerResourceSchemePrivileges({
      registerSchemesAsPrivileged(schemes: readonly ShellCustomScheme[]): void {
        registered.push([...schemes]);
      },
    });
    expect(registered).toHaveLength(1);
    const entry = registered[0]?.[0];
    expect(entry?.scheme).toBe(CHIPS_RESOURCE_SCHEME);
    expect(entry?.privileges).toMatchObject({
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    });
  });
});

describe('handleResourceRequest', () => {
  const okBackend = backendOf(async (request) => {
    return Promise.resolve(
      new Response(request.method === 'HEAD' ? null : new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '3' },
      }),
    );
  });

  it('OPTIONS 返回 204 与 CORS 头', async () => {
    const response = await handleResourceRequest(
      new Request('chips-resource://platform/shell.html', { method: 'OPTIONS' }),
      session,
      { backend: okBackend, bindings: createBindings(1), diagnostics },
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('不支持的 HTTP 方法返回 405', async () => {
    const response = await handleResourceRequest(
      new Request('chips-resource://platform/shell.html', { method: 'POST' }),
      session,
      { backend: okBackend, bindings: createBindings(1), diagnostics },
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
  });

  it('URI 非法返回 400 与简体中文纯文本', async () => {
    // 处理器按 06-资源协议规范 §5.3 基于 request.url 原始字符串重新解析；`%2e%2e` 独立成段时
    // 会先被 Request 构造器的 WHATWG 折叠消掉，故用编码分隔符形态构造解码后穿越（2.6 节 `%2F`）。
    const response = await handleResourceRequest(
      new Request('chips-resource://card-1/a%2F%2e%2e%2Fsecret.txt'),
      session,
      {
        backend: okBackend,
        bindings: createBindings(1),
        diagnostics,
      },
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('资源路径无效\n');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('非法 Range 返回 416', async () => {
    const response = await handleResourceRequest(
      new Request('chips-resource://platform/a.bin', { headers: { Range: 'bytes=-5' } }),
      session,
      { backend: okBackend, bindings: createBindings(1), diagnostics },
    );
    expect(response.status).toBe(416);
  });

  it('来源会话无法解析时返回 403', async () => {
    const response = await handleResourceRequest(new Request('chips-resource://platform/a.bin'), session, {
      backend: okBackend,
      bindings: createBindings(null),
      diagnostics,
    });
    expect(response.status).toBe(403);
    expect(await response.text()).toContain('没有访问该资源的权限');
  });

  it('成功读取附加安全头并在需要时附加 CORS', async () => {
    const scriptBackend = backendOf(
      async () =>
        Promise.resolve(
          new Response(new Uint8Array([1]), {
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
          }),
        ),
    );
    const response = await handleResourceRequest(new Request('chips-resource://platform/shell-window.js'), session, {
      backend: scriptBackend,
      bindings: createBindings(5),
      diagnostics,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1]));
  });

  it('HEAD 请求不返回响应体', async () => {
    const response = await handleResourceRequest(
      new Request('chips-resource://platform/shell.html', { method: 'HEAD' }),
      session,
      { backend: okBackend, bindings: createBindings(1), diagnostics },
    );
    expect(response.status).toBe(200);
    expect(await response.arrayBuffer()).toEqual(new ArrayBuffer(0));
  });

  it('核心资源错误归一为对应 HTTP 状态且不泄露内部信息', async () => {
    const failing = backendOf(async () => Promise.reject(createWireError('RESOURCE_NOT_FOUND', '资源不存在')));
    const response = await handleResourceRequest(new Request('chips-resource://platform/missing.bin'), session, {
      backend: failing,
      bindings: createBindings(1),
      diagnostics,
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('资源不存在\n');
  });

  it('未识别后端异常归一为 500', async () => {
    const failing = backendOf(async () => Promise.reject(new Error('内部路径 /Users/me/secret')));
    const response = await handleResourceRequest(new Request('chips-resource://platform/a.bin'), session, {
      backend: failing,
      bindings: createBindings(1),
      diagnostics,
    });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('资源读取失败\n');
  });

  it('流式响应原样透传', async () => {
    const streaming = backendOf(
      async () =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller): void {
                controller.enqueue(new Uint8Array([7, 8]));
                controller.close();
              },
            }),
            { status: 206, headers: { 'Content-Type': 'application/octet-stream' } },
          ),
        ),
    );
    const response = await handleResourceRequest(new Request('chips-resource://platform/a.bin'), session, {
      backend: streaming,
      bindings: createBindings(1),
      diagnostics,
    });
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([7, 8]));
  });
});

describe('attachResourceProtocol', () => {
  it('按会话注册处理器，注销幂等且不重复注册', () => {
    const protocol = new FakeSessionProtocol();
    const target: ShellSession = { key: 's', protocol };
    const deps = {
      backend: backendOf(async () => Promise.resolve(new Response(null))),
      bindings: new WindowBindings(),
      diagnostics,
    };
    const dispose = attachResourceProtocol(target, deps);
    expect(protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)).toBe(true);
    attachResourceProtocol(target, deps);
    expect(protocol.count()).toBe(1);
    dispose();
    dispose();
    expect(protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)).toBe(false);
  });
});
