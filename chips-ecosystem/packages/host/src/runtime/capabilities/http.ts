/**
 * 平台内置能力域：`http:request`（04-能力契约规范 §7.10、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.10（url 仅 `http`/`https`；method 默认 `GET`；headers 最多 64 个、
 * 名称 `^[A-Za-z0-9-]+$`、值 ≤ 4096 字符；body 上限 8 MiB）、§6.2（`network:http[:<domain>]`，
 * 限定值目标 `url`）、§11.4（`HTTP_URL_INVALID` / `HTTP_REQUEST_FAILED` / `HTTP_REDIRECT_DENIED` /
 * `HTTP_BLOCKED`），`04-资源管理设计` §8（重定向逐跳判定、超时与大小基线）。
 *
 * @remarks
 * - 处理器直连 PAL `http` 端口，能力模块不感知 Electron；协议白名单双层防线：能力层按 §7.10
 *   schema `pattern` 闸（`^https?://`），端口做系统级 URL/scheme 兜底（`isHttpUrl`）。
 * - 重定向逐跳授权回调由本域交付：回调内重新执行协议判定（scheme 仍在 `http`/`https` 集内），
 *   越界以在册码 `HTTP_REDIRECT_DENIED` 由端口终止；地址与域名限定值判定归核心权限链
 *   （`network:http:<domain>` 匹配随内核会话权威接线，本层不复制第二套判定）。
 * - 默认不携带 Cookie / Authorization（`credentials: 'omit'`，端口承载）；SSRF/私网/端口拦截
 *   （`HTTP_BLOCKED`）与大小上限（§8 基线）由端口与核心承载，本域不重复实现。
 * - `body` 为 `x-chips-binary` 字段（§7.10，上限 8388608 字节）：壳侧输入按 `Uint8Array` 收敛，
 *   内核信封（`bin` 表）交付后由同一深度校验承接。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  enumStringField,
  isFacetReady,
  patternStringField,
  readInputRecord,
  systemServiceInputError,
  toPortCall,
} from './system-service-common.js';

/** 内置 `http:request` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const HTTP_CAPABILITY_IDS = {
  request: 'http:request',
} as const;

/** 网络域权限 ID（R19 §6.2：`network:http[:<domain>]`，基础形式 `network:http`）。 */
export const HTTP_PERMISSION_IDS = {
  http: 'network:http',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.10 `httpInputSchemas`）。 */
export const HTTP_INPUT_SCHEMAS: Readonly<Record<'http:request', Readonly<Record<string, unknown>>>> = {
  'http:request': {
    type: 'object',
    additionalProperties: false,
    required: ['url'],
    properties: {
      url: { type: 'string', format: 'uri', pattern: '^https?://' },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
        default: 'GET',
      },
      headers: {
        type: 'object',
        maxProperties: 64,
        propertyNames: { pattern: '^[A-Za-z0-9-]+$' },
        additionalProperties: { type: 'string', maxLength: 4096 },
      },
      body: { 'x-chips-binary': 8388608 },
    },
  },
};

/** §7.10 协议白名单（`pattern: '^https?://'`，逐字对齐）。 */
const URL_PATTERN = /^https?:\/\//;

/** 请求头名称文法（§7.10 `propertyNames.pattern: '^[A-Za-z0-9-]+$'`）。 */
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]+$/;

/** 请求体大小上限（§7.10 `x-chips-binary: 8388608`，8 MiB）。 */
const BODY_MAX_BYTES = 8_388_608;

/** HTTP 方法集合（§7.10 enum）。 */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;

/**
 * 请求调用超时（毫秒）。
 *
 * @remarks 注册默认 30s 会拦下多跳重定向与慢响应体的合法请求（端口内连接 10s + 空闲 30s 为
 * 逐跳基线，5 跳最坏叠加可达百秒级）；显式放宽至 5 分钟，会话取消与截止仍由 `ctx` 即时收口。
 */
const HTTP_TIMEOUT_MS = 300_000;

/** 校验并收敛 `headers` 输入（越界即 `BRIDGE_INVALID_INPUT`）。 */
function readHeadersField(
  capabilityId: string,
  record: Record<string, unknown>,
): Readonly<Record<string, string>> | null {
  const raw = record.headers;
  if (raw === undefined) {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw systemServiceInputError(capabilityId, 'headers 必须是对象');
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 64) {
    throw systemServiceInputError(capabilityId, 'headers 不得超过 64 项');
  }
  const headers: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (!HEADER_NAME_PATTERN.test(name)) {
      throw systemServiceInputError(capabilityId, 'headers 名称必须匹配 ^[A-Za-z0-9-]+$');
    }
    if (typeof value !== 'string') {
      throw systemServiceInputError(capabilityId, `headers.${name} 必须是字符串`);
    }
    if (value.length > 4096) {
      throw systemServiceInputError(capabilityId, `headers.${name} 长度不得超过 4096`);
    }
    headers[name] = value;
  }
  return headers;
}

/** 校验并收敛 `body` 输入（§7.10 `x-chips-binary`：二进制、上限 8 MiB）。 */
function readBodyField(capabilityId: string, record: Record<string, unknown>): Uint8Array | null {
  const raw = record.body;
  if (raw === undefined) {
    return null;
  }
  if (!(raw instanceof Uint8Array)) {
    throw systemServiceInputError(capabilityId, 'body 必须是二进制数据');
  }
  if (raw.byteLength > BODY_MAX_BYTES) {
    throw systemServiceInputError(capabilityId, 'body 不得超过 8388608 字节');
  }
  return raw;
}

/** 构造内置 `http:request` 能力注册条目（分面缺位时返回空数组，整体不注册）。 */
export function createHttpCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'http')) {
    return [];
  }
  const http = host.ports.http!;
  const request: IHostCapabilityDescriptor = {
    id: HTTP_CAPABILITY_IDS.request,
    permissions: [HTTP_PERMISSION_IDS.http],
    schema: HTTP_INPUT_SCHEMAS['http:request'],
    targets: [{ permission: HTTP_PERMISSION_IDS.http, targetFields: ['url'] }],
    timeoutMs: HTTP_TIMEOUT_MS,
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(HTTP_CAPABILITY_IDS.request, input, ['url', 'method', 'headers', 'body']);
      const url = patternStringField(
        HTTP_CAPABILITY_IDS.request,
        record,
        'url',
        URL_PATTERN,
        'url 必须是 http(s) 绝对 URL',
      );
      const rawMethod = record.method;
      const method =
        rawMethod === undefined
          ? undefined
          : enumStringField(HTTP_CAPABILITY_IDS.request, record, 'method', HTTP_METHODS);
      const headers = readHeadersField(HTTP_CAPABILITY_IDS.request, record);
      const body = readBodyField(HTTP_CAPABILITY_IDS.request, record);
      const result = await http.request({
        ...toPortCall(ctx),
        url,
        ...(method !== undefined ? { method } : {}),
        ...(headers !== null ? { headers } : {}),
        ...(body !== null ? { body } : {}),
        // 逐跳重定向授权：协议判定本域交付；地址与域名限定值判定归核心权限链。
        authorizeRedirect: (target: string): Promise<boolean> => Promise.resolve(URL_PATTERN.test(target)),
      });
      return { status: result.status, headers: { ...result.headers }, body: result.body };
    },
  };
  return [request];
}
