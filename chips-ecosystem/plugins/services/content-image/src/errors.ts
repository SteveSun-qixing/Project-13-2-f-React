/**
 * 取色能力（content-image.pick-colors）：错误面。
 *
 * 统一错误模型为 `ChipsError`（@chips/bridge 源定义、@chips/sdk 再导出，工单024 收口），
 * 取代旧模块自定义的 `ColorPickerError`。码族只使用 04-能力契约规范 §8.6 已登记的
 * `IMAGE_*` 与 §11.3 通道码 `BRIDGE_CANCELLED`，不自造前缀、不新增码。
 *
 * 旧 `COLOR_PICKER_*` 七码到新码的映射（逐码见下）：
 * | 旧码 | 新码 | 依据 |
 * | --- | --- | --- |
 * | `COLOR_PICKER_INPUT_INVALID` | `IMAGE_INPUT_UNSUPPORTED` | §8.6 代表性码 |
 * | `COLOR_PICKER_IMAGE_SAMPLE_UNSUPPORTED` | `IMAGE_INPUT_UNSUPPORTED` + `details.reason=FORMAT_UNSUPPORTED` | 同上 |
 * | `COLOR_PICKER_IMAGE_SAMPLE_FAILED` | `IMAGE_DECODE_FAILED` | 同上 |
 * | `COLOR_PICKER_IMAGE_SAMPLE_INVALID` | `IMAGE_DECODE_FAILED` + `details.reason=DECODED_SAMPLE_INVALID` | 同上 |
 * | `COLOR_PICKER_IMAGE_EMPTY` | `IMAGE_EMPTY` | 同上 |
 * | `COLOR_PICKER_ANALYSIS_FAILED` | `IMAGE_ANALYSIS_FAILED` | 同上 |
 * | `COLOR_PICKER_INPUT_NOT_FOUND` | 作废：原子操作不读写路径（§8.3 约束 1），
 *   「来源不存在」由消费方在 `resource:` / `file:` 域收口 | §8.3 约束 1 |
 * 取消臂旧码为 `COLOR_PICKER_ANALYSIS_FAILED`，新契约下归一为通道码 `BRIDGE_CANCELLED`。
 */

import { ChipsError } from '@chips/sdk';

/** 输入不支持：形状非法、字节为空、超过上限、格式不在解码端口支持矩阵内。 */
export const IMAGE_INPUT_UNSUPPORTED = 'IMAGE_INPUT_UNSUPPORTED';

/** 解码失败：解码端口报错、解码产物形状非法。 */
export const IMAGE_DECODE_FAILED = 'IMAGE_DECODE_FAILED';

/** 样本无可见像素：全透明或零权重像素。 */
export const IMAGE_EMPTY = 'IMAGE_EMPTY';

/** 分析失败：聚类初始化或产出不可用。 */
export const IMAGE_ANALYSIS_FAILED = 'IMAGE_ANALYSIS_FAILED';

/** 调用方取消（04-能力契约规范 §11.3 通道码）。 */
export const BRIDGE_CANCELLED = 'BRIDGE_CANCELLED';

/** 结构化诊断：只允许标量值，不含输入原文与内部路径（§8.6）。 */
export type ImageErrorDetails = Record<string, string | number | boolean>;

/** 图像字节 → RGBA 像素的解码供给未接入（在册缺位）的 `details.reason` 值。 */
export const PIXEL_SOURCE_UNBOUND = 'PIXEL_SOURCE_UNBOUND';

/** 解码产物形状非法的 `details.reason` 值。 */
export const DECODED_SAMPLE_INVALID = 'DECODED_SAMPLE_INVALID';

/** 格式不在解码端口支持矩阵内的 `details.reason` 值。 */
export const FORMAT_UNSUPPORTED = 'FORMAT_UNSUPPORTED';

/** 输入字节超限的 `details.reason` 值。 */
export const INPUT_TOO_LARGE = 'INPUT_TOO_LARGE';

export function inputUnsupported(message: string, details?: ImageErrorDetails): ChipsError {
  return new ChipsError({
    code: IMAGE_INPUT_UNSUPPORTED,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

export function decodeFailed(message: string, details?: ImageErrorDetails): ChipsError {
  return new ChipsError({
    code: IMAGE_DECODE_FAILED,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

export function emptyImage(message: string, details?: ImageErrorDetails): ChipsError {
  return new ChipsError({
    code: IMAGE_EMPTY,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

export function analysisFailed(message: string, details?: ImageErrorDetails): ChipsError {
  return new ChipsError({
    code: IMAGE_ANALYSIS_FAILED,
    message,
    retryable: false,
    ...(details ? { details } : {}),
  });
}

export function cancelled(message: string, details?: ImageErrorDetails): ChipsError {
  return new ChipsError({
    code: BRIDGE_CANCELLED,
    message,
    retryable: true,
    ...(details ? { details } : {}),
  });
}

/** 结构守卫：判定任意抛出值是否为 `ChipsError`。 */
export function isChipsErrorLike(value: unknown): value is ChipsError {
  return value instanceof ChipsError;
}

/**
 * 解码端口错误归一：`ChipsError` 原样透传（含取消与超时通道码），
 * 其余异常归一为 `IMAGE_DECODE_FAILED`；不吞错、不降级、不改写为成功。
 */
export function normalizeDecodeError(error: unknown, engineId: string): ChipsError {
  if (isChipsErrorLike(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return decodeFailed('图像解码端口在执行过程中失败。', {
    engine: engineId,
    cause: message.slice(0, 200),
  });
}
