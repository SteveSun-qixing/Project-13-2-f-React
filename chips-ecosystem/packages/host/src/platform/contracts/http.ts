import type { PortCallContext } from './call.js';

/** HTTP 方法；与能力契约 `http:request` 一致。 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

/** `http:request` 选项。 */
export interface HttpRequestOptions extends PortCallContext {
  /** `http(s)` 绝对 URL。 */
  readonly url: string;
  /** 方法；默认 `GET`。 */
  readonly method?: HttpMethod;
  /** 请求头（名称 `^[A-Za-z0-9-]+$`，由能力层 schema 校验）。 */
  readonly headers?: Readonly<Record<string, string>>;
  /** 请求体（上限 8 MiB，由能力层 schema 校验）。 */
  readonly body?: Uint8Array;
  /**
   * 逐跳重定向授权回调；返回 `false` 时以 `HTTP_REDIRECT_DENIED` 终止。
   *
   * 核心在回调内重新执行协议、地址与域名限定值判定（资源管理设计 §8.2、权限设计 §7.4）。
   */
  readonly authorizeRedirect?: (url: string) => Promise<boolean>;
}

/** `http:request` 响应。 */
export interface HttpResponse {
  /** HTTP 状态码。 */
  readonly status: number;
  /** 响应头。 */
  readonly headers: Readonly<Record<string, string>>;
  /** 响应体字节。 */
  readonly body: Uint8Array;
}

/**
 * HTTP 端口；对应 `http:request`。
 *
 * 权威：`04-能力契约规范` §7.10、`04-资源管理设计` §8。
 *
 * @remarks
 * - 默认不携带 Cookie / Authorization（`credentials: 'omit'`）。
 * - 最多 5 跳重定向且逐跳授权；超过返回 `HTTP_REQUEST_FAILED`。
 * - 连接 10s、首字节与空闲 30s 超时；响应体超过大小上限中止。
 * - 端口不做 SSRF/端口/域名判定（在核心）；取消返回 `BRIDGE_CANCELLED`，超时返回 `BRIDGE_TIMEOUT`。
 */
export interface IPalHttpPort {
  /** 执行一次 HTTP 请求（含重定向状态机）。 */
  request(options: HttpRequestOptions): Promise<HttpResponse>;
}
