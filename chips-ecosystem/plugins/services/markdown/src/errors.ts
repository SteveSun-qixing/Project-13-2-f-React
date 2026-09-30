/**
 * 错误面：全生态唯一错误类 `ChipsError`（工单024 裁定），本服务只复用既有词表，
 * 不新增错误码（任务红线）。取词口径：
 *
 * - `BRIDGE_INVALID_INPUT`：输入形状或长度不合法（入口校验收口，语义同 Bridge「能力输入不合法」）；
 * - `BRIDGE_CANCELLED`：调用方经 `AbortSignal` 取消；
 * - `BRIDGE_INTERNAL`：解析内核抛出非预期异常（输入已过校验后仍失败的兜底）。
 *
 * `message` 一律简体中文、面向用户；`details` 只承载结构化诊断（长度数字等），
 * 不含输入原文、堆栈与内部路径（《04-能力契约规范》§8.6 口径）。
 */

import { ChipsError } from '@chips/sdk';

/** 构造输入不合法错误。 */
export function invalidInput(message: string, details?: Record<string, unknown>): ChipsError {
  return new ChipsError({
    code: 'BRIDGE_INVALID_INPUT',
    message,
    retryable: false,
    ...(details !== undefined ? { details } : {}),
  });
}

/** 构造调用取消错误。 */
export function cancelled(): ChipsError {
  return new ChipsError({
    code: 'BRIDGE_CANCELLED',
    message: 'Markdown 调用已取消',
    retryable: false,
  });
}

/** 构造解析内核非预期失败错误（不携带堆栈与输入原文）。 */
export function internalFailure(): ChipsError {
  return new ChipsError({
    code: 'BRIDGE_INTERNAL',
    message: 'Markdown 解析失败，请检查输入内容',
    retryable: false,
  });
}

/** 输入不合法错误码（既有词表引用面，供调用方按码分支复用）。 */
export const MARKDOWN_INPUT_ERROR_CODE = 'BRIDGE_INVALID_INPUT' as const;

/** 调用取消错误码。 */
export const MARKDOWN_CANCELLED_ERROR_CODE = 'BRIDGE_CANCELLED' as const;
