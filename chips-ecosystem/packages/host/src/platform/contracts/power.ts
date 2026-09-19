import type { PortCallContext } from './call.js';

/** 系统空闲状态；与能力契约 `power:query` 一致。 */
export type PowerIdleState = 'active' | 'idle' | 'locked' | 'unknown';

/** 系统热状态；与能力契约 `power:query` 一致。 */
export type PowerThermalState = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

/** 电源状态快照；与能力契约 `power:query` 输出一致。 */
export interface PowerState {
  /** 是否由电池供电。 */
  readonly onBattery: boolean;
  /** 电量（0–1）；无电池或无法读取时为 `null`。 */
  readonly batteryLevel: number | null;
  /** 是否正在充电。 */
  readonly charging: boolean;
  /** 空闲状态。 */
  readonly idleState: PowerIdleState;
  /** 热状态。 */
  readonly thermalState: PowerThermalState;
}

/** 睡眠抑制选项。 */
export interface PreventSleepOptions extends PortCallContext {
  /** 审计说明；由能力层写入审计，端口不落日志。 */
  readonly reason?: string;
}

/**
 * 电源端口；方法与非插件可见的 `power:*` 能力动作一一对应。
 *
 * 权威：`04-能力契约规范` §7.14。
 *
 * @remarks
 * - 读取失败返回 `POWER_INFO_UNAVAILABLE`；设置失败返回 `POWER_PREVENT_SLEEP_FAILED`。
 * - 端口维护单一抑制句柄；按会话引用计数与自动释放由能力层完成，端口只接受最终开关状态。
 */
export interface IPalPowerPort {
  /** 查询电源状态。 */
  query(call?: PortCallContext): Promise<PowerState>;
  /** 开启/关闭睡眠抑制。 */
  setPreventSleep(enabled: boolean, options?: PreventSleepOptions): Promise<void>;
}
