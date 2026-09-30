/**
 * HTML 转图片服务：错误面。
 *
 * 统一错误模型为 ChipsError（@chips/bridge 源定义、@chips/sdk 再导出）；
 * 码族为已登记的 CONVERTER_*（04-能力契约规范 §8.6）与通道码 BRIDGE_CANCELLED /
 * BRIDGE_TIMEOUT（§11.3），不新增错误码、不新增前缀。
 * message 一律简体中文；details 只携带结构化诊断，不含输入原文与内部路径。
 */

import { ChipsError } from '@chips/sdk';

import type { IConverterWarning } from './types.js';

/** 输入不支持：形状非法、字段越界、来源超限、资源路径非法。 */
export const CONVERTER_INPUT_UNSUPPORTED = 'CONVERTER_INPUT_UNSUPPORTED';

/** 渲染承载失败：引擎结果无效、空数据、尺寸非法或渲染承载未接入。 */
export const CONVERTER_RENDER_FAILED = 'CONVERTER_RENDER_FAILED';

/** 产物超出上限：输出字节或页数超限。 */
export const CONVERTER_OUTPUT_TOO_LARGE = 'CONVERTER_OUTPUT_TOO_LARGE';

/** 调用方取消（04-能力契约规范 §11.3 通道码）。 */
export const BRIDGE_CANCELLED = 'BRIDGE_CANCELLED';

/** 渲染承载超时（04-能力契约规范 §11.3 通道码）。 */
export const BRIDGE_TIMEOUT = 'BRIDGE_TIMEOUT';

/** 结构化诊断：只允许标量值。 */
export type ConverterErrorDetails = Record<string, string | number | boolean>;

/** 渲染承载未接入（宿主渲染承载归属波次在册缺位）的 details.reason 值。 */
export const RENDER_CARRIER_UNBOUND = 'RENDER_CARRIER_UNBOUND';

export function inputUnsupported(
  message: string,
  details?: ConverterErrorDetails
): ChipsError {
  return new ChipsError({
    code: CONVERTER_INPUT_UNSUPPORTED,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

export function renderFailed(message: string, details?: ConverterErrorDetails): ChipsError {
  return new ChipsError({
    code: CONVERTER_RENDER_FAILED,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

export function outputTooLarge(message: string, details?: ConverterErrorDetails): ChipsError {
  return new ChipsError({
    code: CONVERTER_OUTPUT_TOO_LARGE,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

export function cancelled(message: string, details?: ConverterErrorDetails): ChipsError {
  return new ChipsError({
    code: BRIDGE_CANCELLED,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

/** 结构守卫：判定任意抛出值是否为带 code 的 ChipsError 同构值。 */
export function isChipsErrorLike(value: unknown): value is ChipsError {
  return value instanceof ChipsError;
}

/**
 * 渲染承载错误归一：ChipsError 原样透传（含 BRIDGE_CANCELLED / BRIDGE_TIMEOUT），
 * 其余异常归一为 CONVERTER_RENDER_FAILED，不吞错、不降级。
 */
export function normalizeEngineError(error: unknown, engineId: string): ChipsError {
  if (isChipsErrorLike(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return renderFailed('渲染承载在执行过程中失败。', {
    engine: engineId,
    cause: message.slice(0, 200),
  });
}

/** 构造警告对象。 */
export function warning(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>
): IConverterWarning {
  return { code, message, ...(details ? { details } : {}) };
}
