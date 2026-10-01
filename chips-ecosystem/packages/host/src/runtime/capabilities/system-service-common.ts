/**
 * 系统服务族能力域（dialog / clipboard / notification / shell）共享支撑面。
 *
 * 权威：`04-能力契约规范` §5.4（校验错误详情）、§6.3（角色适用性）、§7.5～§7.8（逐项契约）、
 * `02-Bridge三层设计` §5.2（Schema 准入与错误归一）、§9.1，`08-权限系统设计` §7.2；
 * `17-跨端Shell与平台抽象设计` §4.2 规则 2（端口调用上下文）、§5.1/§5.2（分面闸）。
 *
 * @remarks
 * - 壳侧路由在 Bridge 内核交付前只做顶层 `required` 存在性准入（`runtime/capability/router.ts`），
 *   契约声明的深度校验由各域入口承担：`unknown` 输入必须确定性拒绝（`BRIDGE_INVALID_INPUT`），
 *   不得猜测——与 `capabilities/document/validation.ts` 的守卫职责同构。
 * - `BRIDGE_INVALID_INPUT` 的 `details` 采用 §5.4 的精简形态：`capabilityId` + `reason`，
 *   不含输入原文与内部路径。
 * - 端口错误（`PalPortError`，已登记域码 + `retryable` 口径）由端口面归一，处理器原样透传；
 *   其余未识别异常由路由 `toWireError` 归一为 `BRIDGE_INTERNAL`，本层不重复造第二套错误模型。
 */

import type { PortCallContext } from '../../platform/contracts/index.js';
import {
  PAL_FACET_PORT_KEYS,
  type IPalCapabilityMatrix,
  type IPalPorts,
  type PalFacet,
} from '../../platform/contracts/index.js';
import type { IHostCapabilityContext } from '../capability/contracts.js';

/** 通道级输入校验错误码（`02-Bridge三层设计` §9.2）。 */
export const SYSTEM_SERVICE_INVALID_INPUT = 'BRIDGE_INVALID_INPUT';

/** `BRIDGE_INVALID_INPUT` 的错误形状（与 `ChipsError` 同构；`details` 为 §5.4 精简形态）。 */
export type ISystemServiceInputError = Error & {
  readonly code: typeof SYSTEM_SERVICE_INVALID_INPUT;
  readonly details: Readonly<{ readonly capabilityId: string; readonly reason: string }>;
  readonly retryable: false;
};

/** 构造 `BRIDGE_INVALID_INPUT`（确定性拒绝意图，由调用点 `throw` 表达）。 */
export function systemServiceInputError(capabilityId: string, reason: string): ISystemServiceInputError {
  const error = new Error('能力输入不合法') as ISystemServiceInputError;
  return Object.assign(error, {
    code: SYSTEM_SERVICE_INVALID_INPUT,
    details: { capabilityId, reason },
    retryable: false as const,
  });
}

/** 判断值为普通对象（非数组、非 `null`）。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 读取输入对象：非对象拒绝；未声明字段拒绝（契约 schema 一律 `additionalProperties: false`，
 * `04-能力契约规范` §6.3）。
 */
export function readInputRecord(
  capabilityId: string,
  input: unknown,
  allowedFields: readonly string[],
): Record<string, unknown> {
  if (!isPlainRecord(input)) {
    throw systemServiceInputError(capabilityId, 'input 必须是对象');
  }
  for (const key of Object.keys(input)) {
    if (!allowedFields.includes(key)) {
      throw systemServiceInputError(capabilityId, `不支持的输入字段：${key}`);
    }
  }
  return input;
}

/** 读取必填字符串字段（存在性由路由顶层准入把守，此处把关类型与约束）。 */
export function requireStringField(
  capabilityId: string,
  record: Record<string, unknown>,
  field: string,
  constraints: { readonly minLength?: number; readonly maxLength?: number } = {},
): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw systemServiceInputError(capabilityId, `${field} 必须是字符串`);
  }
  if (constraints.minLength !== undefined && value.length < constraints.minLength) {
    throw systemServiceInputError(capabilityId, `${field} 长度不得少于 ${constraints.minLength}`);
  }
  if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
    throw systemServiceInputError(capabilityId, `${field} 长度不得超过 ${constraints.maxLength}`);
  }
  return value;
}

/** 读取可选字符串字段（缺省返回 `null`；存在即校验类型与约束）。 */
export function optionalStringField(
  capabilityId: string,
  record: Record<string, unknown>,
  field: string,
  constraints: { readonly minLength?: number; readonly maxLength?: number } = {},
): string | null {
  const value = record[field];
  if (value === undefined) {
    return null;
  }
  return requireStringField(capabilityId, record, field, constraints);
}

/** 读取可选布尔字段（缺省返回 `null`；存在即必须为布尔）。 */
export function optionalBooleanField(
  capabilityId: string,
  record: Record<string, unknown>,
  field: string,
): boolean | null {
  const value = record[field];
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'boolean') {
    throw systemServiceInputError(capabilityId, `${field} 必须是布尔值`);
  }
  return value;
}

/** 读取必填布尔字段（存在性由路由顶层准入把守，此处把关类型）。 */
export function requireBooleanField(capabilityId: string, record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value !== 'boolean') {
    throw systemServiceInputError(capabilityId, `${field} 必须是布尔值`);
  }
  return value;
}

/** 读取必填且必须命中文法的字符串字段（契约 schema `pattern` 逐字对齐）。 */
export function patternStringField(
  capabilityId: string,
  record: Record<string, unknown>,
  field: string,
  pattern: RegExp,
  reason: string,
  constraints: { readonly maxLength?: number } = {},
): string {
  const value = requireStringField(capabilityId, record, field, constraints);
  if (!pattern.test(value)) {
    throw systemServiceInputError(capabilityId, reason);
  }
  return value;
}

/** 读取可选且必须命中文法的字符串字段（缺省返回 `null`）。 */
export function optionalPatternStringField(
  capabilityId: string,
  record: Record<string, unknown>,
  field: string,
  pattern: RegExp,
  reason: string,
  constraints: { readonly maxLength?: number } = {},
): string | null {
  if (record[field] === undefined) {
    return null;
  }
  return patternStringField(capabilityId, record, field, pattern, reason, constraints);
}

/** 读取必填枚举字符串字段（契约 schema `enum` 逐字对齐）。 */
export function enumStringField<T extends string>(
  capabilityId: string,
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T {
  const value = requireStringField(capabilityId, record, field);
  if (!(allowed as readonly string[]).includes(value)) {
    throw systemServiceInputError(capabilityId, `${field} 必须是 ${allowed.join(' / ')}`);
  }
  return value as T;
}

/**
 * 读取必填 JSON 值字段（契约 schema `type: ['object','array','string','number','boolean','null']`）。
 *
 * @remarks 顶层类型在此闸（`BRIDGE_INVALID_INPUT`）；嵌套成员的可序列化性归存储/端口域校验
 * （如配置值落盘前的 `CONFIG_VALUE_INVALID`），本层不复制第二套深度检查。
 */
export function jsonValueField(capabilityId: string, record: Record<string, unknown>, field: string): unknown {
  const value = record[field];
  if (value === null) {
    return value;
  }
  if (
    typeof value !== 'object' &&
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    throw systemServiceInputError(capabilityId, `${field} 必须是 JSON 值`);
  }
  return value;
}

/**
 * 判断分面是否就绪（17 §5.2 分面闸）：矩阵声明可用且端口实现存在。
 *
 * @remarks 分面缺位时对应能力域整体不注册，调用得到真实注册表未命中
 * （`BRIDGE_CAPABILITY_NOT_FOUND`）；分面在册而环境不可用时仍注册，
 * 由端口返回正式域错误码——两态语义由 {@link isFacetReady} 的单一判据区分。
 */
export function isFacetReady(hostMatrix: IPalCapabilityMatrix, ports: IPalPorts, facet: PalFacet): boolean {
  return hostMatrix[facet] === true && ports[PAL_FACET_PORT_KEYS[facet]] !== undefined;
}

/** 壳侧能力上下文 → 端口调用上下文（字段同名同义，如实映射，§4.2 规则 2）。 */
export function toPortCall(ctx: IHostCapabilityContext): PortCallContext {
  return { signal: ctx.signal, deadline: ctx.deadline };
}
