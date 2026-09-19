/**
 * Mock 使用的平台错误码与错误构造（02-SDK-API规范 §7.2）。
 *
 * Mock 只模拟调用结果，不做权限判定与 schema 校验（§7.1）；这里的错误码全部取自主入口
 * 转发的平台权威口径，与 `src/generated/error-codes.ts` 的一致性由 `codes.test.ts` 门禁
 * 核对，本模块不维护第二份错误码清单（§11 约束 5）。
 */

import { ChipsError } from '../errors.js';

/** Mock 会以 `ChipsError` 形式抛出的平台错误码。 */
export const MOCK_ERROR_CODES = {
  capabilityNotFound: 'BRIDGE_CAPABILITY_NOT_FOUND',
  invalidInput: 'BRIDGE_INVALID_INPUT',
  invalidUri: 'RESOURCE_INVALID_URI',
  notFound: 'RESOURCE_NOT_FOUND',
  handleReleased: 'RESOURCE_HANDLE_RELEASED',
  handleInvalidated: 'RESOURCE_HANDLE_INVALIDATED',
} as const;

/**
 * 构造 Mock 的 `ChipsError`。
 *
 * @param code - 错误码，取自 `MOCK_ERROR_CODES`
 * @param message - 简体中文、面向用户的文案
 * @param details - 结构化诊断；省略时不写入该字段
 * @returns 供拒绝或抛出的 `ChipsError`
 */
export function mockError(code: string, message: string, details?: unknown): ChipsError {
  return new ChipsError({
    code,
    message,
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}
