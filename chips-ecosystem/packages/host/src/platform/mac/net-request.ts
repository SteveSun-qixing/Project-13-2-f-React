import { PAL_ERROR_CODES, PalPortError } from '../errors.js';
import type {
  ElectronClientRequestLike,
  ElectronIncomingMessageLike,
  ElectronNetLike,
} from '../electron/electron-api.js';

/**
 * 网络请求限制。
 *
 * 权威：`04-资源管理设计` §8.2（重定向最多 5 跳、连接 10s、首字节与空闲 30s、单资源上限 2 GiB）。
 */
export interface NetworkLimits {
  /** 最大重定向跳数。 */
  readonly maxRedirects: number;
  /** 连接/响应头超时（毫秒）。 */
  readonly connectTimeoutMs: number;
  /** 首字节与空闲超时（毫秒）。 */
  readonly idleTimeoutMs: number;
  /** 响应体上限（字节）。 */
  readonly maxResponseBytes: number;
}

/** 默认网络限制。 */
export const DEFAULT_NETWORK_LIMITS: NetworkLimits = {
  maxRedirects: 5,
  connectTimeoutMs: 10_000,
  idleTimeoutMs: 30_000,
  maxResponseBytes: 2 * 1024 * 1024 * 1024,
};

/** 请求参数。 */
export interface NetRequestParams {
  /** 绝对 URL（`http` / `https`）。 */
  readonly url: string;
  /** HTTP 方法。 */
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  /** 请求头。 */
  readonly headers: Readonly<Record<string, string>>;
  /** 请求体。 */
  readonly body?: Uint8Array;
  /** 有效取消信号（调用方信号与内部取消的合并）。 */
  readonly signal?: AbortSignal;
  /** 绝对截止时间（Unix 毫秒）。 */
  readonly deadline?: number;
  /** 逐跳重定向授权；未提供时拒绝任何重定向。 */
  readonly authorizeRedirect?: (url: string) => Promise<boolean>;
  /** 网络限制覆盖。 */
  readonly limits?: Partial<NetworkLimits>;
  /**
   * 是否在结果中聚合响应体；默认 `true`。
   *
   * 大文件传输应设为 `false`，由 `onData` 流式消费，避免整体驻留内存。
   */
  readonly bufferResponse?: boolean;
  /** 收到响应头回调。 */
  readonly onResponseHead?: (head: {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
  }) => void;
  /** 数据回调；`totalBytes` 为 `Content-Length`（未知时 `null`）。 */
  readonly onData?: (chunk: Buffer, transferredBytes: number, totalBytes: number | null) => void;
}

/** 请求结果。 */
export interface NetRequestResult {
  /** 状态码。 */
  readonly status: number;
  /** 归一化响应头。 */
  readonly headers: Readonly<Record<string, string>>;
  /** 响应体字节。 */
  readonly body: Buffer;
}

/** 响应阶段句柄；负责中止底层请求。 */
interface ResponseHandle {
  /** 响应消息。 */
  readonly response: ElectronIncomingMessageLike;
  /** 中止底层请求；幂等。 */
  abort(): void;
}

/** 单跳重定向结果。 */
interface RedirectOutcome {
  readonly kind: 'redirect';
  readonly statusCode: number;
  readonly url: string;
}

/** 单跳响应结果。 */
interface ResponseOutcome {
  readonly kind: 'response';
  readonly handle: ResponseHandle;
}

/** 单跳结果。 */
type HopOutcome = RedirectOutcome | ResponseOutcome;

/** 切换为 GET 时移除的实体头。 */
const ENTITY_HEADERS = new Set(['content-length', 'content-type', 'content-encoding', 'content-language']);

/** 跨源重定向时剥离的敏感头。 */
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization']);

/**
 * 执行一次带重定向状态机的 HTTP 请求。
 *
 * @param net Electron `net` 模块切片。
 * @param params 请求参数。
 * @returns 最终响应（状态、响应头与完整响应体）。
 * @throws {PalPortError} `HTTP_REDIRECT_DENIED` / `HTTP_REQUEST_FAILED` / `BRIDGE_CANCELLED` / `BRIDGE_TIMEOUT`。
 *
 * @remarks
 * - 超时按资源管理设计 §8.2：连接 10s、首字节与空闲 30s；空闲计时在响应体阶段随数据重置。
 * - 取消与截止在响应头与响应体两个阶段都生效，中止底层请求并清理监听。
 * - 重定向逐跳经 `authorizeRedirect` 授权；跨源剥离敏感头；301/302/303 非 GET/HEAD 切换为 GET。
 */
export async function sendNetRequest(net: ElectronNetLike, params: NetRequestParams): Promise<NetRequestResult> {
  const limits: NetworkLimits = { ...DEFAULT_NETWORK_LIMITS, ...params.limits };
  let currentUrl = params.url;
  let currentMethod = params.method;
  let currentBody: Uint8Array | undefined = params.body;
  let headers: Record<string, string> = { ...params.headers };

  for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
    const hopParams: SingleHopParams = {
      url: currentUrl,
      method: currentMethod,
      headers,
      limits,
      ...(currentBody !== undefined ? { body: currentBody } : {}),
      ...(params.signal !== undefined ? { signal: params.signal } : {}),
      ...(params.deadline !== undefined ? { deadline: params.deadline } : {}),
    };

    const outcome = await sendSingleHop(net, hopParams);

    if (outcome.kind === 'redirect') {
      const targetUrl = resolveRedirectUrl(currentUrl, outcome.url);
      const authorize = params.authorizeRedirect;
      const allowed = targetUrl !== null && authorize !== undefined ? await authorize(targetUrl) : false;
      if (targetUrl === null || !allowed) {
        throw new PalPortError(PAL_ERROR_CODES.HTTP_REDIRECT_DENIED, undefined, {
          details: { host: targetUrl === null ? null : readHost(targetUrl) },
        });
      }
      if (isCrossOrigin(currentUrl, targetUrl)) {
        headers = filterHeaders(headers, SENSITIVE_HEADERS);
      }
      if (shouldSwitchToGet(outcome.statusCode) && currentMethod !== 'GET' && currentMethod !== 'HEAD') {
        currentMethod = 'GET';
        currentBody = undefined;
        headers = filterHeaders(headers, ENTITY_HEADERS);
      }
      currentUrl = targetUrl;
      continue;
    }

    return readResponseBody(outcome.handle, limits, params);
  }

  throw new PalPortError(PAL_ERROR_CODES.HTTP_REQUEST_FAILED, undefined, {
    details: { reason: 'too-many-redirects', maxRedirects: limits.maxRedirects },
  });
}

/** 单跳请求参数。 */
interface SingleHopParams {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly limits: NetworkLimits;
  readonly body?: Uint8Array;
  readonly signal?: AbortSignal;
  readonly deadline?: number;
}

/**
 * 发送单跳请求；返回重定向或响应句柄。
 *
 * @remarks
 * 本函数只负责响应头之前的状态机（连接超时、到点、取消与重定向）；
 * 响应体阶段的空闲超时、大小限制与取消由 {@link readResponseBody} 接管。
 */
function sendSingleHop(net: ElectronNetLike, params: SingleHopParams): Promise<HopOutcome> {
  return new Promise<HopOutcome>((resolvePromise, rejectPromise) => {
    let settled = false;
    let connectTimer: NodeJS.Timeout | undefined;
    let deadlineTimer: NodeJS.Timeout | undefined;
    let onSignalAbort: (() => void) | undefined;

    const cleanup = (): void => {
      if (connectTimer !== undefined) {
        clearTimeout(connectTimer);
        connectTimer = undefined;
      }
      if (deadlineTimer !== undefined) {
        clearTimeout(deadlineTimer);
        deadlineTimer = undefined;
      }
      if (onSignalAbort !== undefined) {
        params.signal?.removeEventListener('abort', onSignalAbort);
        onSignalAbort = undefined;
      }
    };

    const fail = (error: PalPortError): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      rejectPromise(error);
    };

    if (params.signal?.aborted === true) {
      fail(new PalPortError(PAL_ERROR_CODES.BRIDGE_CANCELLED));
      return;
    }
    if (params.deadline !== undefined && Date.now() >= params.deadline) {
      fail(new PalPortError(PAL_ERROR_CODES.BRIDGE_TIMEOUT));
      return;
    }

    let request: ElectronClientRequestLike;
    try {
      request = net.request({
        url: params.url,
        method: params.method,
        redirect: 'manual',
        credentials: 'omit',
      });
    } catch (error) {
      fail(
        new PalPortError(PAL_ERROR_CODES.HTTP_REQUEST_FAILED, undefined, {
          details: { reason: 'request-create-failed' },
          cause: error,
        }),
      );
      return;
    }

    connectTimer = setTimeout(() => {
      fail(
        new PalPortError(PAL_ERROR_CODES.BRIDGE_TIMEOUT, undefined, {
          details: { reason: 'connect-timeout' },
        }),
      );
      request.abort();
    }, params.limits.connectTimeoutMs);
    connectTimer.unref?.();

    if (params.deadline !== undefined) {
      deadlineTimer = setTimeout(
        () => {
          fail(
            new PalPortError(PAL_ERROR_CODES.BRIDGE_TIMEOUT, undefined, {
              details: { reason: 'deadline' },
            }),
          );
          request.abort();
        },
        Math.max(params.deadline - Date.now(), 0),
      );
      deadlineTimer.unref?.();
    }

    onSignalAbort = (): void => {
      fail(new PalPortError(PAL_ERROR_CODES.BRIDGE_CANCELLED));
      request.abort();
    };
    params.signal?.addEventListener('abort', onSignalAbort, { once: true });

    request.on('response', (response) => {
      if (settled) {
        request.abort();
        return;
      }
      settled = true;
      cleanup();
      resolvePromise({
        kind: 'response',
        handle: {
          response,
          abort: () => request.abort(),
        },
      });
    });

    request.on('redirect', (statusCode, _method, redirectUrl) => {
      if (settled || statusCode < 300 || statusCode > 399) {
        return;
      }
      settled = true;
      cleanup();
      resolvePromise({ kind: 'redirect', statusCode, url: redirectUrl });
    });

    request.on('error', (error) => {
      const cancelled = params.signal?.aborted === true;
      fail(
        new PalPortError(
          cancelled ? PAL_ERROR_CODES.BRIDGE_CANCELLED : PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
          undefined,
          {
            details: { reason: cancelled ? 'cancelled' : 'network-error' },
            cause: error,
          },
        ),
      );
    });

    request.on('abort', () => {
      if (settled) {
        return;
      }
      const cancelled = params.signal?.aborted === true;
      fail(
        new PalPortError(
          cancelled ? PAL_ERROR_CODES.BRIDGE_CANCELLED : PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
          undefined,
          { details: { reason: cancelled ? 'cancelled' : 'aborted' } },
        ),
      );
    });

    for (const [name, value] of Object.entries(params.headers)) {
      request.setHeader(name, value);
    }

    try {
      request.end(params.body !== undefined ? Buffer.from(params.body) : undefined);
    } catch (error) {
      fail(
        new PalPortError(PAL_ERROR_CODES.HTTP_REQUEST_FAILED, undefined, {
          details: { reason: 'request-send-failed' },
          cause: error,
        }),
      );
    }
  });
}

/**
 * 聚合响应体并执行大小限制；响应体阶段继续响应取消、截止与空闲超时。
 *
 * @param handle 响应句柄（可中止底层请求）。
 * @param limits 网络限制。
 * @param params 原始请求参数（取消信号、截止时间与数据回调）。
 * @returns 响应结果。
 * @throws {PalPortError} `HTTP_REQUEST_FAILED`（含响应过大）/ `BRIDGE_CANCELLED` / `BRIDGE_TIMEOUT`。
 */
function readResponseBody(
  handle: ResponseHandle,
  limits: NetworkLimits,
  params: NetRequestParams,
): Promise<NetRequestResult> {
  const { response } = handle;
  return new Promise<NetRequestResult>((resolvePromise, rejectPromise) => {
    const headers = normalizeHeaders(response.headers);
    const contentLength = readContentLength(headers);
    params.onResponseHead?.({ status: response.statusCode, headers });

    const chunks: Buffer[] = [];
    const buffered = params.bufferResponse !== false;
    const signal = params.signal;
    let idleTimer: NodeJS.Timeout | undefined;
    let deadlineTimer: NodeJS.Timeout | undefined;
    let transferred = 0;
    let settled = false;

    const cleanup = (): void => {
      if (idleTimer !== undefined) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
      if (deadlineTimer !== undefined) {
        clearTimeout(deadlineTimer);
        deadlineTimer = undefined;
      }
      if (signal !== undefined) {
        signal.removeEventListener('abort', onSignalAbort);
      }
    };

    const fail = (
      code:
        | typeof PAL_ERROR_CODES.BRIDGE_CANCELLED
        | typeof PAL_ERROR_CODES.BRIDGE_TIMEOUT
        | typeof PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
      details?: Readonly<Record<string, unknown>>,
      cause?: unknown,
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      const options: { details?: Readonly<Record<string, unknown>>; cause?: unknown } = {};
      if (details !== undefined) {
        options.details = details;
      }
      if (cause !== undefined) {
        options.cause = cause;
      }
      rejectPromise(new PalPortError(code, undefined, options));
    };

    const succeed = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolvePromise({
        status: response.statusCode,
        headers,
        body: Buffer.concat(chunks),
      });
    };

    const armIdleTimer = (): void => {
      if (idleTimer !== undefined) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        fail(PAL_ERROR_CODES.BRIDGE_TIMEOUT, { reason: 'idle-timeout' });
        handle.abort();
      }, limits.idleTimeoutMs);
      idleTimer.unref?.();
    };

    function onSignalAbort(): void {
      fail(PAL_ERROR_CODES.BRIDGE_CANCELLED, { reason: 'cancelled' });
      handle.abort();
    }

    if (signal?.aborted === true) {
      fail(PAL_ERROR_CODES.BRIDGE_CANCELLED, { reason: 'cancelled' });
      handle.abort();
      return;
    }
    if (params.deadline !== undefined && Date.now() >= params.deadline) {
      fail(PAL_ERROR_CODES.BRIDGE_TIMEOUT, { reason: 'deadline' });
      handle.abort();
      return;
    }

    signal?.addEventListener('abort', onSignalAbort, { once: true });
    if (params.deadline !== undefined) {
      deadlineTimer = setTimeout(
        () => {
          fail(PAL_ERROR_CODES.BRIDGE_TIMEOUT, { reason: 'deadline' });
          handle.abort();
        },
        Math.max(params.deadline - Date.now(), 0),
      );
      deadlineTimer.unref?.();
    }
    armIdleTimer();

    response.on('data', (chunk) => {
      if (settled) {
        return;
      }
      armIdleTimer();
      transferred += chunk.byteLength;
      if (transferred > limits.maxResponseBytes) {
        fail(PAL_ERROR_CODES.HTTP_REQUEST_FAILED, {
          reason: 'response-too-large',
          limitBytes: limits.maxResponseBytes,
        });
        handle.abort();
        return;
      }
      if (buffered) {
        chunks.push(chunk);
      }
      params.onData?.(chunk, transferred, contentLength);
    });

    response.on('end', () => {
      succeed();
    });

    response.on('error', (error) => {
      fail(PAL_ERROR_CODES.HTTP_REQUEST_FAILED, { reason: 'response-error' }, error);
    });

    response.on('aborted', () => {
      fail(resolveAbortCode(params), { reason: 'response-aborted' });
    });
  });
}

/** 解析响应体中止时的错误码：优先反映调用方取消与截止。 */
function resolveAbortCode(
  params: NetRequestParams,
):
  | typeof PAL_ERROR_CODES.BRIDGE_CANCELLED
  | typeof PAL_ERROR_CODES.BRIDGE_TIMEOUT
  | typeof PAL_ERROR_CODES.HTTP_REQUEST_FAILED {
  if (params.signal?.aborted === true) {
    return PAL_ERROR_CODES.BRIDGE_CANCELLED;
  }
  if (params.deadline !== undefined && Date.now() >= params.deadline) {
    return PAL_ERROR_CODES.BRIDGE_TIMEOUT;
  }
  return PAL_ERROR_CODES.HTTP_REQUEST_FAILED;
}

/** 解析重定向目标：相对地址以当前地址为基准；无法解析时返回 `null`。 */
function resolveRedirectUrl(currentUrl: string, redirectUrl: string): string | null {
  try {
    return new URL(redirectUrl, currentUrl).toString();
  } catch {
    return null;
  }
}

/** 归一化响应头为 `Record<string, string>`。 */
function normalizeHeaders(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    normalized[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return normalized;
}

/** 读取 `Content-Length`。 */
function readContentLength(headers: Readonly<Record<string, string>>): number | null {
  const raw = headers['content-length'];
  if (raw === undefined) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** 301/302/303 的非 GET/HEAD 请求切换为 GET。 */
function shouldSwitchToGet(statusCode: number): boolean {
  return statusCode === 301 || statusCode === 302 || statusCode === 303;
}

/** 过滤指定请求头（大小写不敏感）。 */
function filterHeaders(
  headers: Readonly<Record<string, string>>,
  blocked: ReadonlySet<string>,
): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (blocked.has(name.toLowerCase())) {
      continue;
    }
    filtered[name] = value;
  }
  return filtered;
}

/** 两个 URL 是否跨源；解析失败按跨源处理。 */
function isCrossOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin !== new URL(right).origin;
  } catch {
    return true;
  }
}

/** 读取 URL host（用于诊断，不暴露完整路径与 query）。 */
function readHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
