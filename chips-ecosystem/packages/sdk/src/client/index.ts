/**
 * 客户端模块出口（02-SDK-API规范 §3）。
 *
 * 仅供包内聚合使用；插件一律从 `@chips/sdk` 主入口导入（§2.1、§9.1）。
 */

export { ChipsBridge, chips, createClient } from './chips-bridge.js';
export type { ICreateClientOptions } from './chips-bridge.js';
