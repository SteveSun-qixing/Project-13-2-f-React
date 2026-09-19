/**
 * SDK 包内测试夹具：受控的最小 `window` 环境。
 *
 * 口径：
 * - `@chips/sdk` 的运行时目标解析只读 `window.chips`（02-SDK-API规范 §3.2、§4），
 *   因此包内测试只需要一个可写的 `window` 对象，不引入 jsdom 等 DOM 实现；
 * - `mountWindow()` 返回恢复函数，测试在 `afterEach` 里调用即可把全局环境还原为
 *   「无 window」原判据，避免用例间相互污染。
 */

import type { IChipsBridge } from '../../src/types/bridge.js';

/** 可写的 `window.chips` 视图。 */
export interface WindowHost {
  chips?: IChipsBridge;
}

/** 带可选 `window` 的全局视图。 */
export interface GlobalWindowScope {
  window?: WindowHost;
}

/** 取得当前运行时上的 `window` 宿主；不存在时返回 `undefined`。 */
export function windowHost(): WindowHost | undefined {
  const scope: GlobalWindowScope = globalThis;
  return scope.window;
}

/**
 * 挂载一个不含 `chips` 的空 `window`，模拟「preload 尚未注入」的渲染进程环境。
 *
 * @returns 恢复函数：把 `globalThis.window` 还原为挂载前的值
 */
export function mountWindow(): () => void {
  const scope: GlobalWindowScope = globalThis;
  const previous = scope.window;
  const hadWindow = previous !== undefined;
  scope.window = {};
  return (): void => {
    if (hadWindow) {
      scope.window = previous;
      return;
    }
    delete scope.window;
  };
}
