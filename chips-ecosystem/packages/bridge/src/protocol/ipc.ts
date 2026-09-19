/**
 * IPC 通道与消息格式（02-Bridge三层设计 §7）。
 *
 * 通道名固定，不得由插件自定义或拼接；跨 IPC 的值必须是结构化克隆兼容类型。
 */

import {
  BRIDGE_ERROR_CODES,
  ChipsError,
  createBridgeError,
  isPlainChipsError,
  type IChipsError,
} from './errors.js';
import {
  EVENT_ERROR_CODES,
  EVENT_PAYLOAD_MAX_BYTES,
  type IEventControlResponse,
} from './events.js';
import type { IResourceControlResponse, IResourceMetadata } from './resource.js';

/** IPC 通道总表（02-Bridge三层设计 §7.1）。 */
export const IPC_CHANNELS = {
  /** 渲染 → 主：能力调用（含 `event:publish`），`invoke` / `handle`。 */
  bridgeRequest: 'bridge:request',
  /** 渲染 → 主：资源句柄打开与释放，`invoke` / `handle`。 */
  bridgeResource: 'bridge:resource',
  /** 渲染 → 主：订阅计数变更与错误回执，`invoke` / `handle`。 */
  eventControl: 'event:control',
  /** 主 → 渲染：会话权限快照同步下行。 */
  sessionPermissions: 'session:permissions',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** 事件下行通道前缀；完整通道为 `event:<eventId>`。 */
export const EVENT_CHANNEL_PREFIX = 'event:';

export function eventChannel(eventId: string): string {
  return `${EVENT_CHANNEL_PREFIX}${eventId}`;
}

export interface IBridgeRequest {
  requestId: string;
  capabilityId: string;
  input?: unknown;
}

export type IBridgeResponse =
  | { requestId: string; ok: true; result: unknown }
  | { requestId: string; ok: false; error: IChipsError };

export interface ISessionPermissionsUpdate {
  sessionId: string;
  grantedPermissions: string[];
  permissionVersion: number;
}

export interface ICloneableCheckOptions {
  /** 违约时使用的错误码；默认 `BRIDGE_INTERNAL`。 */
  code?: string;
  /** 违约时的简体中文文案。 */
  message?: string;
}

function cloneViolation(options: ICloneableCheckOptions, path: string, reason: string): ChipsError {
  return new ChipsError({
    code: options.code ?? BRIDGE_ERROR_CODES.internal,
    message: options.message ?? '数据不可跨进程传输',
    details: { path, reason },
    retryable: false,
  });
}

/**
 * 结构化克隆兼容校验：允许 JSON 值、`Uint8Array`、`ArrayBuffer` 与 `undefined`；
 * 拒绝函数、`Symbol`、`bigint`、类实例（含 `Error` / `Date` / `Map` / `Set` / DOM 对象）。
 */
export function assertStructuredCloneable(
  value: unknown,
  options: ICloneableCheckOptions = {}
): void {
  const visit = (current: unknown, path: string): void => {
    if (current === null || current === undefined) {
      return;
    }
    const type = typeof current;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return;
    }
    if (type === 'bigint') {
      throw cloneViolation(options, path, 'bigint');
    }
    if (type === 'function' || type === 'symbol') {
      throw cloneViolation(options, path, type);
    }
    if (current instanceof Uint8Array || current instanceof ArrayBuffer) {
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        visit(item, `${path}/${String(index)}`);
      });
      return;
    }
    if (type === 'object') {
      const prototype = Object.getPrototypeOf(current) as object | null;
      if (prototype !== Object.prototype && prototype !== null) {
        throw cloneViolation(options, path, 'class-instance');
      }
      for (const [key, child] of Object.entries(current)) {
        visit(child, `${path}/${key}`);
      }
      return;
    }
    throw cloneViolation(options, path, type);
  };
  visit(value, '');
}

/** 结构化克隆兼容值的序列化体积估算（UTF-8 口径）；用于事件载荷 256 KiB 上限判定。 */
export function estimateSerializedBytes(value: unknown): number {
  const encoder = new TextEncoder();
  const visit = (current: unknown): number => {
    if (current === null || current === undefined) {
      return 4;
    }
    const type = typeof current;
    if (type === 'string') {
      return encoder.encode(current as string).length + 2;
    }
    if (typeof current === 'number' || typeof current === 'boolean') {
      return String(current).length;
    }
    if (current instanceof Uint8Array) {
      return current.byteLength;
    }
    if (current instanceof ArrayBuffer) {
      return current.byteLength;
    }
    if (Array.isArray(current)) {
      let total = 2;
      for (const item of current) {
        total += visit(item) + 1;
      }
      return total;
    }
    if (type === 'object' && current !== null) {
      let total = 2;
      for (const [key, child] of Object.entries(current)) {
        total += encoder.encode(key).length + visit(child) + 4;
      }
      return total;
    }
    return 0;
  };
  return visit(value);
}

/** 事件载荷约束校验（05-事件契约规范 §3.4）：可克隆且不超过 256 KiB。 */
export function assertEventPayload(payload: unknown): void {
  assertStructuredCloneable(payload, {
    code: EVENT_ERROR_CODES.payloadUnsupported,
    message: '事件载荷包含不可传输的数据',
  });
  if (estimateSerializedBytes(payload) > EVENT_PAYLOAD_MAX_BYTES) {
    throw new ChipsError({
      code: EVENT_ERROR_CODES.payloadTooLarge,
      message: '事件载荷过大',
      details: { maxBytes: EVENT_PAYLOAD_MAX_BYTES },
      retryable: false,
    });
  }
}

function malformed(message: string): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.internal, { message, retryable: false });
}

/** 错误归一为普通对象：`ChipsError` 与同构普通对象原样透传，其余归一为内部错误。 */
function toPlainError(error: unknown, fallbackMessage: string): IChipsError {
  if (error instanceof ChipsError) {
    return error.toPlain();
  }
  if (isPlainChipsError(error)) {
    return ChipsError.fromPlain(error).toPlain();
  }
  return new ChipsError({ code: BRIDGE_ERROR_CODES.internal, message: fallbackMessage }).toPlain();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRequestId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw malformed('IPC 消息缺少 requestId');
  }
  return value;
}

/** 编码主进程响应：错误归一为普通对象，结果与错误均做克隆兼容校验。 */
export function encodeBridgeResponse(response: IBridgeResponse): IBridgeResponse {
  if (response.ok) {
    assertStructuredCloneable(response.result);
    return response;
  }
  const error = isPlainChipsError(response.error)
    ? response.error
    : ChipsError.fromPlain(response.error).toPlain();
  return { requestId: response.requestId, ok: false, error };
}

/** 解码渲染侧请求；结构非法视为平台缺陷，返回 `BRIDGE_INTERNAL`。 */
export function decodeBridgeRequest(raw: unknown): IBridgeRequest {
  if (!isRecord(raw)) {
    throw malformed('IPC 请求格式非法');
  }
  const requestId = requireRequestId(raw.requestId);
  if (typeof raw.capabilityId !== 'string' || raw.capabilityId.length === 0) {
    throw malformed('IPC 请求缺少 capabilityId');
  }
  return raw.input === undefined
    ? { requestId, capabilityId: raw.capabilityId }
    : { requestId, capabilityId: raw.capabilityId, input: raw.input };
}

/** 解码主进程响应；`requestId` 缺失或判别字段非法时返回 `BRIDGE_INTERNAL`。 */
export function decodeBridgeResponse(raw: unknown): IBridgeResponse {
  if (!isRecord(raw)) {
    throw malformed('IPC 响应格式非法');
  }
  const requestId = requireRequestId(raw.requestId);
  if (raw.ok === true) {
    return { requestId, ok: true, result: raw.result };
  }
  if (raw.ok === false) {
    if (!isPlainChipsError(raw.error)) {
      throw malformed('IPC 响应错误结构非法');
    }
    return { requestId, ok: false, error: raw.error };
  }
  throw malformed('IPC 响应缺少 ok 判别字段');
}

export interface IResourceControlEnvelope {
  requestId: string;
  operation: 'open' | 'release';
  uri: string;
}

export function decodeResourceControlResponse(raw: unknown): IResourceControlResponse {
  if (!isRecord(raw)) {
    throw malformed('资源控制响应格式非法');
  }
  const requestId = requireRequestId(raw.requestId);
  if (raw.ok === true) {
    if (raw.metadata === null) {
      return { requestId, ok: true, metadata: null };
    }
    if (!isResourceMetadata(raw.metadata)) {
      throw malformed('资源控制响应元数据结构非法');
    }
    return { requestId, ok: true, metadata: raw.metadata };
  }
  if (raw.ok === false) {
    if (!isPlainChipsError(raw.error)) {
      throw malformed('资源控制响应错误结构非法');
    }
    return { requestId, ok: false, error: raw.error };
  }
  throw malformed('资源控制响应缺少 ok 判别字段');
}

function isResourceMetadata(value: unknown): value is IResourceMetadata {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.uri === 'string' &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    typeof value.mimeType === 'string' &&
    typeof value.version === 'string' &&
    typeof value.scope === 'string'
  );
}

export function decodeResourceControlRequest(raw: unknown): IResourceControlEnvelope {
  if (!isRecord(raw)) {
    throw malformed('资源控制请求格式非法');
  }
  const requestId = requireRequestId(raw.requestId);
  if (raw.operation !== 'open' && raw.operation !== 'release') {
    throw malformed('资源控制操作非法');
  }
  if (typeof raw.uri !== 'string' || raw.uri.length === 0) {
    throw malformed('资源控制请求缺少 uri');
  }
  return { requestId, operation: raw.operation, uri: raw.uri };
}

export function encodeResourceControlSuccess(
  requestId: string,
  metadata: IResourceMetadata | null
): { requestId: string; ok: true; metadata: IResourceMetadata | null } {
  return { requestId, ok: true, metadata };
}

export function encodeResourceControlFailure(
  requestId: string,
  error: unknown
): { requestId: string; ok: false; error: IChipsError } {
  return { requestId, ok: false, error: toPlainError(error, '资源操作失败') };
}

export interface IEventControlEnvelope {
  controlId: string;
  action: 'subscribe' | 'unsubscribe';
  eventId: string;
}

export function decodeEventControlRequest(raw: unknown): IEventControlEnvelope {
  if (!isRecord(raw)) {
    throw malformed('事件控制请求格式非法');
  }
  if (typeof raw.controlId !== 'string' || raw.controlId.length === 0) {
    throw malformed('事件控制请求缺少 controlId');
  }
  if (raw.action !== 'subscribe' && raw.action !== 'unsubscribe') {
    throw malformed('事件控制动作非法');
  }
  if (typeof raw.eventId !== 'string' || raw.eventId.length === 0) {
    throw malformed('事件控制请求缺少 eventId');
  }
  return { controlId: raw.controlId, action: raw.action, eventId: raw.eventId };
}

export function encodeEventControlSuccess(controlId: string): { controlId: string; ok: true } {
  return { controlId, ok: true };
}

export function encodeEventControlFailure(
  controlId: string,
  error: unknown
): { controlId: string; ok: false; error: IChipsError } {
  return { controlId, ok: false, error: toPlainError(error, '事件订阅失败') };
}

export function decodeEventControlResponse(raw: unknown): IEventControlResponse {
  if (!isRecord(raw)) {
    throw malformed('事件控制响应格式非法');
  }
  if (typeof raw.controlId !== 'string' || raw.controlId.length === 0) {
    throw malformed('事件控制响应缺少 controlId');
  }
  if (raw.ok === true) {
    return { controlId: raw.controlId, ok: true };
  }
  if (raw.ok === false) {
    if (!isPlainChipsError(raw.error)) {
      throw malformed('事件控制响应错误结构非法');
    }
    return { controlId: raw.controlId, ok: false, error: raw.error };
  }
  throw malformed('事件控制响应缺少 ok 判别字段');
}

/** 解码会话权限下行推送；版本号与字段非法时返回 `undefined`（丢弃该推送）。 */
export function decodeSessionPermissionsUpdate(
  raw: unknown
): ISessionPermissionsUpdate | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const { sessionId, grantedPermissions, permissionVersion } = raw;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return undefined;
  }
  if (
    !Array.isArray(grantedPermissions) ||
    !grantedPermissions.every((item) => typeof item === 'string')
  ) {
    return undefined;
  }
  if (
    typeof permissionVersion !== 'number' ||
    !Number.isInteger(permissionVersion) ||
    permissionVersion < 0
  ) {
    return undefined;
  }
  return { sessionId, grantedPermissions: [...grantedPermissions], permissionVersion };
}
