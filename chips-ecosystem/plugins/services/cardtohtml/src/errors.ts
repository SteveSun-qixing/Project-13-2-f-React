/**
 * 错误面：统一 `ChipsError`，错误码只用既有 `CONVERTER_*` 词表（04-能力契约规范 §8.6、
 * `@chips/sdk` 生成 `error-codes.ts` 在册三码），禁新增错误码、禁占用
 * `BRIDGE_*` / `FILE_*` / `RESOURCE_*` / `DOCUMENT_*` 前缀。
 *
 * 词表缺口（如实登记，不在本包私造）：`CONVERTER_OUTPUT_EXISTS` 不在在册词表内，
 * 「输出已存在且未请求覆盖」暂以 `CONVERTER_INPUT_UNSUPPORTED` + `details.reason`
 * 表达，候登记维护流程扩码。
 */

import { ChipsError, isChipsError } from '@chips/sdk';

/** `CONVERTER_*` 在册错误码（04-能力契约规范 §8.6 代表性码；与生成词表一致）。 */
export const CONVERTER_ERROR_CODES = {
  inputUnsupported: 'CONVERTER_INPUT_UNSUPPORTED',
  renderFailed: 'CONVERTER_RENDER_FAILED',
  outputTooLarge: 'CONVERTER_OUTPUT_TOO_LARGE',
} as const;

export type ConverterErrorCode = (typeof CONVERTER_ERROR_CODES)[keyof typeof CONVERTER_ERROR_CODES];

/** 按在册码构造 `ChipsError`；`message` 一律简体中文。 */
export function createConverterError(
  code: ConverterErrorCode,
  message: string,
  details?: unknown
): ChipsError {
  return new ChipsError({
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  });
}

/** 输入不支持/不合法的便捷构造（含输出冲突与未就绪的宿主依赖域拒绝）。 */
export function createInputUnsupportedError(message: string, reason: string): ChipsError {
  return createConverterError(CONVERTER_ERROR_CODES.inputUnsupported, message, { reason });
}

/** 模型切片收窄/HTML 生成失败的便捷构造。 */
export function createRenderFailedError(message: string, details?: unknown): ChipsError {
  return createConverterError(CONVERTER_ERROR_CODES.renderFailed, message, details);
}

/** 判定错误是否为指定码的 `ChipsError`（按 `code` 分支，禁匹配 message 文本）。 */
export function hasChipsErrorCode(error: unknown, code: string): boolean {
  return isChipsError(error) && error.code === code;
}

/** 文档节点不存在（宿主 `DOCUMENT_*` 域在册码，透传判定后转为节点级警告）。 */
export const DOCUMENT_NOT_FOUND_CODE = 'DOCUMENT_NOT_FOUND';

/** 宿主文件域在册码：目标不存在（复制缺失资源时按警告收口）。 */
export const FILE_NOT_FOUND_CODE = 'FILE_NOT_FOUND';
