import { createRequire } from 'node:module';

/**
 * 运行时加载 Electron 模块（壳入口使用）。
 *
 * @returns Electron 模块对象；不在 Electron 中运行或模块不可解析时返回 `null`。
 *
 * @remarks
 * - `require('electron')` 在普通 Node 进程中返回可执行文件路径字符串而非 API 对象；
 *   本函数校验形状后返回 `null`，避免把路径字符串当作 API 注入。
 * - 测试一律通过注入 mock，不触发本函数。
 */
export function loadElectronModule(): object | null {
  try {
    const require = createRequire(import.meta.url);
    const module: unknown = require('electron');
    if (typeof module !== 'object' || module === null) {
      return null;
    }
    const app = (module as { app?: unknown }).app;
    if (typeof app !== 'object' || app === null) {
      return null;
    }
    return module;
  } catch {
    return null;
  }
}
