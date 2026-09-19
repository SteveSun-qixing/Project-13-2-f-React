/**
 * Mock Bridge 的安装与卸载（02-SDK-API规范 §7.2「installMockBridge / uninstallMockBridge」行）。
 *
 * 插件运行时代码只经 `window.chips`（§4），因此测试的接入点就是把 Mock 挂到
 * `globalThis.window.chips`：SDK 客户端按调用解析目标（§11 约束 8），安装后默认客户端 `chips`
 * 立即指向 Mock，无需重建单例。
 *
 * 本模块只写 `window.chips` 这一个成员，不注入、不替换、不扩展 `window` 上的其他对象（§4）；
 * 支持嵌套安装：每次安装记录当时的前值，卸载按后进先出恢复，未安装时卸载无操作。
 */

import { bridgeUnavailableError } from '../errors.js';
import type { IChipsBridge } from '../types/bridge.js';
import { createMockBridge } from './mock-bridge.js';
import type { IMockBridge } from './mock-bridge.js';

/** 可写的 `window.chips` 视图：仅用于测试装配，读写口径与全局声明一致。 */
interface MutableWindowHost {
  chips?: IChipsBridge;
}

/** 带 `window` 的全局视图；非浏览器运行时 `window` 可缺失。 */
interface WindowScope {
  window?: MutableWindowHost;
}

/** 一次安装的记录：`previous` 缺失表示安装前 `window.chips` 不存在。 */
interface InstallRecord {
  readonly bridge: IMockBridge;
  readonly previous: { readonly value: IChipsBridge } | undefined;
}

/** 安装栈；支持嵌套安装与逐个恢复。 */
const installStack: InstallRecord[] = [];

/** 读取当前 `window` 对象；不存在时返回 `undefined`。 */
function currentWindow(): MutableWindowHost | undefined {
  const scope: WindowScope = globalThis;
  return scope.window;
}

/**
 * 把 Mock Bridge 安装到 `globalThis.window.chips`。
 *
 * @param bridge - 要安装的 Mock；省略时新建一个
 * @returns 已安装的 Mock Bridge
 * @throws ChipsError 当前运行时没有 `window` 时抛 `SDK_BRIDGE_UNAVAILABLE`
 */
export function installMockBridge(bridge?: IMockBridge): IMockBridge {
  const host = currentWindow();
  if (host === undefined) {
    throw bridgeUnavailableError();
  }
  const installed = bridge ?? createMockBridge();
  const existing = host.chips;
  installStack.push({
    bridge: installed,
    previous: existing === undefined ? undefined : { value: existing },
  });
  host.chips = installed;
  return installed;
}

/**
 * 恢复安装前的 `window.chips`；未安装时无操作。
 *
 * 安装前该成员不存在时，卸载会删除该成员，保持「未注入」原判据。
 */
export function uninstallMockBridge(): void {
  const record = installStack.pop();
  if (record === undefined) {
    return;
  }
  const host = currentWindow();
  if (host === undefined) {
    return;
  }
  if (record.previous === undefined) {
    delete host.chips;
    return;
  }
  host.chips = record.previous.value;
}
