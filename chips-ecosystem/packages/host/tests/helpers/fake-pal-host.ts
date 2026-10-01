/**
 * PAL 宿主替身（仅测试代码）。
 *
 * @remarks 只提供壳自检需要的一致性形状：`storage` 端口存在、矩阵分面全为 `false`。
 */

import type { IPalCapabilityMatrix, IPalHost, IPalPorts, IShellInfo } from '../../src/platform/contracts/index.js';
import type { IPalStoragePort } from '../../src/platform/contracts/index.js';

/** 全 `false` 能力矩阵。 */
export const EMPTY_MATRIX: IPalCapabilityMatrix = {
  window: false,
  dialog: false,
  notification: false,
  clipboard: false,
  menu: false,
  tray: false,
  shortcut: false,
  power: false,
  systemInfo: false,
  transfer: false,
  shellOpen: false,
  http: false,
};

/** 壳信息替身。 */
export const FAKE_SHELL_INFO: IShellInfo = {
  shell: 'desktop',
  platform: 'macos',
  osVersion: '15.0',
  arch: 'arm64',
  appVersion: '0.1.0',
  locale: 'zh-CN',
  paths: { userData: '/Users/tester/Library/Application Support/Chips' },
};

/**
 * 构造 PAL 宿主替身。
 *
 * @param overrides 覆盖字段（如矩阵与对应端口；`dispose` 用于验证退出收口）。
 */
export function createFakePalHost(
  overrides: Partial<IPalHost> & { dispose?: () => void } = {},
): IPalHost & { dispose?: () => void } {
  const ports = { storage: {} as IPalStoragePort } as Partial<IPalPorts>;
  return {
    info: FAKE_SHELL_INFO,
    matrix: EMPTY_MATRIX,
    ports: ports as IPalPorts,
    ...overrides,
  };
}

/**
 * 以必备 `storage` 端口为底、按需附加分面端口，构造完整 `IPalPorts`。
 *
 * @remarks 供测试注入替身端口时免手工 `as` 断言（`IPalPorts` 的可选分面经此收敛为全量形状）。
 */
export function createFakePorts(overrides: Partial<IPalPorts> = {}): IPalPorts {
  return { storage: {} as IPalStoragePort, ...overrides };
}
