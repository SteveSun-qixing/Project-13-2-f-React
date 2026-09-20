/**
 * Bridge 通道级与权限域错误码的壳侧结构视图（02-Bridge三层设计 §9.2、08-权限系统设计 §9.1）。
 *
 * 权威：`02-Bridge三层设计` §9（错误归一与通道级错误码）、`08-权限系统设计` §9.1（`PERMISSION_*` 域）。
 *
 * @remarks
 * - 错误码的权威事实源在 `@chips/bridge`（协议类型归属）；壳与 `@chips/bridge`、`@chips/sdk` 无
 *   运行时依赖（架构边界：壳是运行时承载，不 import 被承载方），因此以本模块作为**结构视图**等价实现，
 *   与 `protocol/wire.ts` 的 `IWireChipsError` 同构约定一致（`chips-error.ts` 同源思路）。
 * - 三方（本文错误码表、`@chips/bridge` 常量、`@chips/sdk` 生成常量）逐项一致由
 *   `@chips/contract-tests` 契约用例锁定；本模块只承载壳侧路由与判定产出的错误码，不做业务判定。
 * - 消费方（能力路由、权限判定、会话）一律引用本模块常量，不得散落字符串字面量。
 */

import type { IWireChipsError } from './wire.js';

/** Bridge 通道级错误码（02-Bridge三层设计 §9.2）。 */
export const BRIDGE_ERROR_CODES = {
  capabilityNotFound: 'BRIDGE_CAPABILITY_NOT_FOUND',
  capabilityConflict: 'BRIDGE_CAPABILITY_CONFLICT',
  invalidSchema: 'BRIDGE_INVALID_SCHEMA',
  permissionDenied: 'BRIDGE_PERMISSION_DENIED',
  invalidInput: 'BRIDGE_INVALID_INPUT',
  timeout: 'BRIDGE_TIMEOUT',
  cancelled: 'BRIDGE_CANCELLED',
  sessionUnknown: 'BRIDGE_SESSION_UNKNOWN',
  sessionBusy: 'BRIDGE_SESSION_BUSY',
  queueOverflow: 'BRIDGE_QUEUE_OVERFLOW',
  internal: 'BRIDGE_INTERNAL',
} as const;

/** Bridge 通道级错误码联合类型。 */
export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[keyof typeof BRIDGE_ERROR_CODES];

/** 通道级错误码的 `retryable` 口径（02-Bridge三层设计 §9.2）。 */
export const BRIDGE_ERROR_RETRYABLE: Readonly<Record<BridgeErrorCode, boolean>> = {
  BRIDGE_CAPABILITY_NOT_FOUND: false,
  BRIDGE_CAPABILITY_CONFLICT: false,
  BRIDGE_INVALID_SCHEMA: false,
  BRIDGE_PERMISSION_DENIED: false,
  BRIDGE_INVALID_INPUT: false,
  BRIDGE_TIMEOUT: true,
  BRIDGE_CANCELLED: false,
  BRIDGE_SESSION_UNKNOWN: false,
  BRIDGE_SESSION_BUSY: true,
  BRIDGE_QUEUE_OVERFLOW: true,
  BRIDGE_INTERNAL: false,
};

/** 面向用户的简体中文文案（不暴露堆栈与内部路径）。 */
export const BRIDGE_ERROR_MESSAGES: Readonly<Record<BridgeErrorCode, string>> = {
  BRIDGE_CAPABILITY_NOT_FOUND: '能力不存在或已注销',
  BRIDGE_CAPABILITY_CONFLICT: '能力注册冲突',
  BRIDGE_INVALID_SCHEMA: '能力输入类型定义不合法',
  BRIDGE_PERMISSION_DENIED: '插件缺少所需权限',
  BRIDGE_INVALID_INPUT: '能力输入不合法',
  BRIDGE_TIMEOUT: '能力调用超时',
  BRIDGE_CANCELLED: '能力调用已取消',
  BRIDGE_SESSION_UNKNOWN: '会话不存在或已关闭',
  BRIDGE_SESSION_BUSY: '会话在途调用过多，请稍后重试',
  BRIDGE_QUEUE_OVERFLOW: '能力调用排队已满，请稍后重试',
  BRIDGE_INTERNAL: '平台内部错误',
};

/**
 * 权限拒绝错误码运行时常量表（08-权限系统设计 §9.1 的 `PERMISSION_*` 域；注册期两码另见 04-能力契约规范 §4.2）。
 *
 * @remarks 与 `@chips/bridge` 同名常量逐项一致；壳侧只消费注册期两码与运行时判定文案，不新增前缀。
 */
export const PERMISSION_ERROR_CODES = {
  notDeclared: 'PERMISSION_NOT_DECLARED',
  unknown: 'PERMISSION_UNKNOWN',
  invalid: 'PERMISSION_INVALID',
  roleNotAllowed: 'PERMISSION_ROLE_NOT_ALLOWED',
} as const;

/** 权限域错误码联合类型。 */
export type PermissionErrorCode = (typeof PERMISSION_ERROR_CODES)[keyof typeof PERMISSION_ERROR_CODES];

/** 构造通道级错误的可选项。 */
export interface BridgeErrorOptions {
  /** 覆盖默认文案（仍为简体中文）。 */
  readonly message?: string;
  /** 结构化诊断；不含输入原文、凭证与内部路径。 */
  readonly details?: unknown;
  /** 覆盖默认 `retryable` 口径。 */
  readonly retryable?: boolean;
}

/**
 * 按通道级错误码构造 `IWireChipsError`（缺省取错误码表文案与 `retryable` 口径）。
 *
 * @param code 通道级错误码。
 * @param options 覆盖项。
 * @returns 结构化克隆兼容的错误对象。
 */
export function bridgeWireError(code: BridgeErrorCode, options: BridgeErrorOptions = {}): IWireChipsError {
  const error: IWireChipsError = {
    code,
    message: options.message ?? BRIDGE_ERROR_MESSAGES[code],
    retryable: options.retryable ?? BRIDGE_ERROR_RETRYABLE[code],
  };
  return options.details === undefined ? error : { ...error, details: options.details };
}

/** 权限错误的可选项。 */
export interface PermissionErrorOptions {
  /** 覆盖默认文案。 */
  readonly message?: string;
  /** 结构化诊断（`IPermissionDeniedDetails` 同构）。 */
  readonly details?: unknown;
}

/**
 * 构造权限域错误的 `IWireChipsError`（注册期与运行时权限拒绝共用；`retryable` 恒为 `false`）。
 *
 * @param code 权限域错误码。
 * @param options 覆盖项。
 */
export function permissionWireError(code: PermissionErrorCode, options: PermissionErrorOptions = {}): IWireChipsError {
  return {
    code,
    message: options.message ?? '权限校验未通过',
    retryable: false,
    ...(options.details === undefined ? {} : { details: options.details }),
  };
}
