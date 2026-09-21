/**
 * 卡片窗口装载输入投递·窗口装载层真实传输臂（preload 侧 `ipcRenderer.invoke` 切片，刀7 后续接线波，任务 #120）。
 *
 * 权威：
 * - 封套与通道名的唯一契约权威在 `src/shared/card-window-init-surface.ts`（任务 #119 冻结件，
 *   头注明示「可安全 import 于主 / 渲染 / preload 任一侧」——本模块只取其通道名常量与世界键）；
 * - 工单035 裁定一（通道 = 壳渲染进程↔主进程 IPC 契约、非插件能力、不经 `window.chips`）与
 *   §10.3 待办 2（第三独立 contextBridge 世界、单方法 `requestInit`、通道钉死、纯转发不解释负载；
 *   `window.chips` 三方法面与 `__chipsHostViewChannel` 世界键集零改动）；
 * - `ADR-002` §IPC 通信 / `17-跨端Shell与平台抽象设计` §3.3 SB-4（contextBridge 只暴露受限方法面、
 *   不暴露 `ipcRenderer` 原始对象）；
 * - 工单038（#117 归一口径，《01-Bridge-API规范》§2.5）：本面是**挂在 contextBridge 上的独立世界**，
 *   其 Promise 拒绝值若为 `Error` 族实例会被桥替换为目标世界里无字段的匿名 `Error`——故本臂的
 *   **传输拒绝**（主进程处理器未注册等桥层失败）统一经 `toBridgeSurfaceError` 归一为
 *   `ChipsError.toPlain()` 同构纯数据后跨界，渲染侧以 `isChipsError` 结构守卫判定；
 *   就绪/空载/失败三臂的正常回包是纯数据封套，原样转发、不经本归一腿（不解释负载语义）。
 *
 * @remarks
 * - 与 `preload/host-view-channel.ts`（第二世界）同型纪律：单方法、无 channel 参数、通道在内部
 *   钉死为 {@link CARD_WINDOW_INIT_REQUEST_CHANNEL}——渲染侧借本面只能发起「装载输入取回」一种
 *   请求，无法触达任意 IPC 通道；本世界与 `chips` / `__chipsHostViewChannel` 各自独立挂载、互不扩面。
 * - 语义校验零置入：请求发送侧自检与响应到达侧权威闸归渲染消费臂
 *   （`renderer/entries/card.ts` 的装载输入提供器），本臂不解释、不改写、不重试。
 */

import { CARD_WINDOW_INIT_REQUEST_CHANNEL } from '../shared/card-window-init-surface.js';
import type { ICardWindowInitSurface } from '../shared/card-window-init-surface.js';
import { toBridgeSurfaceError } from './error-surface.js';
import type { ElectronIpcRendererLike } from './transport.js';

/**
 * 构造卡片窗口装载输入投递的窗口装载层暴露面（真实 `ipcRenderer.invoke` 臂）。
 *
 * @param ipcRenderer `require('electron').ipcRenderer` 或测试替身（结构切片，同 `transport.ts`）。
 * @returns 单方法最小面（键集恰为 `['requestInit']`）；每次调用把请求封套原样投递到钉定的投递通道。
 * @throws {Error} 缺少 `invoke` 时抛出（preload 装配缺陷，与 `createElectronPreloadTransport` /
 * `createHostViewChannelSurface` 同纪律）。
 */
export function createCardWindowInitSurface(ipcRenderer: ElectronIpcRendererLike): ICardWindowInitSurface {
  if (typeof ipcRenderer?.invoke !== 'function') {
    throw new Error('卡片窗口装载输入投递传输臂初始化失败：ipcRenderer 形状非法');
  }
  return {
    async requestInit(payload: unknown): Promise<unknown> {
      try {
        return await ipcRenderer.invoke(CARD_WINDOW_INIT_REQUEST_CHANNEL, payload);
      } catch (error: unknown) {
        // #117 跨界拒绝归一：`Error` 实例过 contextBridge 会丢尽字段（工单038 机理），
        // 拒绝值必须是 `toPlain()` 同构纯数据；渲染侧据 `code` 分支维持诚实空载等待。
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw toBridgeSurfaceError(error);
      }
    },
  };
}

/** 世界键（唯一名字来源在契约面；本模块转出以便 preload 入口不重复触达 shared 常量）。 */
export { CARD_WINDOW_INIT_SURFACE_KEY };
