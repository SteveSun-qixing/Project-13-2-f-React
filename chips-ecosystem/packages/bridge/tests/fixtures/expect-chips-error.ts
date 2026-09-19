/**
 * 测试夹具：`ChipsError` 错误码断言辅助（不进入覆盖率统计，仅供单测与集成测试使用）。
 *
 * 背景：vitest 3.2 类型定义中 `expect.objectContaining` 返回值为 `any`，而
 * `toThrowError` 形参类型为 `string | RegExp | Error | Constructable`，非对称匹配器
 * 会把 `any` 引入断言实参位。这里显式接住抛出的 `ChipsError`
 * （02-Bridge三层设计 §9.1：通道错误一律归一为 `ChipsError`）并返回错误码，
 * 测试侧以 `expect(thrownErrorCode(action)).toBe(code)` 做等价且类型安全的断言。
 */

import { ChipsError } from '../../src/protocol/errors.js';

/**
 * 执行动作并返回其同步抛出的 `ChipsError` 错误码。
 *
 * 动作正常完成或抛出非 `ChipsError` 异常时，测试直接失败（等价于原
 * `toThrowError(expect.objectContaining({ code }))` 在未抛出/形状不符时的判定）。
 */
export function thrownErrorCode(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (ChipsError.isChipsError(error)) {
      return error.code;
    }
    throw error;
  }
  throw new Error('期望抛出 ChipsError 的动作正常完成，未抛出任何错误');
}
