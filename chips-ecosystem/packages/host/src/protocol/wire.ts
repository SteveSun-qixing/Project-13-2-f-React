/**
 * IPC 消息编解码与类型守卫。
 *
 * 权威：`02-Bridge三层设计` §7.2（消息类型定义）、§7.3（序列化约束）。
 *
 * @remarks
 * - 本模块是壳的 IPC 适配层对协议消息的结构视图：只做编解码与守卫，不做业务判定。
 * - 跨 IPC 的值必须是结构化克隆兼容类型；错误统一为普通对象（`ChipsError` 同构）。
 */

/** 与 `ChipsError` 同构的错误形状。 */
export interface IWireChipsError {
  /** 已登记错误码（`<DOMAIN>_<REASON>`）。 */
  readonly code: string;
  /** 面向用户的简体中文消息。 */
  readonly message: string;
  /** 结构化诊断；不含输入原文、凭证与内部路径。 */
  readonly details?: unknown;
  /** 是否可重试；缺省按 `false` 处理。 */
  readonly retryable?: boolean;
}

/** 能力调用请求。 */
export interface IBridgeRequest {
  /** preload 生成的关联键；同一会话内唯一。 */
  readonly requestId: string;
  /** 能力 ID。 */
  readonly capabilityId: string;
  /** 能力输入。 */
  readonly input?: unknown;
}

/** 能力调用响应。 */
export type IBridgeResponse =
  | { readonly requestId: string; readonly ok: true; readonly result: unknown }
  | { readonly requestId: string; readonly ok: false; readonly error: IWireChipsError };

/** 资源句柄控制操作。 */
export type ResourceControlOperation = 'open' | 'release';

/** 资源句柄控制请求。 */
export interface IResourceControlRequest {
  /** preload 生成的关联键。 */
  readonly requestId: string;
  /** 打开或释放。 */
  readonly operation: ResourceControlOperation;
  /** 规范 `chips-resource://` URI。 */
  readonly uri: string;
}

/** 资源元数据（与 `IResourceMetadata` 同构）。 */
export interface IWireResourceMetadata {
  /** 原始 URI。 */
  readonly uri: string;
  /** 字节数。 */
  readonly size: number;
  /** MIME 类型。 */
  readonly mimeType: string;
  /** 资源版本标识。 */
  readonly version: string;
  /** 作用域种类。 */
  readonly scope: string;
}

/** 资源句柄控制响应。 */
export type IResourceControlResponse =
  | { readonly requestId: string; readonly ok: true; readonly metadata: IWireResourceMetadata | null }
  | { readonly requestId: string; readonly ok: false; readonly error: IWireChipsError };

/** 事件订阅控制动作。 */
export type EventControlAction = 'subscribe' | 'unsubscribe';

/** 事件订阅控制请求。 */
export interface IEventControlRequest {
  /** preload 生成的关联键。 */
  readonly controlId: string;
  /** 订阅或退订。 */
  readonly action: EventControlAction;
  /** 事件 ID。 */
  readonly eventId: string;
}

/** 事件订阅控制响应。 */
export type IEventControlResponse =
  | { readonly controlId: string; readonly ok: true }
  | { readonly controlId: string; readonly ok: false; readonly error: IWireChipsError };

/** 事件信封（主 → 渲染）。 */
export interface IEventEnvelope {
  /** 事件 ID。 */
  readonly eventId: string;
  /** 事件负载。 */
  readonly payload: unknown;
  /** 事件产生时间（Unix epoch 毫秒）。 */
  readonly emittedAt: number;
}

/** 会话权限快照下行（主 → 渲染）。 */
export interface ISessionPermissionsUpdate {
  /** 会话标识。 */
  readonly sessionId: string;
  /** 当前授权集合。 */
  readonly grantedPermissions: readonly string[];
  /** 授权版本号，单调递增。 */
  readonly permissionVersion: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** 判断值是否为结构化克隆兼容的 `ChipsError` 同构对象。 */
export function isWireChipsError(value: unknown): value is IWireChipsError {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.code) || !isNonEmptyString(value.message)) {
    return false;
  }
  if (value.retryable !== undefined && typeof value.retryable !== 'boolean') {
    return false;
  }
  if (value.details !== undefined && value.details !== null && typeof value.details === 'function') {
    return false;
  }
  return true;
}

/** 判断值是否为合法能力调用请求。 */
export function isBridgeRequest(value: unknown): value is IBridgeRequest {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.requestId) && isNonEmptyString(value.capabilityId);
}

/** 判断值是否为合法能力调用响应。 */
export function isBridgeResponse(value: unknown): value is IBridgeResponse {
  if (!isRecord(value) || !isNonEmptyString(value.requestId)) {
    return false;
  }
  if (value.ok === true) {
    return 'result' in value;
  }
  if (value.ok === false) {
    return isWireChipsError(value.error);
  }
  return false;
}

/** 判断值是否为合法资源控制请求。 */
export function isResourceControlRequest(value: unknown): value is IResourceControlRequest {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.requestId) || !isNonEmptyString(value.uri)) {
    return false;
  }
  return value.operation === 'open' || value.operation === 'release';
}

/** 判断值是否为合法资源控制响应。 */
export function isResourceControlResponse(value: unknown): value is IResourceControlResponse {
  if (!isRecord(value) || !isNonEmptyString(value.requestId)) {
    return false;
  }
  if (value.ok === true) {
    return 'metadata' in value;
  }
  if (value.ok === false) {
    return isWireChipsError(value.error);
  }
  return false;
}

/** 判断值是否为合法事件控制请求。 */
export function isEventControlRequest(value: unknown): value is IEventControlRequest {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.controlId) || !isNonEmptyString(value.eventId)) {
    return false;
  }
  return value.action === 'subscribe' || value.action === 'unsubscribe';
}

/** 判断值是否为合法事件控制响应。 */
export function isEventControlResponse(value: unknown): value is IEventControlResponse {
  if (!isRecord(value) || !isNonEmptyString(value.controlId)) {
    return false;
  }
  if (value.ok === true) {
    return true;
  }
  if (value.ok === false) {
    return isWireChipsError(value.error);
  }
  return false;
}

/** 判断值是否为合法事件信封。 */
export function isEventEnvelope(value: unknown): value is IEventEnvelope {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.eventId) && typeof value.emittedAt === 'number' && 'payload' in value;
}

/** 判断值是否为合法会话权限快照。 */
export function isSessionPermissionsUpdate(value: unknown): value is ISessionPermissionsUpdate {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.sessionId) || typeof value.permissionVersion !== 'number') {
    return false;
  }
  return Array.isArray(value.grantedPermissions) && value.grantedPermissions.every(isNonEmptyString);
}

/** 把任意异常归一为 IPC 可传输的错误对象；未识别异常归一为 `BRIDGE_INTERNAL`（§9.1）。 */
export function toWireError(
  error: unknown,
  fallbackCode = 'BRIDGE_INTERNAL',
  fallbackMessage = '宿主内部错误',
): IWireChipsError {
  if (isWireChipsError(error)) {
    const normalized: IWireChipsError = {
      code: error.code,
      message: error.message,
      retryable: error.retryable ?? false,
    };
    return error.details === undefined ? normalized : { ...normalized, details: error.details };
  }
  if (error instanceof Error) {
    const code: unknown = (error as Error & { code?: unknown }).code;
    if (typeof code === 'string') {
      const message = error.message.length > 0 ? error.message : fallbackMessage;
      return { code, message, retryable: false };
    }
  }
  return { code: fallbackCode, message: fallbackMessage, retryable: false };
}
