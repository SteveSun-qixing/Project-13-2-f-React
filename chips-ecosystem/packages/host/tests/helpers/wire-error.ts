/**
 * 线协议错误抛出值构造器（仅测试代码）。
 *
 * @remarks
 * - 用途：为 `IResourceBackend` / `IPlatformIpcEndpoint` 等替身提供"抛出即失败"的错误值，
 *   形状与 `src/runtime/self-check-runtime.ts` 的 `resourceError` 工厂逐字段一致。
 * - `only-throw-error` 要求抛出真 `Error`；宿主侧 `asWireError` / `toWireError` 只按
 *   `code` / `message` / `retryable` 结构消费抛出值，本工厂产出的 `Error` 实例携带同名可枚举属性，
 *   归一后的线协议输出与原来的普通对象完全一致。
 */

/** 携带线协议错误码的可抛出错误。 */
export type ThrownWireError = Error & { code: string; retryable: boolean };

/**
 * 构造与线协议错误同构的可抛出 `Error`。
 *
 * @param code 已登记错误码（`<DOMAIN>_<REASON>`）。
 * @param message 面向用户的简体中文消息。
 * @param retryable 是否可重试；缺省 `false`。
 */
export function createWireError(code: string, message: string, retryable = false): ThrownWireError {
  return Object.assign(new Error(message), { code, retryable });
}
