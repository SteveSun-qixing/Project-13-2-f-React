/**
 * 错误断言辅助（02-SDK-API规范 §7.2「assertChipsError」行、§11 约束 6）。
 *
 * 断言只按 `code` 分支，禁止匹配 `message` 文本；失败消息里同时给出期望与实际的错误码，
 * 便于用 `code` 直接定位。
 */

import { isChipsError } from '../errors.js';
import type { ChipsError } from '../errors.js';

/**
 * 描述非 `ChipsError` 值的形状，供失败消息定位。
 *
 * @param value - 待描述的值
 * @returns 面向中文报错的值描述
 */
function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const code = 'code' in record ? String(record['code']) : '缺失';
    const message = 'message' in record ? String(record['message']) : '缺失';
    return `结构不完整的对象（code=${code}，message=${message}）`;
  }
  // 走到这里 value 一定是原始类型；以 unknown 视角文本化，规避对可能被对象化的静态判定的误报
  const primitive: unknown = value;
  return `${typeof value}（${String(primitive)}）`;
}

/**
 * 断言值是一个 `ChipsError`；可选校验错误码。
 *
 * @param error - 待断言的值
 * @param expectedCode - 期望的错误码；省略时只断言结构
 * @throws Error 值不是 `ChipsError`，或 `code` 与期望不一致；消息包含期望与实际错误码
 */
export function assertChipsError(
  error: unknown,
  expectedCode?: string,
): asserts error is ChipsError {
  if (!isChipsError(error)) {
    throw new Error(`断言失败：期望 ChipsError，实际为 ${describeValue(error)}`);
  }
  if (expectedCode !== undefined && error.code !== expectedCode) {
    throw new Error(`断言失败：期望错误码 ${expectedCode}，实际错误码 ${error.code}`);
  }
}
