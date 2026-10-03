/**
 * 社区平台 API 客户端基础封装（Web 前台）：
 * - 统一 JSON 信封、请求追踪（`X-Request-Id`）与 Cookie 会话（`credentials: 'include'`）；
 * - 错误归一遵循《社区平台 API 契约》§7.4（业务码透传 / COMMUNITY_RESPONSE_INVALID / 网络失败）；
 * - 401 自动刷新（契约 §3.6）：仅对 `COMMUNITY_AUTH_TOKEN_EXPIRED` / `COMMUNITY_AUTH_TOKEN_INVALID`
 *   重试一次，并发 401 合并为单次刷新（single-flight）；刷新 204 即清空内存令牌并通知会话丢失；
 * - `accessToken` 仅内存持有，不落盘、不入日志；浏览器刷新令牌由 `HttpOnly` Cookie 承载，
 *   刷新响应体中的 `refreshToken` 轮换值由服务端经 `Set-Cookie` 同步，客户端不持久化。
 */

import {
  communityResponseInvalidError,
  CommunityApiError,
  COMMUNITY_ERROR_SPECS,
  HTTP_REQUEST_FAILED,
  isRegisteredCommunityErrorCode,
} from './errors';
import { parseTokenPair } from './dto';

const API_PREFIX = '/api/v1';
const REFRESH_PATH = '/auth/refresh';

/** 触发 401 自动刷新的业务码（契约 §3.6 第 1 条）。 */
const REFRESHABLE_401_CODES: ReadonlySet<string> = new Set([
  'COMMUNITY_AUTH_TOKEN_EXPIRED',
  'COMMUNITY_AUTH_TOKEN_INVALID',
]);

export interface CommunityRequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: BodyInit;
  headers?: HeadersInit;
}

/** 刷新结果：`restored` 恢复登录态；`unavailable` 当前没有可恢复登录态（契约 §3.3）。 */
export type RefreshOutcome = 'restored' | 'unavailable';

export interface CommunityApiClientOptions {
  /** 端点基址：同源部署缺省为空串；本地开发经 dev server 代理。 */
  baseUrl?: string;
  /** fetch 实现：默认全局 fetch；测试注入 mock。 */
  fetchImpl?: typeof fetch;
}

export class CommunityApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private accessToken: string | null = null;
  private refreshInFlight: Promise<RefreshOutcome> | null = null;
  private readonly sessionLostHandlers = new Set<() => void>();

  constructor(options: CommunityApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.fetchImpl =
      options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  }

  /** 写入内存 access token（登录 / 注册 / 刷新成功后调用）。 */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /** 读取内存 access token；未登录为 null。 */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** 清空内存 access token。 */
  clearAccessToken(): void {
    this.accessToken = null;
  }

  /** 注册会话丢失回调（刷新 204 / 失败时触发）；返回取消注册函数。 */
  onSessionLost(handler: () => void): () => void {
    this.sessionLostHandlers.add(handler);
    return () => {
      this.sessionLostHandlers.delete(handler);
    };
  }

  /** 刷新会话（single-flight）：并发调用共享同一次刷新。 */
  async refreshSession(): Promise<RefreshOutcome> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const attempt = this.doRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    this.refreshInFlight = attempt;
    return attempt;
  }

  /** 发起社区 API 请求：返回成功信封的 `data`；204 返回 undefined。 */
  async request<T>(path: string, init: CommunityRequestInit = {}): Promise<T> {
    return this.dispatch<T>(path, init, true);
  }

  get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const search = query ? `?${new URLSearchParams(query).toString()}` : '';
    return this.request<T>(`${path}${search}`, { method: 'GET' });
  }

  post<T>(path: string, payload?: unknown): Promise<T> {
    return this.request<T>(path, withJsonBody('POST', payload));
  }

  patch<T>(path: string, payload?: unknown): Promise<T> {
    return this.request<T>(path, withJsonBody('PATCH', payload));
  }

  put<T>(path: string, payload?: unknown): Promise<T> {
    return this.request<T>(path, withJsonBody('PUT', payload));
  }

  /** 删除类请求：契约口径首次 204、重复 404，一律无返回值。 */
  async delete(path: string): Promise<void> {
    await this.request<void>(path, { method: 'DELETE' });
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}${API_PREFIX}${path}`;
  }

  private notifySessionLost(): void {
    this.accessToken = null;
    for (const handler of this.sessionLostHandlers) {
      handler();
    }
  }

  private async dispatch<T>(
    path: string,
    init: CommunityRequestInit,
    allowAuthRetry: boolean
  ): Promise<T> {
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    if (
      init.body !== undefined &&
      !(init.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
    }
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }
    headers.set('X-Request-Id', createRequestId());

    let response: Response;
    try {
      const requestInit: RequestInit = { method, headers, credentials: 'include' };
      if (init.body !== undefined) {
        requestInit.body = init.body;
      }
      response = await this.fetchImpl(this.buildUrl(path), requestInit);
    } catch {
      throw new CommunityApiError({
        code: HTTP_REQUEST_FAILED,
        message: '网络连接失败，请检查网络后重试',
        httpStatus: 0,
        retryable: true,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const body = await readJsonBody(response);

    if (!response.ok) {
      const error = normalizeErrorResponse(response.status, body);
      if (allowAuthRetry && response.status === 401 && REFRESHABLE_401_CODES.has(error.code)) {
        const outcome = await this.refreshSession();
        if (outcome === 'restored') {
          return this.dispatch<T>(path, init, false);
        }
      }
      throw error;
    }

    const envelope = readSuccessEnvelope(body);
    if (!envelope) {
      throw communityResponseInvalidError({
        httpStatus: response.status,
        traceId: readTraceId(body),
      });
    }
    return envelope.data as T;
  }

  private async doRefresh(): Promise<RefreshOutcome> {
    const unavailable = (): RefreshOutcome => {
      // 契约 §3.3：204 即「当前没有可恢复登录态」；非 200/204 与网络失败同样无法恢复。
      this.notifySessionLost();
      return 'unavailable';
    };

    let response: Response;
    try {
      response = await this.fetchImpl(this.buildUrl(REFRESH_PATH), {
        method: 'POST',
        headers: new Headers({ 'X-Request-Id': createRequestId() }),
        credentials: 'include',
      });
    } catch {
      return unavailable();
    }

    if (response.status === 204) {
      return unavailable();
    }
    if (!response.ok) {
      return unavailable();
    }

    const body = await readJsonBody(response);
    const envelope = readSuccessEnvelope(body);
    if (!envelope) {
      return unavailable();
    }

    let accessToken: string;
    try {
      accessToken = parseTokenPair(envelope.data).accessToken;
    } catch {
      return unavailable();
    }
    // 浏览器仅消费新的 access token；refresh token 轮换由服务端经 Set-Cookie 完成。
    this.accessToken = accessToken;
    return 'restored';
  }
}

/** 应用级单例：同源 `/api/v1` 部署口径；测试与宿主经构造函数注入独立实例。 */
export const communityClient = new CommunityApiClient();

function serializeJsonBody(payload: unknown): string | undefined {
  return payload === undefined ? undefined : JSON.stringify(payload);
}

/** 组装带 JSON 请求体的请求初始化（`exactOptionalPropertyTypes` 口径：无体不设字段）。 */
function withJsonBody(method: 'POST' | 'PATCH' | 'PUT', payload: unknown): CommunityRequestInit {
  const body = serializeJsonBody(payload);
  return body === undefined ? { method } : { method, body };
}

function createRequestId(): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return random.replaceAll('-', '').padEnd(32, '0').slice(0, 128);
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

interface ParsedErrorEnvelope {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
  retryable: boolean | null;
  traceId: string | null;
}

function readErrorEnvelope(body: unknown): ParsedErrorEnvelope | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null || Array.isArray(error)) {
    return null;
  }
  const record = error as Record<string, unknown>;
  if (
    typeof record.code !== 'string' ||
    record.code.length === 0 ||
    typeof record.message !== 'string'
  ) {
    return null;
  }
  const details = isPlainRecord(record.details) ? record.details : null;
  const retryable = typeof record.retryable === 'boolean' ? record.retryable : null;
  return {
    code: record.code,
    message: record.message,
    details,
    retryable,
    traceId: details && typeof details.traceId === 'string' ? details.traceId : null,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTraceId(body: unknown): string | null {
  return readErrorEnvelope(body)?.traceId ?? null;
}

/** 错误归一（契约 §7.4）：业务码透传并附加 `httpStatus`；不符合契约归一为 `COMMUNITY_RESPONSE_INVALID`。 */
function normalizeErrorResponse(httpStatus: number, body: unknown): CommunityApiError {
  const envelope = readErrorEnvelope(body);
  if (!envelope || !isRegisteredCommunityErrorCode(envelope.code)) {
    return communityResponseInvalidError({ httpStatus, traceId: envelope?.traceId ?? null });
  }
  const registered = COMMUNITY_ERROR_SPECS[envelope.code];
  const details: Record<string, unknown> = { ...envelope.details, httpStatus };
  return new CommunityApiError({
    code: envelope.code,
    message: envelope.message,
    httpStatus,
    retryable: envelope.retryable ?? registered.retryable,
    details,
    traceId: envelope.traceId,
  });
}

interface SuccessEnvelope {
  data: unknown;
}

/** 成功信封校验（契约 §2.3）：仅允许 `data` 与可选 `pagination`，多余键视为不符合契约。 */
function readSuccessEnvelope(body: unknown): SuccessEnvelope | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (!('data' in record)) {
    return null;
  }
  for (const key of Object.keys(record)) {
    if (key !== 'data' && key !== 'pagination') {
      return null;
    }
  }
  if (record.pagination !== undefined && !isValidPagination(record.pagination)) {
    return null;
  }
  return { data: record.data };
}

function isValidPagination(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.page === 'number' &&
    typeof record.pageSize === 'number' &&
    typeof record.total === 'number' &&
    typeof record.totalPages === 'number'
  );
}
