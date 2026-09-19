import type { IPalPowerPort, PortCallContext, PowerState, PreventSleepOptions } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type { ElectronPowerMonitorLike, ElectronPowerSaveBlockerLike } from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';
import type { CommandRunner } from './command-runner.js';

/** `pmset -g batt` 解析结果。 */
export interface PmsetBatteryStatus {
  /** 电量（0–1）；无电池或无法解析时为 `null`。 */
  readonly batteryLevel: number | null;
  /** 是否正在充电；无法解析时为 `null`。 */
  readonly charging: boolean | null;
}

/** macOS 电源端口依赖。 */
export interface MacPowerPortDependencies {
  /** Electron `powerMonitor` 模块切片。 */
  readonly powerMonitor: ElectronPowerMonitorLike;
  /** Electron `powerSaveBlocker` 模块切片。 */
  readonly powerSaveBlocker: ElectronPowerSaveBlockerLike;
  /** 命令执行器；用于 `pmset -g batt`。 */
  readonly runCommand: CommandRunner;
}

/** 空闲判定阈值（秒）；`power:query` 无阈值输入，由壳固定。 */
const IDLE_THRESHOLD_SECONDS = 60;

/**
 * 解析 `pmset -g batt` 输出。
 *
 * @param output `pmset -g batt` 标准输出。
 * @returns 电量与充电状态；无电池行时均为 `null`。
 */
export function parsePmsetBatteryStatus(output: string): PmsetBatteryStatus {
  for (const line of output.split('\n')) {
    const percentageMatch = /(\d{1,3})%/.exec(line);
    if (percentageMatch?.[1] === undefined) {
      continue;
    }
    const level = Number.parseInt(percentageMatch[1], 10);
    if (!Number.isFinite(level) || level < 0 || level > 100) {
      continue;
    }
    const stateMatch = /;\s*([^;]+);/.exec(line);
    const state = (stateMatch?.[1] ?? '').toLowerCase();
    let charging: boolean | null = null;
    if (state.length > 0) {
      if (/not charging|discharging/.test(state)) {
        charging = false;
      } else if (/charg|ac attached|finishing/.test(state)) {
        charging = true;
      }
    }
    return { batteryLevel: level / 100, charging };
  }
  return { batteryLevel: null, charging: null };
}

/**
 * 创建 macOS 电源端口。
 *
 * 权威：`04-能力契约规范` §7.14。
 *
 * @param dependencies Electron 电源模块与命令执行器。
 * @returns `power:*` 端口实现。
 *
 * @remarks
 * - 电量与充电状态来自 `pmset -g batt`（Electron `powerMonitor` 不暴露电池电量）。
 * - 无电池或读取失败时 `batteryLevel` 为 `null`；充电状态解析失败时退化为"交流供电"语义。
 * - 读取失败返回 `POWER_INFO_UNAVAILABLE`，抑制设置失败返回 `POWER_PREVENT_SLEEP_FAILED`。
 */
export function createMacPowerPort(dependencies: MacPowerPortDependencies): IPalPowerPort {
  const { powerMonitor, powerSaveBlocker, runCommand } = dependencies;
  let blockerId: number | null = null;

  const stopBlocker = (): void => {
    if (blockerId === null) {
      return;
    }
    const current = blockerId;
    blockerId = null;
    try {
      if (powerSaveBlocker.isStarted(current)) {
        powerSaveBlocker.stop(current);
      }
    } catch {
      // 系统已释放抑制；保持幂等。
    }
  };

  return {
    async query(call?: PortCallContext): Promise<PowerState> {
      assertCallActive(call);
      let onBattery: boolean;
      let idleState: PowerState['idleState'];
      try {
        onBattery = powerMonitor.isOnBatteryPower();
        idleState = powerMonitor.getSystemIdleState(IDLE_THRESHOLD_SECONDS);
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.POWER_INFO_UNAVAILABLE, undefined, { cause: error });
      }

      const thermalState = powerMonitor.getCurrentThermalState?.() ?? 'unknown';
      const battery = await readBatteryStatus(runCommand);
      return {
        onBattery,
        batteryLevel: battery.batteryLevel,
        charging: battery.charging ?? !onBattery,
        idleState,
        thermalState,
      };
    },

    async setPreventSleep(enabled: boolean, options?: PreventSleepOptions): Promise<void> {
      assertCallActive(options);
      if (!enabled) {
        stopBlocker();
        return Promise.resolve();
      }
      if (blockerId !== null && safeIsStarted(powerSaveBlocker, blockerId)) {
        return Promise.resolve();
      }
      try {
        const id = powerSaveBlocker.start('prevent-app-suspension');
        if (!safeIsStarted(powerSaveBlocker, id)) {
          throw new Error('powerSaveBlocker did not start');
        }
        blockerId = id;
        return Promise.resolve();
      } catch (error) {
        blockerId = null;
        throw new PalPortError(PAL_ERROR_CODES.POWER_PREVENT_SLEEP_FAILED, undefined, { cause: error });
      }
    },
  };
}

/** 读取电池状态；命令失败时返回全 `null`（合法降级）。 */
async function readBatteryStatus(runCommand: CommandRunner): Promise<PmsetBatteryStatus> {
  try {
    const result = await runCommand.run('pmset', ['-g', 'batt']);
    return parsePmsetBatteryStatus(result.stdout);
  } catch {
    return { batteryLevel: null, charging: null };
  }
}

/** `isStarted` 查询；异常视为未生效。 */
function safeIsStarted(powerSaveBlocker: ElectronPowerSaveBlockerLike, id: number): boolean {
  try {
    return powerSaveBlocker.isStarted(id);
  } catch {
    return false;
  }
}
