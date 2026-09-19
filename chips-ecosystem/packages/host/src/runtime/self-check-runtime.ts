/**
 * 壳自检运行时。
 *
 * @remarks
 * - 用途：在平台核心（Cordis + Bridge）装配前，允许壳以真实 Electron 链路启动并自检
 *   （`pnpm --filter @chips/host dev`）；**不注册任何能力、事件与资源作用域**。
 * - 所有调用返回正式"未注册"错误码（`BRIDGE_CAPABILITY_NOT_FOUND` / `RESOURCE_NOT_FOUND` /
 *   `EVENT_NOT_REGISTERED`），不空实现、不伪造成功（17 §3.3 SB-5）。
 * - `platform` 作用域由本运行时服务：映射到平台构建产物目录（壳页与其脚本），
 *   这是平台自有资源的最小读路径；其余作用域一律 `RESOURCE_NOT_FOUND`。
 */

import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { parseResourceUri } from '../protocol/resource-uri.js';
import type { IBridgeResponse, IEventControlResponse, IResourceControlResponse } from '../protocol/wire.js';
import type {
  IEventSink,
  IPlatformHostChannel,
  IPlatformIpcEndpoint,
  IPlatformRuntime,
  IPlatformStartupInput,
  IResourceBackend,
  IResourceReadRequest,
  IResourceReadResult,
  ISessionSource,
} from './contracts.js';
import type { IPalHost } from '../platform/contracts/index.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';

/** 自检运行时选项。 */
export interface SelfCheckRuntimeOptions {
  /** 平台构建产物根目录（`chips-resource://platform/<path>` 的映射根）。 */
  readonly platformRoot: string;
  /** 诊断口；默认写 `process.stderr`（自检入口仅用于开发期自检）。 */
  readonly diagnostics?: DiagnosticsSink;
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const capabilityNotFound = (requestId: string): IBridgeResponse => ({
  requestId,
  ok: false,
  error: { code: 'BRIDGE_CAPABILITY_NOT_FOUND', message: '能力未注册（平台核心尚未装配）', retryable: false },
});

const resourceNotFound = (requestId: string): IResourceControlResponse => ({
  requestId,
  ok: false,
  error: { code: 'RESOURCE_NOT_FOUND', message: '资源不存在（平台核心尚未装配）', retryable: false },
});

const eventNotRegistered = (controlId: string): IEventControlResponse => ({
  controlId,
  ok: false,
  error: { code: 'EVENT_NOT_REGISTERED', message: '事件未注册（平台核心尚未装配）', retryable: false },
});

/**
 * 构造与 `IWireChipsError` 同构的可抛出错误。
 *
 * @remarks
 * `only-throw-error` 要求抛出真 `Error`；资源读取失败的抛出值由 `asWireError` / `toWireError`
 * 按 `code`/`message`/`retryable` 结构消费，本类实例携带同名可枚举属性，输出与原普通对象逐字段一致。
 */
function resourceError(code: string, message: string): Error & { code: string; retryable: boolean } {
  return Object.assign(new Error(message), { code, retryable: false });
}

/** 壳自检运行时的 IPC 端点。 */
function createSelfCheckIpcEndpoint(): IPlatformIpcEndpoint {
  return {
    async handleRequest(_session: ISessionSource, request): Promise<IBridgeResponse> {
      return Promise.resolve(capabilityNotFound(request.requestId));
    },
    async handleResourceControl(_session: ISessionSource, request): Promise<IResourceControlResponse> {
      return Promise.resolve(resourceNotFound(request.requestId));
    },
    async handleEventControl(_session: ISessionSource, request): Promise<IEventControlResponse> {
      return Promise.resolve(eventNotRegistered(request.controlId));
    },
    handleWindowClosed(): void {
      return;
    },
  };
}

/** 壳自检资源后端；只服务 `platform` 作用域。 */
function createSelfCheckResourceBackend(platformRoot: string): IResourceBackend {
  const root = resolve(platformRoot);
  return {
    async read(request: IResourceReadRequest): Promise<IResourceReadResult> {
      const parsed = parseResourceUri(request.uri);
      if (!parsed.ok) {
        throw resourceError(parsed.code, '资源地址无效');
      }
      if (parsed.scope !== 'platform' || parsed.path.length === 0) {
        throw resourceError('RESOURCE_NOT_FOUND', '资源不存在');
      }
      const target = resolve(root, parsed.path);
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        throw resourceError('RESOURCE_PATH_INVALID', '资源路径无效');
      }
      let size: number;
      try {
        const info = await stat(target);
        if (!info.isFile()) {
          throw new Error('not a file');
        }
        size = info.size;
      } catch {
        throw resourceError('RESOURCE_NOT_FOUND', '资源不存在');
      }
      const contentType = MIME_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream';
      const baseHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      };
      if (request.range !== null) {
        // 越界起点不做裁剪：起点不小于尺寸即不可满足范围，返回 416（06-资源协议规范 5.3、RFC 9110 14.1.7）。
        const start = request.range.start;
        const end = request.range.end === null ? size - 1 : Math.min(request.range.end, size - 1);
        if (size === 0 || start < 0 || start >= size || start > end) {
          return { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` }, body: null };
        }
        const body = await readFile(target).then((buffer) => buffer.subarray(start, end + 1));
        return {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(body.byteLength),
          },
          body: request.method === 'HEAD' ? null : body,
        };
      }
      const buffer = await readFile(target);
      return {
        status: 200,
        headers: { ...baseHeaders, 'Content-Length': String(size) },
        body: request.method === 'HEAD' ? null : buffer,
      };
    },
  };
}

/**
 * 创建壳自检运行时。
 *
 * @param options 选项。
 */
export function createSelfCheckRuntime(options: SelfCheckRuntimeOptions): IPlatformRuntime {
  const ipc = createSelfCheckIpcEndpoint();
  const resources = createSelfCheckResourceBackend(options.platformRoot);
  const diagnostics = options.diagnostics ?? createStderrDiagnostics();
  return {
    async start(_host: IPalHost, _channel: IPlatformHostChannel): Promise<void> {
      return Promise.resolve();
    },
    async restorePlugins(): Promise<void> {
      return Promise.resolve();
    },
    async handleStartupInputs(inputs: readonly IPlatformStartupInput[]): Promise<void> {
      if (inputs.length === 0) {
        return Promise.resolve();
      }
      diagnostics.warn('startup', '平台核心尚未装配，启动输入未投递', { count: inputs.length });
      return Promise.resolve();
    },
    async stopPlugins(): Promise<void> {
      return Promise.resolve();
    },
    async shutdown(): Promise<void> {
      return Promise.resolve();
    },
    ipc,
    resources,
    forwardEvents(_sink: IEventSink): () => void {
      return () => {
        return;
      };
    },
  };
}
