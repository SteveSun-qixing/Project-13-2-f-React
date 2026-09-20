/**
 * 客户端目标解析与转发的共用内核（02-SDK-API规范 §3.2 目标解析规则、§6.4 错误口径）。
 *
 * `ChipsBridge` 的方法面与 CLI 扩展命名空间共用这一条解析链路：目标不可用时 `request` 形态
 * 的调用一律以 `ChipsError`（`SDK_BRIDGE_UNAVAILABLE`）异步拒绝，平台返回的错误原样透传，
 * 不改写 `code` / `message` / `details` / `retryable`（§11 约束 6、8、12）。
 */

import { toChipsError } from '../errors.js';
import type { IChipsBridge } from '../types/bridge.js';

/**
 * 每次调用重新解析的目标 Bridge 取值函数。
 *
 * 由 `ChipsBridge` 注入 `() => this.#target()`：解析发生在调用时而非构造时，保证测试在
 * 构造之后安装 `window.chips` 也能即时生效（§3.2、§11 约束 8）。
 */
export type TargetResolver = () => IChipsBridge;

/**
 * 解析目标并把一次调用转发出去。
 *
 * @param resolveTarget - 目标解析函数
 * @param id - 能力 ID 或平台服务路由名
 * @param input - 调用输入；始终按两个实参转发，保持目标侧参数形状稳定
 * @returns 目标的调用结果；目标不可用或平台调用失败时以 `ChipsError` 拒绝
 */
export function invokeTarget<TOutput>(
  resolveTarget: TargetResolver,
  id: string,
  input: unknown
): Promise<TOutput> {
  let target: IChipsBridge;
  try {
    target = resolveTarget();
  } catch (error) {
    return Promise.reject(toChipsError(error));
  }
  return target.request<TOutput>(id, input);
}
