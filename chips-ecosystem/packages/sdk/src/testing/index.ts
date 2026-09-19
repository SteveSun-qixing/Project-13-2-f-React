/**
 * `@chips/sdk/testing` 入口（02-SDK-API规范 §2.1、§2.2、§7）。
 *
 * 导出面固定为：`createMockBridge`、`installMockBridge`、`uninstallMockBridge`、
 * `assertChipsError`，以及 `IMockBridge`、`IMockBridgeOptions`、`IMockResourceInit`、
 * `IMockCall`（§2.2 末段）。本入口只供测试代码消费，不得出现在插件运行时依赖图中（§11 约束 4）。
 */

export { assertChipsError } from './assert-chips-error.js';
export { createMockBridge } from './mock-bridge.js';
export { installMockBridge, uninstallMockBridge } from './install-mock-bridge.js';
export type { IMockBridge, IMockBridgeOptions, IMockCall } from './mock-bridge.js';
export type { IMockResourceInit } from './mock-resource.js';
