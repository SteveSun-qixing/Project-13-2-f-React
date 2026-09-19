/**
 * 端口调用的取消与截止上下文。
 *
 * @remarks
 * 《17-跨端Shell与平台抽象设计》§4.2 规则 2：所有可能阻塞的端口方法都必须接收并响应
 * 取消与截止；调用方会话结束、能力注销或 Bridge 关闭时端口调用一并收口。
 */
export interface PortCallContext {
  /** 取消信号；触发后端口必须尽快中止底层操作并以 `BRIDGE_CANCELLED` 结束。 */
  readonly signal?: AbortSignal;
  /** 绝对截止时间（Unix 毫秒）；超过后端口必须中止并以 `BRIDGE_TIMEOUT` 结束。 */
  readonly deadline?: number;
}

/** 端口订阅句柄；释放后不再回调。 */
export interface PalSubscription {
  /** 释放订阅；幂等。 */
  dispose(): void;
}
