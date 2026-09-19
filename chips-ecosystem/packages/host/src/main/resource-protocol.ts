/**
 * `chips-resource://` 协议注册与请求处理。
 *
 * 权威：`06-资源协议规范` §五（解析流程与协议处理器）、§7.2（错误码到 HTTP）、§九（安全约束）、
 * `ADR-002` §自定义协议与 §现状注记（以 Electron 现行 `protocol.handle` 为准）、
 * `05-渲染引擎设计` §4.4（协议处理器要求）。
 *
 * @remarks
 * - 处理器基于 `request.url` 原始字符串重新执行语法解析与路径分段校验；
 * - 会话按窗口 session 解析（见 `window-bindings.ts`）；无法解析或多窗口歧义时拒绝（403）；
 * - 字节读取交给核心资源管理器（`IResourceBackend`）；本模块不做权限判定（SB-6）。
 */

import { parseResourceUri } from '../protocol/resource-uri.js';
import {
  RESOURCE_SECURITY_HEADERS,
  needsCorsHeader,
  resourceErrorMessage,
  resourceErrorStatus,
} from '../protocol/resource-error.js';
import type { IResourceBackend, IResourceReadRequest } from '../runtime/contracts.js';
import { asWireError } from '../runtime/contracts.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import type { IWindowBindings } from './window-bindings.js';
import type { ShellCustomScheme, ShellElectronProtocol, ShellSession } from './shell-api.js';

/** 资源协议 scheme。 */
export const CHIPS_RESOURCE_SCHEME = 'chips-resource';

/** 特权声明（`06-资源协议规范` §2.2：标准协议、origin 语义、支持流式响应与 fetch）。 */
export const CHIPS_RESOURCE_SCHEME_PRIVILEGES: ShellCustomScheme = {
  scheme: CHIPS_RESOURCE_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
    codeCache: true,
  },
};

/** 允许的 HTTP 方法。 */
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);
const ALLOW_HEADER_VALUE = 'GET, HEAD, OPTIONS';

/** 协议处理器依赖。 */
export interface ResourceProtocolDeps {
  /** 资源读取后端（核心资源管理器）。 */
  readonly backend: IResourceBackend;
  /** 窗口/会话绑定注册表。 */
  readonly bindings: IWindowBindings;
  /** 诊断口。 */
  readonly diagnostics: DiagnosticsSink;
}

/** Range 头解析结果。 */
export type RangeParseResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'valid'; readonly start: number; readonly end: number | null }
  | { readonly kind: 'invalid' };

/**
 * 解析 `Range: bytes=start-end`。
 *
 * @param value Range 头原始值；缺省为 `null`。
 */
export function parseRangeHeader(value: string | null): RangeParseResult {
  if (value === null || value.trim().length === 0) {
    return { kind: 'none' };
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (match === null) {
    return { kind: 'invalid' };
  }
  const [, startText = '', endText = ''] = match;
  if (startText.length === 0 && endText.length === 0) {
    return { kind: 'invalid' };
  }
  if (startText.length === 0) {
    return { kind: 'invalid' };
  }
  const start = Number.parseInt(startText, 10);
  if (!Number.isSafeInteger(start) || start < 0) {
    return { kind: 'invalid' };
  }
  if (endText.length === 0) {
    return { kind: 'valid', start, end: null };
  }
  const end = Number.parseInt(endText, 10);
  if (!Number.isSafeInteger(end) || end < start) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', start, end };
}

/** 注册特权 scheme；必须在应用就绪前调用（ADR-002 §现状注记）。 */
export function registerResourceSchemePrivileges(protocol: ShellElectronProtocol): void {
  protocol.registerSchemesAsPrivileged([CHIPS_RESOURCE_SCHEME_PRIVILEGES]);
}

function textResponse(status: number, code: string, extraHeaders: Readonly<Record<string, string>> = {}): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    ...RESOURCE_SECURITY_HEADERS,
    ...extraHeaders,
  };
  return new Response(`${resourceErrorMessage(code)}\n`, { status, headers });
}

/** 构造协议响应头：固定安全头 + 核心头 + 必要 CORS。 */
function buildSuccessHeaders(backendHeaders: Readonly<Record<string, string>>): Record<string, string> {
  const headers: Record<string, string> = { ...backendHeaders };
  for (const [key, value] of Object.entries(RESOURCE_SECURITY_HEADERS)) {
    if (headers[key] === undefined) {
      headers[key] = value;
    }
  }
  const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
  if (needsCorsHeader(contentType) && headers['Access-Control-Allow-Origin'] === undefined) {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  return headers;
}

/**
 * 处理单个协议请求。
 *
 * @param request Web `Request`。
 * @param session 请求所在 Electron session。
 * @param deps 依赖。
 */
export async function handleResourceRequest(
  request: Request,
  session: ShellSession,
  deps: ResourceProtocolDeps,
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': ALLOW_HEADER_VALUE,
        'Access-Control-Allow-Headers': '*',
        ...RESOURCE_SECURITY_HEADERS,
      },
    });
  }
  if (!ALLOWED_METHODS.has(method)) {
    return textResponse(405, 'RESOURCE_INVALID_URI', { Allow: ALLOW_HEADER_VALUE });
  }
  const parsed = parseResourceUri(request.url);
  if (!parsed.ok) {
    deps.diagnostics.warn('protocol', '资源 URI 校验失败', { code: parsed.code, reason: parsed.reason });
    return textResponse(resourceErrorStatus(parsed.code), parsed.code);
  }
  const range = parseRangeHeader(request.headers.get('range'));
  if (range.kind === 'invalid') {
    return textResponse(416, 'RESOURCE_INVALID_URI');
  }
  const windowId = deps.bindings.resolveUniqueWindow(session);
  if (windowId === null) {
    const candidates = deps.bindings.windowsOf(session);
    deps.diagnostics.warn('protocol', '资源请求无法解析来源会话', {
      session: session.key,
      boundWindows: candidates.length,
    });
    return textResponse(403, 'RESOURCE_PERMISSION_DENIED');
  }
  const readRequest: IResourceReadRequest = {
    uri: parsed.uri,
    session: { windowId, frameId: null },
    method: method === 'HEAD' ? 'HEAD' : 'GET',
    range: range.kind === 'valid' ? { start: range.start, end: range.end } : null,
    headers: Object.fromEntries(request.headers.entries()),
  };
  try {
    const result = await deps.backend.read(readRequest);
    const headers = buildSuccessHeaders(result.headers);
    const body: BodyInit | null = readRequest.method === 'HEAD' ? null : toResponseBody(result.body);
    return new Response(body, { status: result.status, headers });
  } catch (error) {
    const wireError = asWireError(error);
    deps.diagnostics.warn('protocol', '资源读取失败', { code: wireError.code });
    return textResponse(resourceErrorStatus(wireError.code), wireError.code);
  }
}

/**
 * 把核心返回的响应体转换为 DOM `BodyInit`。
 *
 * @remarks 字节统一复制为独立 `ArrayBuffer` 视图，避免 `SharedArrayBuffer` 型视图与
 * DOM `BodyInit` 的类型不兼容；流式响应原样透传。
 */
function toResponseBody(body: Uint8Array | ReadableStream<Uint8Array> | null): BodyInit | null {
  if (body === null) {
    return null;
  }
  if (body instanceof Uint8Array) {
    return new Uint8Array(body).buffer;
  }
  return body;
}

/**
 * 为会话注册资源协议处理器；重复调用返回同一注销函数（幂等）。
 *
 * @param session 目标会话。
 * @param deps 依赖。
 * @returns 注销函数。
 */
export function attachResourceProtocol(session: ShellSession, deps: ResourceProtocolDeps): () => void {
  const protocol = session.protocol;
  if (!protocol.isProtocolHandled(CHIPS_RESOURCE_SCHEME)) {
    protocol.handle(CHIPS_RESOURCE_SCHEME, (request) => handleResourceRequest(request, session, deps));
  }
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    protocol.unhandle(CHIPS_RESOURCE_SCHEME);
  };
}
