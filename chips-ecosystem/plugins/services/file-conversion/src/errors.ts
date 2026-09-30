/**
 * 文件转换编排服务：错误面。
 *
 * 统一错误模型为 ChipsError（@chips/bridge 源定义、@chips/sdk 再导出）；
 * 码族只用 `@chips/sdk` 生成词表在册的 CONVERTER_* 三码（04-能力契约规范 §8.6）与
 * 通道码 BRIDGE_CANCELLED（§11.3），不新增错误码、不新增前缀。
 *
 * 词表缺口（如实登记，不在本包私造）：旧面的 CONVERTER_INPUT_INVALID /
 * CONVERTER_OUTPUT_EXISTS / CONVERTER_JOB_CANCELLED / CONVERTER_PIPELINE_* /
 * CONVERTER_OUTPUT_COMMIT_FAILED 均不在在册词表内，分别按 cardtohtml 判例归一为
 * CONVERTER_INPUT_UNSUPPORTED + `details.reason`、按 htmltopdf 判例归一为
 * BRIDGE_CANCELLED；平台 FILE_* 等在册 ChipsError 按同族口径原样透传。
 * message 一律简体中文；details 只携带结构化诊断，不含输入原文与内部路径。
 */

import { ChipsError, isChipsError } from '@chips/sdk';

/** 在册 CONVERTER_* 错误码（04-能力契约规范 §8.6；与 `@chips/sdk` 生成词表一致）。 */
export const REGISTERED_CONVERTER_ERROR_CODES = [
  'CONVERTER_INPUT_UNSUPPORTED',
  'CONVERTER_RENDER_FAILED',
  'CONVERTER_OUTPUT_TOO_LARGE',
] as const;

export type RegisteredConverterErrorCode = (typeof REGISTERED_CONVERTER_ERROR_CODES)[number];

/** 通道码：调用方取消（04-能力契约规范 §11.3）。 */
export const BRIDGE_CANCELLED = 'BRIDGE_CANCELLED';

/** 在册码：输入不支持/不合法（含输出冲突、来源缺失等宿主依赖域拒绝）。 */
export const CONVERTER_INPUT_UNSUPPORTED = 'CONVERTER_INPUT_UNSUPPORTED';
/** 在册码：渲染/链路腿失败（兄弟服务结果无效、产物缺失、空输出）。 */
export const CONVERTER_RENDER_FAILED = 'CONVERTER_RENDER_FAILED';
/** 在册码：产物超出上限（透传提供方族同码）。 */
export const CONVERTER_OUTPUT_TOO_LARGE = 'CONVERTER_OUTPUT_TOO_LARGE';

/** 结构化诊断：details.reason 固定为词法化短语，其余只允许标量值。 */
export type ConverterErrorDetails = Record<string, string | number | boolean>;

/** details.reason 词表（在册词表缺口的 reason 收口口径，逐值在册于契约测试）。 */
export const INPUT_UNSUPPORTED_REASONS = {
  inputNotObject: 'input-not-object',
  sourceRequired: 'source-required',
  targetRequired: 'target-required',
  outputRequired: 'output-required',
  sourceTypeUnsupported: 'source-type-unsupported',
  targetTypeUnsupported: 'target-type-unsupported',
  sourcePathRequired: 'source-path-required',
  outputPathRequired: 'output-path-required',
  htmlToHtmlUnsupported: 'html-to-html-unsupported',
  packageModeUnsupported: 'package-mode-unsupported',
  htmlSourceRequired: 'html-source-required',
  pipelineNotFound: 'pipeline-not-found',
  sourceNotFound: 'source-not-found',
  outputExists: 'output-exists',
  outputPathRoot: 'output-path-root',
} as const;

export const RENDER_FAILED_REASONS = {
  invalidRenderOutput: 'invalid-render-output',
  emptyRenderOutput: 'empty-render-output',
  artifactMissing: 'artifact-missing',
  siblingFailed: 'sibling-failed',
} as const;

/** 宿主文件域在册码：目标不存在（来源存在性探测的判定锚点）。 */
export const FILE_NOT_FOUND_CODE = 'FILE_NOT_FOUND';

/** 按在册码构造 ChipsError；`message` 一律简体中文。 */
export function createConverterError(
  code: RegisteredConverterErrorCode,
  message: string,
  details?: ConverterErrorDetails
): ChipsError {
  return new ChipsError({
    code,
    message,
    retryable: false,
    ...(details !== undefined ? { details } : {}),
  });
}

/** 输入不支持/不合法的便捷构造（reason 必带，收口在册词表缺口）。 */
export function inputUnsupported(
  message: string,
  reason: string,
  extra?: ConverterErrorDetails
): ChipsError {
  return createConverterError(CONVERTER_INPUT_UNSUPPORTED, message, { reason, ...extra });
}

/** 链路腿/渲染失败的便捷构造。 */
export function renderFailed(message: string, details?: ConverterErrorDetails): ChipsError {
  return createConverterError(CONVERTER_RENDER_FAILED, message, details);
}

/** 调用方取消（通道码，htmltopdf 判例口径）。 */
export function cancelled(message: string, details?: ConverterErrorDetails): ChipsError {
  return new ChipsError({
    code: BRIDGE_CANCELLED,
    message,
    retryable: false,
    ...(details !== undefined ? { details } : {}),
  });
}

/** 结构守卫：判定抛出值是否为 ChipsError。 */
export function isChipsErrorLike(value: unknown): value is ChipsError {
  return isChipsError(value);
}

/** 判定错误是否为指定码的 ChipsError（按 `code` 分支，禁匹配 message 文本）。 */
export function hasChipsErrorCode(error: unknown, code: string): boolean {
  return isChipsError(error) && error.code === code;
}
