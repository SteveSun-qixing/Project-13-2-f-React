/**
 * `window.chips` 全局声明（02-SDK-API规范 §4、§9.2）。
 *
 * 权威归属：
 * - `window.chips` 由 preload 经 `contextBridge` 注入，是插件访问平台能力的唯一运行时入口
 *   （01-Bridge-API规范 §2）；SDK 不注入、不替换、不扩展该对象，只提供其类型声明。
 * - 形状固定为 `readonly chips: IChipsBridge`：插件不得重复 `declare global`，
 *   也不得给 `Window` 添加其他平台对象（02-SDK-API规范 §9.2）。
 * - 本模块不含任何运行时语句：运行时依赖方向保持「插件 → SDK → 注入的 Bridge」，
 *   SDK 对 `@chips/bridge` 只有 `import type`（02-SDK-API规范 §11 约束 2）。
 */

import type { IChipsBridge } from './types/bridge.js';

declare global {
  interface Window {
    /** preload 注入的唯一运行时入口；方法面与 `IChipsBridge` 完全一致。 */
    readonly chips: IChipsBridge;
  }
}

export {};
