/**
 * 宿主发行布局 `userData` 根的 CLI 侧装配解析（《17-CLI承载链路契约》§2.2、立项评估 Q2 裁定）。
 *
 * 工单039 波 3 挂账①落点：CLI 生产形态（独立 `chips` bin）取得 `userdataRoot` 的正式装配路径。
 * 口径逐字对照：
 * - §2.2 把「跨平台 `userData` 布局推导规则」的字段级唯一权威冻结在《17》本文档
 *   （darwin `~/Library/Application Support/Chips`；linux `$XDG_CONFIG_HOME`（未设置 `~/.config`）`/Chips`；
 *   win32 `%APPDATA%\Chips`；宿主应用名取发行配置 `productName: Chips`，02.06 §6.1）；
 * - 本模块是该**文档冻结布局**在 CLI 包内的唯一实现点（不散落、不第二份）：端点派生仍恒经
 *   `@chips/bridge` `deriveCarrierEndpoints`（§2.2 单一派生源条款），本模块只产出其入参根；
 * - 宿主显式 `setPath('userData', …)` 覆写时 CLI 按 §2.6 覆盖面（`CHIPS_CARRIER_SOCKET` +
 *   发现文件按宿主真实根投放）对接，本模块不做任何猜测式派生（§5.2-5 禁借道/禁猜装载位置的同族口径）。
 */

import { homedir } from 'node:os';
import path from 'node:path';

/** 宿主发行配置 `productName`（《02-构建与打包》§6.1，经《17》§2.2 冻结为布局唯一应用名）。 */
export const HOST_PRODUCT_NAME = 'Chips';

/**
 * 按 §2.2 布局解析 CLI 生产形态的 `userData` 根。
 *
 * @param platform 平台标识（缺省 `process.platform`，测试注入 win32/linux 分支）。
 * @param env 环境变量视图（缺省 `process.env`；`HOME`/`XDG_CONFIG_HOME`/`APPDATA` 按平台消费）。
 * @returns `userData` 根绝对路径；平台必需环境根缺失时返回 `null`（调用方按无承载定性收口，
 *          禁止伪造默认值——§5.4「发现文件缺失」同定性）。
 */
export function resolveDefaultUserdataRoot(
  platform: NodeJS.Platform = process.platform,
  env: Readonly<Record<string, string | undefined>> = process.env
): string | null {
  if (platform === 'win32') {
    const appData = env['APPDATA'];
    if (typeof appData === 'string' && appData.length > 0) {
      return path.win32.join(appData, HOST_PRODUCT_NAME);
    }
    return null;
  }
  const home = nonEmpty(env['HOME']) ?? nonEmpty(homedirSafe());
  if (home === null) {
    return null;
  }
  if (platform === 'darwin') {
    return path.posix.join(home, 'Library', 'Application Support', HOST_PRODUCT_NAME);
  }
  const xdg = nonEmpty(env['XDG_CONFIG_HOME']);
  if (xdg !== null) {
    return path.posix.join(xdg, HOST_PRODUCT_NAME);
  }
  return path.posix.join(home, '.config', HOST_PRODUCT_NAME);
}

function nonEmpty(value: string | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function homedirSafe(): string | undefined {
  try {
    return homedir();
  } catch {
    return undefined;
  }
}
